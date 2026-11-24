import { fake, ready } from './env.js'
import { after, before, it } from 'node:test'
import assert from 'node:assert/strict'
import { startServer, waitFor } from './helpers.js'

let srv

before(async () => {
  await ready
  process.env.AI_DAILY_LIMIT = '2'
  srv = await startServer()
})
after(async () => {
  await srv.close()
  await fake.close()
})

const create = async (send) =>
  (await srv.post('/projects', { title: 'T', promptReadable: 'x', promptFull: 'x', send })).json.iterations[0].id
const attempts = async (id) => (await srv.get(`/iterations/${id}/ai`)).json.attempts

it('el limite diario frena lo manual con 429 y deja un aviso en lo automatico', async () => {
  const a = await create(true)
  const b = await create(true)
  await waitFor(async () => (await attempts(a))[0]?.status === 'ready' && (await attempts(b))[0]?.status === 'ready')

  // Manual: 429 y no se crea nada.
  const c = await create(false)
  const manual = await srv.post(`/iterations/${c}/ai`)
  assert.equal(manual.status, 429)
  assert.match(manual.json.error, /limite diario/)
  assert.equal((await attempts(c)).length, 0)

  // Automatico (el alumno envia): queda un intento `error` que explica por que.
  const d = await create(true)
  const [blocked] = await waitFor(async () => {
    const list = await attempts(d)
    return list.length ? list : null
  })
  assert.equal(blocked.status, 'error')
  assert.equal(blocked.errorCode, 'daily_limit')
  assert.match(blocked.error, /limite diario/)
  assert.equal(fake.requests.length, 2)
  assert.equal((await srv.get('/dashboard')).json.some((p) => p.aiStatus === 'error'), true) // el profe lo ve en el panel

  // Ese aviso no cuenta para el limite: subiendo el tope a 3 entra uno mas (si contara, ya serian 3).
  process.env.AI_DAILY_LIMIT = '3'
  assert.equal((await srv.post(`/iterations/${c}/ai`)).status, 202)
  await waitFor(async () => (await attempts(c))[0]?.status === 'ready')
  assert.equal((await srv.post(`/iterations/${d}/ai`)).status, 429) // y ahora si llegamos a 3
})
