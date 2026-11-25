import { getProjectDetail, listDashboard, listGallery } from './store.js'
import { latestAttemptStatus, projectOfIteration } from './ai/attempts.js'
import { getImageProjectDetail, listImageDashboard, listImageGallery } from './image-store.js'

let io = null

export const rooms = {
  project: (id) => `project:${id}`,
  dashboard: 'dashboard',
  teachers: 'teachers',
  gallery: 'gallery',
  imageProject: (id) => `image-project:${id}`,
  imageDashboard: 'image-dashboard',
  imageGallery: 'image-gallery'
}

export function attachIo(instance) {
  io = instance

  io.on('connection', (socket) => {
    socket.on('subscribe:project', (projectId) => {
      if (typeof projectId !== 'string' || !projectId) return
      socket.join(rooms.project(projectId))
      const detail = getProjectDetail(projectId)
      if (detail) socket.emit('project:sync', detail)
    })

    socket.on('subscribe:dashboard', () => {
      socket.join(rooms.dashboard)
      socket.emit('dashboard:sync', listDashboard())
    })

    // Sala solo de profes: recibe los avisos de la IA (sin codigo). Los alumnos nunca se suscriben.
    socket.on('subscribe:teacher', () => {
      socket.join(rooms.teachers)
    })

    socket.on('subscribe:gallery', () => {
      socket.join(rooms.gallery)
      socket.emit('gallery:sync', listGallery())
    })

    /* ------------------------------------------------ taller de imagenes */

    socket.on('subscribe:image-project', (projectId) => {
      if (typeof projectId !== 'string' || !projectId) return
      socket.join(rooms.imageProject(projectId))
      const detail = getImageProjectDetail(projectId)
      if (detail) socket.emit('image-project:sync', detail)
    })

    socket.on('subscribe:image-dashboard', () => {
      socket.join(rooms.imageDashboard)
      socket.emit('image-dashboard:sync', listImageDashboard())
    })

    socket.on('subscribe:image-gallery', () => {
      socket.join(rooms.imageGallery)
      socket.emit('image-gallery:sync', listImageGallery())
    })

    socket.on('unsubscribe', (room) => {
      if (typeof room === 'string' && room) socket.leave(room)
    })
  })
}

/** Empuja el estado nuevo del proyecto a alumnos, profes, dashboard y galeria. */
export function broadcastProject(projectId) {
  if (!io || !projectId) return

  const detail = getProjectDetail(projectId)
  if (detail) io.to(rooms.project(projectId)).emit('project:sync', detail)

  io.to(rooms.dashboard).emit('dashboard:sync', listDashboard())
  io.to(rooms.gallery).emit('gallery:sync', listGallery())
}

/** Cambio de estado de un intento de la IA: aviso liviano a los profes y lista del dashboard al dia. */
export function broadcastAi(iterationId) {
  if (!io) return
  const projectId = projectOfIteration(iterationId)
  if (!projectId) return
  io.to(rooms.teachers).emit('ai:changed', { projectId, iterationId, status: latestAttemptStatus(iterationId) })
  io.to(rooms.dashboard).emit('dashboard:sync', listDashboard())
  // El alumno ve la fase de la IA (en cola / armando / lista para revisar).
  const detail = getProjectDetail(projectId)
  if (detail) io.to(rooms.project(projectId)).emit('project:sync', detail)
}

/** Solo la galeria (p. ej. cuando termina de generarse una miniatura). */
export function broadcastGallery() {
  if (!io) return
  io.to(rooms.gallery).emit('gallery:sync', listGallery())
}

/** Lo mismo para el taller de imagenes. */
export function broadcastImageProject(projectId) {
  if (!io || !projectId) return

  const detail = getImageProjectDetail(projectId)
  if (detail) io.to(rooms.imageProject(projectId)).emit('image-project:sync', detail)

  io.to(rooms.imageDashboard).emit('image-dashboard:sync', listImageDashboard())
  io.to(rooms.imageGallery).emit('image-gallery:sync', listImageGallery())
}
