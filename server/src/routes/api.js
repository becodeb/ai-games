import { Router } from 'express'
import {
  addIteration,
  createProject,
  getIterationDocument,
  getIterationRow,
  getProjectDetail,
  listDashboard,
  listGallery,
  listProjectsForStudents,
  markIterationSent,
  saveIterationCode,
  updateProject
} from '../lib/store.js'
import { broadcastProject } from '../lib/realtime.js'
import { buildGameDocument, hasPlayableCode } from '../lib/game-code.js'

const router = Router()

function asString(value) {
  return typeof value === 'string' ? value : ''
}

router.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'ia-steamlab', time: new Date().toISOString() })
})

/* ------------------------------------------------------------------ alumno */

// Listado liviano para "Continuar un juego existente".
router.get('/projects', (_req, res) => {
  res.json(listProjectsForStudents())
})

router.post('/projects', (req, res) => {
  const { title, studentName, fields, promptReadable, promptFull, send } = req.body || {}
  if (!asString(promptFull).trim()) {
    return res.status(400).json({ error: 'Falta el prompt.' })
  }

  const detail = createProject({
    title: asString(title),
    studentName: asString(studentName),
    fields: fields && typeof fields === 'object' ? fields : {},
    promptReadable: asString(promptReadable),
    promptFull: asString(promptFull),
    send: Boolean(send)
  })

  broadcastProject(detail.project.id)
  res.status(201).json(detail)
})

router.get('/projects/:id', (req, res) => {
  const detail = getProjectDetail(req.params.id)
  if (!detail) return res.status(404).json({ error: 'Proyecto no encontrado.' })
  res.json(detail)
})

router.post('/projects/:id/iterations', (req, res) => {
  const { fields, promptReadable, promptFull, send } = req.body || {}
  if (!asString(promptFull).trim()) {
    return res.status(400).json({ error: 'Falta el prompt.' })
  }

  const detail = addIteration(req.params.id, {
    fields: fields && typeof fields === 'object' ? fields : {},
    promptReadable: asString(promptReadable),
    promptFull: asString(promptFull),
    send: Boolean(send)
  })
  if (!detail) return res.status(404).json({ error: 'Proyecto no encontrado.' })

  broadcastProject(req.params.id)
  res.status(201).json(detail)
})

// "Ya lo copie pero igual lo quiero mandar": no crea una version nueva.
router.post('/iterations/:id/send', (req, res) => {
  const projectId = markIterationSent(req.params.id)
  if (!projectId) return res.status(404).json({ error: 'Iteracion no encontrada.' })

  broadcastProject(projectId)
  res.json(getProjectDetail(projectId))
})

/* --------------------------------------------------------------- profesor */

router.get('/dashboard', (_req, res) => {
  res.json(listDashboard())
})

router.patch('/projects/:id', (req, res) => {
  const { title, studentName, teacherName, aiChatUrl, teacherNote, status } = req.body || {}
  const projectId = updateProject(req.params.id, {
    title,
    studentName,
    teacherName,
    aiChatUrl,
    teacherNote,
    status
  })
  if (!projectId) return res.status(404).json({ error: 'Proyecto no encontrado.' })

  broadcastProject(projectId)
  res.json(getProjectDetail(projectId))
})

// Guardar / corregir el codigo de cualquier iteracion (profe o alumno).
router.put('/iterations/:id/code', (req, res) => {
  const { html, css, js, publishedBy } = req.body || {}
  const projectId = saveIterationCode(req.params.id, {
    html: asString(html),
    css: asString(css),
    js: asString(js),
    publishedBy: asString(publishedBy)
  })
  if (!projectId) return res.status(404).json({ error: 'Iteracion no encontrada.' })

  broadcastProject(projectId)
  res.json(getProjectDetail(projectId))
})

// Previsualizacion sin persistir: devuelve el mismo documento que veria el alumno.
router.post('/preview', (req, res) => {
  const { html, css, js, title } = req.body || {}
  const parts = { html: asString(html), css: asString(css), js: asString(js), title: asString(title) }
  if (!hasPlayableCode(parts)) return res.json({ document: '' })
  res.json({ document: buildGameDocument(parts) })
})

/* ------------------------------------------------------- juego renderizado */

router.get('/iterations/:id/play', (req, res) => {
  const document = getIterationDocument(req.params.id)
  if (!document) return res.status(404).type('text/plain').send('Todavia no hay un juego cargado.')

  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('Content-Security-Policy', "frame-ancestors 'self'")
  res.send(document)
})

router.get('/iterations/:id/download', (req, res) => {
  const row = getIterationRow(req.params.id)
  const document = getIterationDocument(req.params.id)
  if (!row || !document) return res.status(404).json({ error: 'Iteracion sin codigo.' })

  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="juego-v${row.version}.html"`)
  res.send(document)
})

/* --------------------------------------------------------------- galeria */

router.get('/gallery', (_req, res) => {
  res.json(listGallery())
})

router.use((_req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada.' })
})

export default router
