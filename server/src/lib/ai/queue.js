/**
 * Cola en proceso de la generacion con IA: FIFO, AI_MAX_CONCURRENCY a la vez, un AbortController
 * por intento en curso. Todo cambio de estado es un UPDATE condicional (ver attempts.js), asi que
 * cancelar, publicar a mano o terminar al mismo tiempo nunca se pisan: gana el primero.
 * Un error de generacion jamas tira el proceso.
 */
import { getIterationRow, getProjectDetail } from '../store.js'
import {
  activeAttempt,
  cancelActive,
  claimNext,
  countSince,
  createAttempt,
  DAILY_LIMIT_CODE,
  mapAttempt,
  markError,
  markReady,
  previousFeedback,
  releaseAttempt,
  requeueInterrupted
} from './attempts.js'
import { readConfig, CODE_CAP, FEEDBACK_CAP } from './config.js'
import { generateGame, GenerationError } from './client.js'
import { buildUserMessage, joinCode, SYSTEM_PROMPT } from './prompt.js'
import { extractGame, ExtractError } from './extract.js'

/** Error de validacion/estado que la API traduce a un HTTP. */
export class AiRequestError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

const DAY_MS = 24 * 60 * 60 * 1000

/** Arma system + user a partir de lo que hay guardado en el momento de generar. */
export function buildPrompt(attempt) {
  const row = getIterationRow(attempt.iteration_id)
  if (!row) throw new GenerationError('La version ya no existe.', 'gone')
  const iterations = getProjectDetail(row.project_id).iterations
  const current = iterations.find((it) => it.id === row.id)
  const earlier = iterations.filter((it) => it.version < current.version)
  const withCode = [...earlier].reverse().find((it) => it.hasCode)

  return {
    system: SYSTEM_PROMPT,
    user: buildUserMessage({
      iteration: current,
      earlier,
      previousCode: withCode ? { version: withCode.version, code: joinCode(withCode.code) } : null,
      baseCode: attempt.base_code,
      previousFeedback: previousFeedback(attempt.iteration_id, attempt.seq),
      feedback: attempt.feedback
    })
  }
}

export function createAiQueue({ generate = generateGame, config = readConfig, onChange = () => {} } = {}) {
  const running = new Map() // attemptId -> { controller, iterationId }
  let stopped = false

  const notify = (iterationId) => {
    try {
      onChange(iterationId)
    } catch (error) {
      console.warn('[ai] fallo el aviso en vivo:', error?.message)
    }
  }

  function pump() {
    if (stopped) return
    while (running.size < config().maxConcurrency) {
      const attempt = claimNext()
      if (!attempt) break
      run(attempt)
    }
  }

  async function run(attempt) {
    const controller = new AbortController()
    running.set(attempt.id, { controller, iterationId: attempt.iteration_id })
    notify(attempt.iteration_id)
    try {
      const { system, user } = buildPrompt(attempt)
      const result = await generate({ system, user, signal: controller.signal })
      if (controller.signal.aborted) return
      const { html, warning } = extractGame(result.text)
      markReady(attempt.id, {
        code: html,
        warning,
        model: result.model,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens
      })
    } catch (error) {
      if (controller.signal.aborted) return
      const known = error instanceof GenerationError || error instanceof ExtractError
      if (!known) console.error('[ai] error inesperado:', error)
      markError(attempt.id, known ? error.message : 'Fallo inesperado al generar el juego. Proba de nuevo.', error?.code || '')
    } finally {
      running.delete(attempt.id)
      notify(attempt.iteration_id)
      setImmediate(pump)
    }
  }

  /**
   * Crea un intento y lo deja en cola. Con `auto` (lo dispara el envio del alumno) nunca tira:
   * devuelve null si no corresponde o deja un intento `error` si se paso el limite diario.
   */
  function enqueue(iterationId, { feedback = '', code = null, requestedBy = '', auto = false } = {}) {
    const cfg = config()
    if (auto && !cfg.auto) return null
    if (!cfg.enabled) {
      if (auto) return null
      throw new AiRequestError(503, 'La generacion con IA no esta activada.')
    }
    const iteration = getIterationRow(iterationId)
    if (!iteration) {
      if (auto) return null
      throw new AiRequestError(404, 'Iteracion no encontrada.')
    }

    const text = String(feedback || '').trim()
    if (text.length > FEEDBACK_CAP) throw new AiRequestError(400, `Los cambios pedidos son muy largos (maximo ${FEEDBACK_CAP} caracteres).`)
    // El codigo base solo cuenta cuando hay cambios que aplicarle.
    const baseCode = text && code ? joinCode(code) : ''
    if (baseCode.length > CODE_CAP) throw new AiRequestError(400, 'El codigo es demasiado largo.')

    if (activeAttempt(iterationId)) {
      if (auto) return null
      throw new AiRequestError(409, 'La IA ya esta trabajando en esta version.')
    }

    if (countSince(new Date(Date.now() - DAY_MS).toISOString()) >= cfg.dailyLimit) {
      if (!auto) throw new AiRequestError(429, 'Se alcanzo el limite diario de generaciones con IA. Pega el codigo a mano o proba manana.')
      const blocked = createAttempt({
        iterationId,
        requestedBy: 'auto',
        status: 'error',
        error: 'No se genero solo: se alcanzo el limite diario de generaciones con IA. Podes generarlo a mano mas tarde o pegar el codigo.',
        errorCode: DAILY_LIMIT_CODE
      })
      notify(iterationId)
      return mapAttempt(blocked)
    }

    const attempt = createAttempt({
      iterationId,
      feedback: text,
      baseCode,
      requestedBy: auto ? 'auto' : String(requestedBy || '').slice(0, 80)
    })
    notify(iterationId)
    setImmediate(pump)
    return mapAttempt(attempt)
  }

  /** Cancela lo activo de la iteracion y corta la llamada en curso. */
  function cancel(iterationId) {
    const ids = cancelActive(iterationId)
    for (const id of ids) running.get(id)?.controller.abort()
    if (ids.length) notify(iterationId)
    return ids.length
  }

  return {
    enqueue,
    cancel,
    pump,
    status: () => {
      const { enabled, auto, model } = config()
      return { enabled, auto, model }
    },
    /** Al arrancar: lo que quedo a medias vuelve a la cola (maximo MAX_TRIES). */
    start() {
      stopped = false
      requeueInterrupted()
      pump()
    },
    /** Apagado ordenado: aborta lo que corre y lo deja para reintentar al proximo arranque. */
    stop() {
      stopped = true
      for (const [id, { controller }] of running) {
        controller.abort()
        releaseAttempt(id)
      }
    },
    activeCount: () => running.size
  }
}
