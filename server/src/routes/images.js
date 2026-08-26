import { Router } from 'express'
import fs from 'node:fs'
import {
  addImageRequest,
  createImageProject,
  getAssetRow,
  getImageProjectDetail,
  listImageDashboard,
  listImageGallery,
  listImageProjectsForStudents,
  markRequestSent,
  saveRequestResults,
  updateImageProject
} from '../lib/image-store.js'
import { imagePath } from '../lib/image-files.js'
import { broadcastImageProject } from '../lib/realtime.js'

const router = Router()

function asString(value) {
  return typeof value === 'string' ? value : ''
}

function asList(value) {
  return Array.isArray(value) ? value : []
}

/* ---------------------------------------------------------- archivos */

// Las imagenes guardadas en el volumen de datos. Se sirven por id, nunca por ruta.
router.get('/file/:assetId', (req, res) => {
  const asset = getAssetRow(req.params.assetId)
  const full = asset ? imagePath(asset.storage_path) : null
  if (!full) return res.status(404).type('text/plain').send('Imagen no encontrada.')

  res.setHeader('Content-Type', asset.mime || 'image/png')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  // El id es unico por archivo: nunca cambia el contenido de una misma URL.
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
  fs.createReadStream(full).pipe(res)
})

router.get('/file/:assetId/download', (req, res) => {
  const asset = getAssetRow(req.params.assetId)
  const full = asset ? imagePath(asset.storage_path) : null
  if (!full) return res.status(404).json({ error: 'Imagen no encontrada.' })

  const name = (asset.filename || `imagen-${asset.id}`).replace(/[^\w.\- ]+/g, '_')
  res.setHeader('Content-Type', asset.mime || 'image/png')
  res.setHeader('Content-Disposition', `attachment; filename="${name}"`)
  fs.createReadStream(full).pipe(res)
})

/* ------------------------------------------------------------ alumno */

router.get('/projects', (_req, res) => {
  res.json(listImageProjectsForStudents())
})

router.post('/projects', (req, res) => {
  const { title, studentName, promptText, promptReadable, promptFull, references, send } = req.body || {}
  if (!asString(promptText).trim()) {
    return res.status(400).json({ error: 'Falta contar que imagen queres.' })
  }

  const detail = createImageProject({
    title: asString(title),
    studentName: asString(studentName),
    promptText: asString(promptText),
    promptReadable: asString(promptReadable),
    promptFull: asString(promptFull),
    references: asList(references),
    send: Boolean(send)
  })

  broadcastImageProject(detail.project.id)
  res.status(201).json(detail)
})

router.get('/projects/:id', (req, res) => {
  const detail = getImageProjectDetail(req.params.id)
  if (!detail) return res.status(404).json({ error: 'Proyecto no encontrado.' })
  res.json(detail)
})

router.post('/projects/:id/requests', (req, res) => {
  const { promptText, promptReadable, promptFull, references, baseAssetId, send } = req.body || {}
  if (!asString(promptText).trim()) {
    return res.status(400).json({ error: 'Falta contar que hay que corregir.' })
  }

  const detail = addImageRequest(req.params.id, {
    promptText: asString(promptText),
    promptReadable: asString(promptReadable),
    promptFull: asString(promptFull),
    references: asList(references),
    baseAssetId: asString(baseAssetId),
    send: Boolean(send)
  })
  if (!detail) return res.status(404).json({ error: 'Proyecto no encontrado.' })

  broadcastImageProject(req.params.id)
  res.status(201).json(detail)
})

// "Copie el prompt y despues igual lo quiero mandar": no crea una version nueva.
router.post('/requests/:id/send', (req, res) => {
  const projectId = markRequestSent(req.params.id)
  if (!projectId) return res.status(404).json({ error: 'Pedido no encontrado.' })

  broadcastImageProject(projectId)
  res.json(getImageProjectDetail(projectId))
})

/* ---------------------------------------------------------- profesor */

router.get('/dashboard', (_req, res) => {
  res.json(listImageDashboard())
})

router.patch('/projects/:id', (req, res) => {
  const { title, studentName, teacherName, aiChatUrl, teacherNote, status } = req.body || {}
  const projectId = updateImageProject(req.params.id, {
    title,
    studentName,
    teacherName,
    aiChatUrl,
    teacherNote,
    status
  })
  if (!projectId) return res.status(404).json({ error: 'Proyecto no encontrado.' })

  broadcastImageProject(projectId)
  res.json(getImageProjectDetail(projectId))
})

// Entregar (o corregir) la tanda de imagenes de un pedido.
router.put('/requests/:id/results', (req, res) => {
  const { results, publishedBy } = req.body || {}
  const outcome = saveRequestResults(req.params.id, {
    results: asList(results),
    publishedBy: asString(publishedBy)
  })
  if (!outcome) return res.status(404).json({ error: 'Pedido no encontrado.' })
  if (!outcome.saved) {
    return res.status(400).json({ error: 'No pudimos leer ninguna imagen. Proba con PNG, JPG o WEBP de hasta 8 MB.' })
  }

  broadcastImageProject(outcome.projectId)
  res.json(getImageProjectDetail(outcome.projectId))
})

/* ---------------------------------------------------------- galeria */

router.get('/gallery', (_req, res) => {
  res.json(listImageGallery())
})

export default router
