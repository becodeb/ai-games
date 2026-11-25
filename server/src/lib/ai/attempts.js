/**
 * Persistencia de los intentos de la IA (tabla ai_attempts).
 * Todas las transiciones de estado son UPDATE condicionales: si cancelar y terminar se pisan,
 * gana el primero y el segundo no cambia nada (changes = 0).
 */
import { db, newId, now } from '../../db.js'
import { MAX_TRIES } from './config.js'

export const ACTIVE = ['queued', 'generating']
export const DAILY_LIMIT_CODE = 'daily_limit'

const st = {
  insert: db.prepare(`
    INSERT INTO ai_attempts (id, iteration_id, seq, feedback, requested_by, status, base_code, error, error_code, created_at, finished_at)
    VALUES (@id, @iteration_id, @seq, @feedback, @requested_by, @status, @base_code, @error, @error_code, @created_at, @finished_at)
  `),
  nextSeq: db.prepare('SELECT COALESCE(MAX(seq), 0) + 1 AS next FROM ai_attempts WHERE iteration_id = ?'),
  get: db.prepare('SELECT * FROM ai_attempts WHERE id = ?'),
  list: db.prepare('SELECT * FROM ai_attempts WHERE iteration_id = ? ORDER BY seq ASC'),
  active: db.prepare("SELECT * FROM ai_attempts WHERE iteration_id = ? AND status IN ('queued', 'generating') LIMIT 1"),
  // Sin columnas de codigo: el dashboard la pide por cada proyecto.
  latestStatus: db.prepare('SELECT status FROM ai_attempts WHERE iteration_id = ? ORDER BY seq DESC LIMIT 1'),
  // Solo intentos 'ready': los fallidos o cancelados nunca se aplicaron al codigo.
  previousFeedback: db.prepare(
    "SELECT feedback FROM ai_attempts WHERE iteration_id = ? AND seq < ? AND feedback <> '' AND status = 'ready' ORDER BY seq ASC"
  ),
  // Sin columnas de codigo, de error ni de texto: solo lo que ve el alumno.
  projectStates: db.prepare(`
    SELECT a.iteration_id, a.status, a.started_at, (a.feedback <> '') AS has_feedback
    FROM ai_attempts a JOIN iterations i ON i.id = a.iteration_id
    WHERE i.project_id = ? ORDER BY a.seq ASC
  `),
  nextQueued: db.prepare("SELECT id FROM ai_attempts WHERE status = 'queued' ORDER BY created_at ASC, rowid ASC LIMIT 1"),
  claim: db.prepare(
    "UPDATE ai_attempts SET status = 'generating', started_at = ?, tries = tries + 1 WHERE id = ? AND status = 'queued'"
  ),
  ready: db.prepare(`
    UPDATE ai_attempts
    SET status = 'ready', code_html = @code_html, warning = @warning, model = @model,
        input_tokens = @input_tokens, output_tokens = @output_tokens, error = '', finished_at = @finished_at
    WHERE id = @id AND status = 'generating'
  `),
  fail: db.prepare(`
    UPDATE ai_attempts SET status = 'error', error = ?, error_code = ?, finished_at = ?
    WHERE id = ? AND status IN ('queued', 'generating')
  `),
  cancelActive: db.prepare(
    "UPDATE ai_attempts SET status = 'canceled', finished_at = ? WHERE iteration_id = ? AND status IN ('queued', 'generating')"
  ),
  activeIds: db.prepare("SELECT id FROM ai_attempts WHERE iteration_id = ? AND status IN ('queued', 'generating')"),
  release: db.prepare(
    "UPDATE ai_attempts SET status = 'queued', tries = MAX(tries - 1, 0), started_at = NULL WHERE id = ? AND status = 'generating'"
  ),
  interrupted: db.prepare("SELECT id, tries FROM ai_attempts WHERE status IN ('queued', 'generating')"),
  requeue: db.prepare("UPDATE ai_attempts SET status = 'queued', started_at = NULL WHERE id = ?"),
  // El limite diario cuenta todo menos los avisos de "se alcanzo el limite", que no gastaron nada.
  countSince: db.prepare("SELECT COUNT(*) AS n FROM ai_attempts WHERE created_at >= ? AND error_code <> ?"),
  iterationProject: db.prepare('SELECT project_id FROM iterations WHERE id = ?')
}

