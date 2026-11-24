/**
 * API de la generacion con IA (para profes). Los intentos son borradores privados: nada de aca
 * llega a los alumnos ni a la galeria. Publicar sigue siendo PUT /iterations/:id/code.
 */
import { Router } from 'express'
import { ai } from '../lib/ai/index.js'
import { AiRequestError } from '../lib/ai/queue.js'
import { listAttempts } from '../lib/ai/attempts.js'
import { getIterationRow } from '../lib/store.js'

const router = Router()

const asString = (value) => (typeof value === 'string' ? value : '')

router.get('/ai/status', (_req, res) => {
  res.json(ai.status())
})

router.get('/iterations/:id/ai', (req, res) => {
  if (!getIterationRow(req.params.id)) return res.status(404).json({ error: 'Iteracion no encontrada.' })
  res.json({ enabled: ai.status().enabled, attempts: listAttempts(req.params.id) })
})

router.post('/iterations/:id/ai', (req, res) => {
  const { feedback, code, requestedBy } = req.body || {}
  const parts =
    code && typeof code === 'object'
      ? { html: asString(code.html), css: asString(code.css), js: asString(code.js) }
      : null

  try {
    const attempt = ai.enqueue(req.params.id, {
      feedback: asString(feedback),
      code: parts,
      requestedBy: asString(requestedBy)
    })
    res.status(202).json({ attempt })
  } catch (error) {
    if (error instanceof AiRequestError) return res.status(error.status).json({ error: error.message })
    throw error
  }
})

router.post('/iterations/:id/ai/cancel', (req, res) => {
  if (!getIterationRow(req.params.id)) return res.status(404).json({ error: 'Iteracion no encontrada.' })
  res.json({ canceled: ai.cancel(req.params.id) })
})

export default router
