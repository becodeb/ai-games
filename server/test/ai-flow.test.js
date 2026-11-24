import { fake, ready } from './env.js'
import { after, before, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { FULL_DOC, startServer, waitFor } from './helpers.js'

let srv

before(async () => {
  await ready
  srv = await startServer()
})
after(async () => {
  await srv.close()
  await fake.close()
})

async function newProject(send, extra = {}) {
  const res = await srv.post('/projects', {
    title: 'Naves',
    studentName: 'Ana',
    promptReadable: 'Un juego de naves que esquivan meteoritos',
    promptFull: 'Un juego de naves que esquivan meteoritos\n\n--- FORMATO ---',
    send,
    ...extra
  })
  assert.equal(res.status, 201)
  return { projectId: res.json.project.id, iterationId: res.json.iterations[0].id }
}

const attemptsOf = async (iterationId) => (await srv.get(`/iterations/${iterationId}/ai`)).json.attempts
const waitStatus = (iterationId, seq, status) =>
  waitFor(async () => (await attemptsOf(iterationId)).find((a) => a.seq === seq && a.status === status))
const lastUserMessage = () => fake.requests.at(-1).body.messages.at(-1).content

describe('generacion automatica', () => {
  it('enviar a los profes dispara un intento y la llamada usa los parametros acordados', async () => {
    const before = fake.requests.length
    const { iterationId } = await newProject(true)
    const attempt = await waitStatus(iterationId, 1, 'ready')

    assert.equal(fake.requests.length, before + 1)
    const { body, headers, url } = fake.requests.at(-1)
    assert.match(url, /^\/v1\/messages/)
    assert.equal(headers.authorization, 'Bearer test-key-123')
    assert.match(headers['anthropic-beta'], /server-side-fallback-2026-07-01/)
    assert.equal(body.model, 'claude-opus-5-5')
    assert.equal(body.max_tokens, 64000)
    assert.equal(body.stream, true)
    assert.deepEqual(body.thinking, { type: 'adaptive' })
    assert.deepEqual(body.output_config, { effort: 'medium' })
    assert.equal(body.fallbacks, 'default')
    for (const banned of ['temperature', 'top_p', 'top_k', 'tool_choice']) assert.equal(body[banned], undefined)
    assert.match(body.system, /taller escolar/)
    assert.match(lastUserMessage(), /Un juego de naves que esquivan meteoritos/)
    assert.doesNotMatch(lastUserMessage(), /FORMATO/) // usa el texto legible

    assert.match(attempt.code, /Juego falso #\d+/)
    assert.equal(attempt.inputTokens, 1200)
    assert.equal(attempt.outputTokens, 3400)
    assert.equal(attempt.warning, '')
  })

  it('copiar el prompt no dispara nada; mandarlo despues si (una sola vez)', async () => {
    const before = fake.requests.length
    const { iterationId } = await newProject(false)
    await new Promise((r) => setTimeout(r, 100))
    assert.deepEqual(await attemptsOf(iterationId), [])
    assert.equal(fake.requests.length, before)

    assert.equal((await srv.post(`/iterations/${iterationId}/send`)).status, 200)
    await waitStatus(iterationId, 1, 'ready')
    await srv.post(`/iterations/${iterationId}/send`) // ya estaba pendiente: no vuelve a generar
    await new Promise((r) => setTimeout(r, 100))
    assert.equal((await attemptsOf(iterationId)).length, 1)
  })

  it('el borrador es privado hasta aprobarlo y aprobar publica por el mismo camino', async () => {
    const { projectId, iterationId } = await newProject(true)
    const draft = await waitStatus(iterationId, 1, 'ready')

    const detail = await srv.get(`/projects/${projectId}`)
    assert.equal(detail.json.iterations[0].hasCode, false)
    assert.doesNotMatch(detail.text, /Juego falso|ai_attempts|base_code/)
    assert.doesNotMatch((await srv.get('/projects')).text, /Juego falso/)
    assert.equal((await srv.get('/gallery')).json.some((g) => g.projectId === projectId), false)
    assert.equal((await srv.get(`/iterations/${iterationId}/play`)).status, 404)
    assert.equal((await srv.get(`/iterations/${iterationId}/download`)).status, 404)

    const dash = (await srv.get('/dashboard')).json.find((p) => p.id === projectId)
    assert.equal(dash.aiStatus, 'ready')

    const saved = await srv.put(`/iterations/${iterationId}/code`, { html: draft.code, css: '', js: '', publishedBy: 'Profe' })
    assert.equal(saved.status, 200)
    assert.equal((await srv.get(`/iterations/${iterationId}/play`)).status, 200)
    assert.equal((await srv.get('/gallery')).json.some((g) => g.projectId === projectId), true)
    assert.equal((await srv.get('/dashboard')).json.find((p) => p.id === projectId).aiStatus, null)
  })

  it('rehacer no crea versiones y manda codigo del editor + todos los cambios', async () => {
    const { projectId, iterationId } = await newProject(true)
    await waitStatus(iterationId, 1, 'ready')

    const first = await srv.post(`/iterations/${iterationId}/ai`, {
      feedback: 'que sea mas rapido',
      code: { html: FULL_DOC('EDITADO-A-MANO'), css: '', js: '' },
      requestedBy: 'Profe'
    })
    assert.equal(first.status, 202)
    assert.equal(first.json.attempt.seq, 2)
    await waitStatus(iterationId, 2, 'ready')
    assert.match(lastUserMessage(), /EDITADO-A-MANO/)
    assert.match(lastUserMessage(), /<cambio_nuevo>\nque sea mas rapido\n<\/cambio_nuevo>/)

    await srv.post(`/iterations/${iterationId}/ai`, {
      feedback: 'ahora con musica',
      code: { html: FULL_DOC('SEGUNDA-EDICION'), css: 'body{color:red}', js: 'var a = 1' }
    })
    const third = await waitStatus(iterationId, 3, 'ready')
    const message = lastUserMessage()
    assert.match(message, /<cambio numero="1">\nque sea mas rapido\n<\/cambio>/)
    assert.match(message, /<cambio_nuevo>\nahora con musica\n<\/cambio_nuevo>/)
    assert.match(message, /SEGUNDA-EDICION/)
    assert.match(message, /<style>\nbody\{color:red\}\n<\/style>/) // css/js se unen al codigo base
    assert.doesNotMatch(message, /data-steamlab/) // sin el preludio del runtime
    assert.match(third.code, /ahora con musica/) // el falso lo mete en el titulo

    const detail = await srv.get(`/projects/${projectId}`)
    assert.equal(detail.json.iterations.length, 1)
    assert.equal((await attemptsOf(iterationId)).length, 3)
  })

  it('una iteracion de mejora lleva pedidos anteriores y la version previa con codigo', async () => {
    const { projectId, iterationId: v1 } = await newProject(false)
    await srv.put(`/iterations/${v1}/code`, { html: FULL_DOC('CODIGO-DE-LA-V1'), css: '', js: '' })
    const added = await srv.post(`/projects/${projectId}/iterations`, {
      promptReadable: 'Agregar un enemigo jefe',
      promptFull: 'Agregar un enemigo jefe\n\n--- FORMATO ---',
      send: true
    })
    const v2 = added.json.iterations[1].id
    await waitStatus(v2, 1, 'ready')
    const message = lastUserMessage()
    assert.match(message, /Un juego de naves que esquivan meteoritos/)
    assert.match(message, /<codigo version="1">\n[\s\S]*CODIGO-DE-LA-V1/)
    assert.match(message, /<pedido_del_alumno>\nAgregar un enemigo jefe\n<\/pedido_del_alumno>/)
    assert.equal((await srv.get(`/projects/${projectId}`)).json.iterations.length, 2)
  })

  it('409 si ya hay un intento en curso; cancelar libera y descarta el resultado', async () => {
    fake.delayMs = 400
    try {
      const { iterationId } = await newProject(false)
      assert.equal((await srv.post(`/iterations/${iterationId}/ai`)).status, 202)
      assert.equal((await srv.post(`/iterations/${iterationId}/ai`)).status, 409)

      await waitStatus(iterationId, 1, 'generating')
      const abortedBefore = fake.aborted
      const canceled = await srv.post(`/iterations/${iterationId}/ai/cancel`)
      assert.deepEqual(canceled.json, { canceled: 1 })
      await waitFor(() => fake.aborted > abortedBefore) // la llamada de red se corto de verdad
      await new Promise((r) => setTimeout(r, 500))
      const [attempt] = await attemptsOf(iterationId)
      assert.equal(attempt.status, 'canceled')
      assert.equal(attempt.code, '')

      assert.equal((await srv.post(`/iterations/${iterationId}/ai`)).status, 202) // ya se puede pedir otro
      await waitStatus(iterationId, 2, 'ready')
    } finally {
      fake.delayMs = 0
    }
  })

  it('publicar a mano mientras genera cancela el intento y gana lo publicado', async () => {
    fake.delayMs = 400
    try {
      const { iterationId } = await newProject(true)
      await waitStatus(iterationId, 1, 'generating')
      const manual = await srv.put(`/iterations/${iterationId}/code`, { html: FULL_DOC('PEGADO-A-MANO'), css: '', js: '' })
      assert.equal(manual.status, 200)
      await new Promise((r) => setTimeout(r, 600))
      const [attempt] = await attemptsOf(iterationId)
      assert.equal(attempt.status, 'canceled')
      assert.equal(attempt.code, '')
      assert.match((await srv.get(`/iterations/${iterationId}/play`)).text, /PEGADO-A-MANO/)
    } finally {
      fake.delayMs = 0
    }
  })

  it('el estado de la IA tambien se ve en el dashboard mientras genera', async () => {
    fake.delayMs = 300
    try {
      const { projectId, iterationId } = await newProject(true)
      await waitStatus(iterationId, 1, 'generating')
      assert.equal((await srv.get('/dashboard')).json.find((p) => p.id === projectId).aiStatus, 'generating')
      await waitStatus(iterationId, 1, 'ready')
    } finally {
      fake.delayMs = 0
    }
  })

  it('GET /ai/status expone enabled, auto y model sin la clave', async () => {
    const res = await srv.get('/ai/status')
    assert.deepEqual(res.json, { enabled: true, auto: true, model: 'claude-opus-5-5' })
    assert.doesNotMatch(res.text, /test-key/)
  })
})
