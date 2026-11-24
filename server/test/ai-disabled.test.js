import { fake, ready } from './env.js'
import { after, before, it } from 'node:test'
import assert from 'node:assert/strict'
import { startServer } from './helpers.js'

let srv

before(async () => {
  await ready
  process.env.ANTHROPIC_API_KEY = '   ' // sin clave: la funcion no existe
  srv = await startServer()
})
after(async () => {
  await srv.close()
  await fake.close()
})

it('sin clave la app se comporta como antes: no genera, 503 en los endpoints de IA', async () => {
  assert.deepEqual((await srv.get('/ai/status')).json, { enabled: false, auto: true, model: 'claude-opus-5-5' })

  const created = await srv.post('/projects', { title: 'T', promptReadable: 'x', promptFull: 'x', send: true })
  assert.equal(created.status, 201)
  const id = created.json.iterations[0].id
  await new Promise((r) => setTimeout(r, 150))

  const list = await srv.get(`/iterations/${id}/ai`)
  assert.deepEqual(list.json, { enabled: false, attempts: [] })
  assert.equal(fake.requests.length, 0)
  assert.equal((await srv.post(`/iterations/${id}/ai`, { feedback: 'hola' })).status, 503)
  assert.equal((await srv.get('/dashboard')).json[0].aiStatus, null)

  // El camino manual sigue andando igual.
  const saved = await srv.put(`/iterations/${id}/code`, { html: '<!DOCTYPE html><html><body>a mano</body></html>' })
  assert.equal(saved.status, 200)
  assert.equal((await srv.get(`/iterations/${id}/play`)).status, 200)
  assert.equal(fake.requests.length, 0)
})

it('AI_AUTO=false apaga solo el disparo automatico; el boton manual sigue', async () => {
  process.env.ANTHROPIC_API_KEY = 'test-key-123'
  process.env.AI_AUTO = 'false'
  try {
    const created = await srv.post('/projects', { title: 'T', promptReadable: 'x', promptFull: 'x', send: true })
    const id = created.json.iterations[0].id
    await new Promise((r) => setTimeout(r, 150))
    assert.equal((await srv.get(`/iterations/${id}/ai`)).json.attempts.length, 0)
    assert.equal((await srv.post(`/iterations/${id}/ai`)).status, 202)
  } finally {
    delete process.env.AI_AUTO
  }
})