export function mapAttempt(row) {
  if (!row) return null
  return {
    id: row.id,
    iterationId: row.iteration_id,
    seq: row.seq,
    feedback: row.feedback,
    requestedBy: row.requested_by,
    status: row.status,
    code: row.code_html,
    error: row.error,
    errorCode: row.error_code,
    warning: row.warning,
    model: row.model,
    inputTokens: row.input_tokens,
    outputTokens: row.output_tokens,
    tries: row.tries,
    createdAt: row.created_at,
    startedAt: row.started_at,
    finishedAt: row.finished_at
  }
}

export const getAttemptRow = (id) => st.get.get(id)
export const listAttempts = (iterationId) => st.list.all(iterationId).map(mapAttempt)
export const activeAttempt = (iterationId) => st.active.get(iterationId) || null
export const latestAttemptStatus = (iterationId) => st.latestStatus.get(iterationId)?.status ?? null
export const previousFeedback = (iterationId, seq) => st.previousFeedback.all(iterationId, seq).map((r) => r.feedback)
/** Estado de la IA por iteracion de un proyecto (iterationId -> filas en orden), sin codigo ni textos. */
export function attemptStatesByIteration(projectId) {
  const map = new Map()
  for (const row of st.projectStates.all(projectId)) {
    if (!map.has(row.iteration_id)) map.set(row.iteration_id, [])
    map.get(row.iteration_id).push({ status: row.status, startedAt: row.started_at, redo: Boolean(row.has_feedback) })
  }
  return map
}
export const projectOfIteration = (iterationId) => st.iterationProject.get(iterationId)?.project_id ?? null

export function countSince(isoDate) {
  return st.countSince.get(isoDate, DAILY_LIMIT_CODE).n
}

/** Inserta un intento nuevo con el siguiente numero de secuencia. */
export function createAttempt({ iterationId, feedback = '', baseCode = '', requestedBy = '', status = 'queued', error = '', errorCode = '' }) {
  const timestamp = now()
  const id = newId()
  const tx = db.transaction(() => {
    st.insert.run({
      id,
      iteration_id: iterationId,
      seq: st.nextSeq.get(iterationId).next,
      feedback,
      requested_by: requestedBy,
      status,
      base_code: baseCode,
      error,
      error_code: errorCode,
      created_at: timestamp,
      finished_at: status === 'error' ? timestamp : null
    })
  })
  tx()
  return st.get.get(id)
}

/** Toma el intento en cola mas viejo (FIFO). null si no hay o si lo gano otro. */
export function claimNext() {
  const row = st.nextQueued.get()
  if (!row) return null
  if (st.claim.run(now(), row.id).changes !== 1) return null
  return st.get.get(row.id)
}

export function markReady(id, { code, warning = '', model = '', inputTokens = 0, outputTokens = 0 }) {
  return (
    st.ready.run({
      id,
      code_html: code,
      warning,
      model,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      finished_at: now()
    }).changes === 1
  )
}

export function markError(id, message, code = '') {
  return st.fail.run(String(message).slice(0, 500), code, now(), id).changes === 1
}

/** Cancela lo activo de la iteracion. Devuelve los ids cancelados. */
export function cancelActive(iterationId) {
  const tx = db.transaction(() => {
    const ids = st.activeIds.all(iterationId).map((r) => r.id)
    if (ids.length) st.cancelActive.run(now(), iterationId)
    return ids
  })
  return tx()
}

/** Apagado ordenado: el intento vuelve a la cola sin gastar un intento de los permitidos. */
export function releaseAttempt(id) {
  return st.release.run(id).changes === 1
}

/** Al arrancar: lo que quedo a medias vuelve a la cola, salvo que ya se interrumpio demasiadas veces. */
export function requeueInterrupted() {
  const tx = db.transaction(() => {
    let requeued = 0
    for (const row of st.interrupted.all()) {
      if (row.tries >= MAX_TRIES) {
        markError(row.id, 'La generacion se interrumpio varias veces. Proba de nuevo.', 'interrupted')
      } else {
        st.requeue.run(row.id)
        requeued += 1
      }
    }
    return requeued
  })
  return tx()
}
