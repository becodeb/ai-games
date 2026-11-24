import fs from 'node:fs'

import { CLIENT_DIST, createApp } from './app.js'
import { broadcastGallery } from './lib/realtime.js'
import { getIterationDocument, listGallery } from './lib/store.js'
import { enqueueThumbnail, onThumbnailReady, thumbnailsEnabled } from './lib/thumbnails.js'
import { ai } from './lib/ai/index.js'

const PORT = Number(process.env.PORT || 3000)
const HOST = process.env.HOST || '0.0.0.0'

const { server, io } = createApp()

// Cada miniatura nueva le llega a la galeria abierta; agrupadas para no mandar 40 listas seguidas.
let galleryTimer = null
onThumbnailReady(() => {
  clearTimeout(galleryTimer)
  galleryTimer = setTimeout(broadcastGallery, 1500)
})

// Al arrancar se completan las fotos que falten (juegos viejos o publicados con el server caido).
if (thumbnailsEnabled) {
  for (const game of listGallery()) {
    if (!game.thumbUrl) enqueueThumbnail(game.iterationId, () => getIterationDocument(game.iterationId))
  }
} else {
  console.log('[steamlab] sin navegador para miniaturas: la galeria usa la preview viva')
}

// Lo que quedo generando antes de un corte vuelve a la cola (maximo 2 intentos).
ai.start()
console.log(`[steamlab] IA: ${ai.status().enabled ? `activada (${ai.status().model})` : 'desactivada (sin ANTHROPIC_API_KEY)'}`)

server.listen(PORT, HOST, () => {
  console.log(`[steamlab] escuchando en http://${HOST}:${PORT}`)
  console.log(`[steamlab] cliente: ${fs.existsSync(CLIENT_DIST) ? CLIENT_DIST : 'no compilado (modo dev)'}`)
})

function shutdown(signal) {
  console.log(`[steamlab] ${signal} recibido, cerrando...`)
  ai.stop()
  io.close()
  server.close(() => process.exit(0))
  setTimeout(() => process.exit(0), 5000).unref()
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
