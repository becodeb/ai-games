import { fake, ready } from './env.js'
import { after, before, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { db } from '../src/db.js'
import { createProject, getProjectDetail } from '../src/lib/store.js'
import { createAiQueue } from '../src/lib/ai/queue.js'
import { getAttemptRow, listAttempts, createAttempt } from '../src/lib/ai/attempts.js'
import { readConfig } from '../src/lib/ai/config.js'
import { GenerationError } from '../src/lib/ai/client.js'
import { waitFor } from './helpers.js'

before(() => ready)
after(() => fake.close())

const GAME = '```html\n<!DOCTYPE html><html><body>ok</body></html>\n```'
const newIteration = () =>
  createProject({ title: 'P', promptReadable: 'pedido', promptFull: 'pedido', send: false }).iterations[0].id
const statusOf = (iterationId, seq = 1) => listAttempts(iterationId).find((a) => a.seq === seq)?.status

/** Un generate controlable desde el test: cada llamada queda pendiente hasta resolverla. */
function controllable() {
  const calls = []
  const generate = (input) =>
    new Promise((resolve, reject) => {
      calls.push({ input, resolve: (text = GAME) => resolve({ text, model: 'm', inputTokens: 1, outputTokens: 2 }), reject })
    })
  return { calls, generate }
}

const cfg = (extra = {}) => () => ({ ...readConfig(), ...extra })

describe('estado de la IA para el alumno', () => {
  const pendingIteration = () =>
    createProject({ title: 'P', promptReadable: 'pedido', promptFull: 'pedido', send: true }).iterations[0]
  const aiOf = (iteration) => getProjectDetail(iteration.projectId).iterations[0].ai

  it('en cola es queued; si el intento falla y no hay uno listo, null', () => {
    const it0 = pendingIteration()
    assert.equal(aiOf(it0), null)
    const attempt = createAttempt({ iterationId: it0.id, feedback: 'cambio privado' })
    assert.deepEqual(aiOf(it0), { phase: 'queued', startedAt: null, redo: true })
    db.prepare("UPDATE ai_attempts SET status = 'error', error = 'boom' WHERE id = ?").run(attempt.id)
    assert.equal(aiOf(it0), null)
  })
})

describe('cola', () => {
  it('respeta AI_MAX_CONCURRENCY y atiende en orden de llegada (FIFO)', async () => {
    const { calls, generate } = controllable()
    const queue = createAiQueue({ generate, config: cfg({ maxConcurrency: 2 }) })
    const ids = [newIteration(), newIteration(), newIteration(), newIteration()]
    ids.forEach((id) => queue.enqueue(id))

    await waitFor(() => calls.length === 2)
    await new Promise((r) => setTimeout(r, 50))
    assert.equal(calls.length, 2)
    assert.deepEqual(ids.map((id) => statusOf(id)), ['generating', 'generating', 'queued', 'queued'])

    calls[0].resolve()
    await waitFor(() => calls.length === 3)
    assert.equal(statusOf(ids[2]), 'generating') // el tercero en llegar entra primero
    assert.equal(statusOf(ids[3]), 'queued')
    calls.slice(1).forEach((c) => c.resolve())
    await waitFor(() => calls.length === 4)
    calls[3].resolve()
    await waitFor(() => ids.every((id) => statusOf(id) === 'ready'))
  })

  it('cancelar y que llegue el resultado tarde: gana la cancelacion', async () => {
    const { calls, generate } = controllable()
    const queue = createAiQueue({ generate, config: cfg() })
    const id = newIteration()
    queue.enqueue(id)
    await waitFor(() => calls.length === 1)

    assert.equal(queue.cancel(id), 1)
    assert.equal(calls[0].input.signal.aborted, true)
    calls[0].resolve() // este generate ignora la senal y devuelve igual
    await waitFor(() => queue.activeCount() === 0)
    const [attempt] = listAttempts(id)
    assert.equal(attempt.status, 'canceled')
    assert.equal(attempt.code, '')
  })

  it('si termina primero, cancelar despues no pisa el borrador', async () => {
    const { calls, generate } = controllable()
    const queue = createAiQueue({ generate, config: cfg() })
    const id = newIteration()
    queue.enqueue(id)
    await waitFor(() => calls.length === 1)
    calls[0].resolve()
    await waitFor(() => statusOf(id) === 'ready')
    assert.equal(queue.cancel(id), 0)
    assert.equal(statusOf(id), 'ready')
  })

  it('un fallo inesperado deja el intento en error y el proceso sigue', async () => {
    const queue = createAiQueue({
      generate: async () => {
        throw new TypeError('algo salio mal por dentro')
      },
      config: cfg()
    })
    const silent = console.error
    console.error = () => {}
    const id = newIteration()
    try {
      queue.enqueue(id)
      await waitFor(() => statusOf(id) === 'error')
    } finally {
      console.error = silent
    }
    assert.match(listAttempts(id)[0].error, /Fallo inesperado/)
    assert.doesNotMatch(listAttempts(id)[0].error, /por dentro/) // el detalle interno no se muestra
  })

  it('un error conocido se guarda tal cual para el profe', async () => {
    const queue = createAiQueue({
      generate: async () => {
        throw new GenerationError('mensaje para el profe', 'refusal')
      },
      config: cfg()
    })
    const id = newIteration()
    queue.enqueue(id)
    await waitFor(() => statusOf(id) === 'error')
    assert.equal(listAttempts(id)[0].error, 'mensaje para el profe')
  })

  it('apagado ordenado: aborta, devuelve a la cola sin gastar un intento y el proximo arranque lo termina', async () => {
    const first = controllable()
    const queue = createAiQueue({ generate: first.generate, config: cfg() })
    const id = newIteration()
    queue.enqueue(id)
    await waitFor(() => first.calls.length === 1)
    assert.equal(getAttemptRow(listAttempts(id)[0].id).tries, 1)

    queue.stop()
    assert.equal(first.calls[0].input.signal.aborted, true)
    first.calls[0].reject(new Error('abortado'))
    await waitFor(() => queue.activeCount() === 0)
    const row = getAttemptRow(listAttempts(id)[0].id)
    assert.equal(row.status, 'queued')
    assert.equal(row.tries, 0)

    const second = controllable()
    const reborn = createAiQueue({ generate: second.generate, config: cfg() })
    reborn.start()
    await waitFor(() => second.calls.length === 1)
    second.calls[0].resolve()
    await waitFor(() => statusOf(id) === 'ready')
  })
})

describe('recuperacion al arrancar', () => {
  const stuck = (tries, status = 'generating') => {
    const iterationId = newIteration()
    const row = createAttempt({ iterationId })
    db.prepare('UPDATE ai_attempts SET status = ?, tries = ?, started_at = ? WHERE id = ?').run(status, tries, new Date().toISOString(), row.id)
    return iterationId
  }

  it('lo que quedo generando vuelve a la cola y se completa', async () => {
    const id = stuck(1)
    const { calls, generate } = controllable()
    createAiQueue({ generate, config: cfg() }).start()
    await waitFor(() => calls.some((c) => c.input.user.includes('pedido')))
    assert.equal(statusOf(id), 'generating')
    calls.forEach((c) => c.resolve())
    await waitFor(() => statusOf(id) === 'ready')
    assert.equal(getAttemptRow(listAttempts(id)[0].id).tries, 2)
  })

  it('despues de 2 intentos interrumpidos pasa a error en vez de reintentar para siempre', async () => {
    const id = stuck(2)
    const { calls, generate } = controllable()
    createAiQueue({ generate, config: cfg() }).start()
    await waitFor(() => statusOf(id) === 'error')
    assert.match(listAttempts(id)[0].error, /interrumpio/)
    assert.equal(calls.filter((c) => c.input.user.includes('pedido')).length, calls.length) // nada nuevo para este
  })
})

describe('configuracion', () => {
  it('los numeros invalidos caen a los valores por defecto', () => {
    const config = readConfig({
      ANTHROPIC_API_KEY: 'k',
      AI_MAX_CONCURRENCY: 'muchos',
      AI_DAILY_LIMIT: '-5',
      AI_EFFORT: 'ultra',
      AI_AUTO: 'quizas',
      ANTHROPIC_MODEL: '  '
    })
    assert.deepEqual(config, { enabled: true, auto: true, model: 'claude-sonnet-5-5', effort: 'low', maxConcurrency: 10, dailyLimit: 150 })
    assert.equal(readConfig({ AI_MAX_CONCURRENCY: '0' }).maxConcurrency, 10)
    assert.equal(readConfig({ AI_MAX_CONCURRENCY: '5', AI_EFFORT: 'HIGH', AI_AUTO: 'off' }).maxConcurrency, 5)
    assert.equal(readConfig({ AI_EFFORT: 'HIGH' }).effort, 'high')
  })

  it('las opciones dependen del modelo: Haiku sin razonar ni respaldo', async () => {
    const { modelOptions } = await import('../src/lib/ai/client.js')
    assert.deepEqual(modelOptions('claude-haiku-5-5', 'low'), { thinking: { type: 'disabled' } })
    assert.deepEqual(modelOptions('claude-haiku-5-5', 'max'), { thinking: { type: 'adaptive' } })
    assert.equal(modelOptions('claude-sonnet-5-5', 'low').fallbacks, 'default')
    assert.equal(readConfig({ AI_AUTO: 'off' }).auto, false)
    assert.equal(readConfig({}).enabled, false)
  })
})
