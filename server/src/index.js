import http from 'node:http'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import express from 'express'
import compression from 'compression'
import { Server as SocketServer } from 'socket.io'

import { attachIo } from './lib/realtime.js'
import apiRouter from './routes/api.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const PORT = Number(process.env.PORT || 3000)
const HOST = process.env.HOST || '0.0.0.0'
const CLIENT_DIST = process.env.CLIENT_DIST
  ? path.resolve(process.env.CLIENT_DIST)
  : path.resolve(__dirname, '../../client/dist')

const app = express()
app.set('trust proxy', 1)
app.disable('x-powered-by')
app.use(compression())
app.use(express.json({ limit: '8mb' }))

app.use('/api', apiRouter)

if (fs.existsSync(CLIENT_DIST)) {
  app.use(
    express.static(CLIENT_DIST, {
      index: false,
      setHeaders: (res, filePath) => {
        if (filePath.includes(`${path.sep}assets${path.sep}`)) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
        }
      }
    })
  )

  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next()
    res.setHeader('Cache-Control', 'no-store')
    res.sendFile(path.join(CLIENT_DIST, 'index.html'))
  })
} else {
  app.get('/', (_req, res) => {
    res.status(503).type('text/plain').send(
      'El build del cliente no esta disponible. Ejecuta "npm run build" o levanta el cliente con "npm run dev".'
    )
  })
}

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error('[error]', err)
  res.status(err.status || 500).json({ error: err.message || 'Error interno' })
})

const server = http.createServer(app)
const io = new SocketServer(server, {
  cors: { origin: true, credentials: true },
  path: '/socket.io'
})
attachIo(io)

server.listen(PORT, HOST, () => {
  console.log(`[steamlab] escuchando en http://${HOST}:${PORT}`)
  console.log(`[steamlab] cliente: ${fs.existsSync(CLIENT_DIST) ? CLIENT_DIST : 'no compilado (modo dev)'}`)
})

function shutdown(signal) {
  console.log(`[steamlab] ${signal} recibido, cerrando...`)
  io.close()
  server.close(() => process.exit(0))
  setTimeout(() => process.exit(0), 5000).unref()
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
