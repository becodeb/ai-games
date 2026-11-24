import { fake, ready } from './env.js'
import { after, before, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { startServer, waitFor } from './helpers.js'

let srv

before(async () => {
  await ready
  srv = await startServer()
})
after(async () => {
  fake.mode = 'game'
  await srv.close()
  await fake.close()
})

async function sendProject() {
  const res = await srv.post('/projects', { title: 'T', promptReadable: 'Un juego', promptFull: 'Un juego', send: true })
  return res.json.iterations[0].id
}
const firstAttempt = (id, status) =>
  waitFor(async () => (await srv.get(`/iterations/${id}/ai`)).json.attempts.find((a) => a.status === status))

describe('errores de la IA', () => {
  const cases = [
    ['refusal', /no quiso/i],
    ['max_tokens', /quedo cortado/i],
    ['broken', /incompleta/i],
    ['auth', /clave/i],
    ['rate_limit', /demasiados pedidos/i],
    ['server_error', /problemas o sobrecargada/i]
  ]

  for (const [mode, expected] of cases) {
    it(`${mode}: queda un intento con error claro, sin filtrar nada interno`, async () => {
      fake.mode = mode
      const id = await sendProject()
      const attempt = await firstAttempt(id, 'error')
      assert.match(attempt.error, expected)
      assert.doesNotMatch(JSON.stringify(attempt), /SECRETO|test-key|Bearer/)
      assert.equal(attempt.code, '')

      // El profe puede reintentar: un error no bloquea nuevos intentos.
      fake.mode = 'game'
      assert.equal((await srv.post(`/iterations/${id}/ai`)).status, 202)
      await firstAttempt(id, 'ready')
    })
  }

  it('un error de sintaxis en el script guarda el borrador igual, con aviso', async () => {
    fake.mode = 'syntax'
    const id = await sendProject()
    const attempt = await firstAttempt(id, 'ready')
    assert.match(attempt.warning, /^El codigo tiene un error de sintaxis: /)
    assert.match(attempt.code, /<!DOCTYPE html>/)
    fake.mode = 'game'
  })

  it('si el servidor de la IA no responde queda un error de conexion legible', async () => {
    const saved = process.env.ANTHROPIC_BASE_URL
    process.env.ANTHROPIC_BASE_URL = 'http://127.0.0.1:9'
    try {
      const id = await sendProject()
      const attempt = await waitFor(
        async () => (await srv.get(`/iterations/${id}/ai`)).json.attempts.find((a) => a.status === 'error'),
        { timeout: 20000 }
      )
      assert.match(attempt.error, /conectar/i)
    } finally {
      process.env.ANTHROPIC_BASE_URL = saved
    }
  })
})
