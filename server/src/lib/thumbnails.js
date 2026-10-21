/**
 * Miniaturas de la galeria.
 *
 * Cada juego se abre en un Chromium headless con una ventana de compu (1280x800) y se le saca
 * una foto a los pocos segundos. Asi la galeria muestra el juego completo, como se ve en una
 * compu, en vez de un iframe vivo achicado al tamano de la tarjeta (que recortaba todo y en el
 * celular era carisimo: un juego corriendo por tarjeta).
 *
 * Las fotos viven en <data>/thumbs/<iterationId>.webp. Se generan de a una, en segundo plano:
 * al publicar o corregir un juego, y al arrancar para los que todavia no tienen.
 * Sin navegador disponible no pasa nada: la galeria cae a la preview viva.
 */
import fs from 'node:fs'
import path from 'node:path'

const DATA_ROOT = process.env.DATABASE_PATH
  ? path.dirname(path.resolve(process.env.DATABASE_PATH))
  : path.resolve(process.cwd(), 'data')

export const THUMBS_DIR = path.join(DATA_ROOT, 'thumbs')
fs.mkdirSync(THUMBS_DIR, { recursive: true })

const VIEWPORT = { width: 1280, height: 800, deviceScaleFactor: 0.75 }
/** Tiempo que se deja correr el juego antes de la foto (pantallas de inicio, animaciones). */
const SETTLE_MS = 2500
const JOB_TIMEOUT_MS = 20000
const IDLE_CLOSE_MS = 30000
const MAX_ATTEMPTS = 2

const BROWSER_CANDIDATES = [
  process.env.THUMBS_BROWSER,
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/usr/bin/google-chrome',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
].filter(Boolean)

const executablePath = process.env.THUMBS_DISABLED === '1' ? null : BROWSER_CANDIDATES.find((p) => fs.existsSync(p))

const queue = []
const queued = new Set()
const attempts = new Map()
let running = false
let browser = null
let idleTimer = null
let onReady = () => {}

export const thumbnailsEnabled = Boolean(executablePath)

function thumbPath(iterationId) {
  // Los ids son nanoid ([A-Za-z0-9_-]): igual filtramos para no salir nunca de la carpeta.
  return path.join(THUMBS_DIR, `${String(iterationId).replace(/[^A-Za-z0-9_-]/g, '')}.webp`)
}

/** Version de la miniatura (su mtime) o null si todavia no existe. Sirve para romper la cache. */
export function thumbnailVersion(iterationId) {
  try {
    return Math.round(fs.statSync(thumbPath(iterationId)).mtimeMs)
  } catch {
    return null
  }
}

export function thumbnailFile(iterationId) {
  const file = thumbPath(iterationId)
  return fs.existsSync(file) ? file : null
}

/** Se llama cada vez que una miniatura queda lista (para avisarle a la galeria). */
export function onThumbnailReady(callback) {
  onReady = callback
}

/**
 * Encola la foto de una iteracion. `getDocument` se resuelve recien al sacarla,
 * asi siempre se fotografia el codigo vigente.
 * @param {string} iterationId
 * @param {() => string|null} getDocument
 * @param {{force?: boolean}} [options] force: rehacerla aunque ya exista (codigo corregido)
 */
export function enqueueThumbnail(iterationId, getDocument, { force = false } = {}) {
  if (!thumbnailsEnabled || !iterationId) return
  if (force) {
    attempts.delete(iterationId)
  } else if (thumbnailFile(iterationId) || (attempts.get(iterationId) || 0) >= MAX_ATTEMPTS) {
    return
  }
  if (queued.has(iterationId)) return
  queued.add(iterationId)
  queue.push({ iterationId, getDocument })
  drain()
}

async function drain() {
  if (running) return
  running = true
  clearTimeout(idleTimer)
  try {
    while (queue.length) {
      const job = queue.shift()
      queued.delete(job.iterationId)
      const document = job.getDocument()
      if (!document) continue
      try {
        await withTimeout(capture(job.iterationId, document), JOB_TIMEOUT_MS)
        attempts.delete(job.iterationId)
        onReady(job.iterationId)
      } catch (error) {
        attempts.set(job.iterationId, (attempts.get(job.iterationId) || 0) + 1)
        console.warn(`[thumbs] no se pudo capturar ${job.iterationId}: ${error.message}`)
        // Un juego colgado puede dejar el navegador trabado: lo reiniciamos para el siguiente.
        await closeBrowser()
      }
    }
  } finally {
    running = false
    idleTimer = setTimeout(closeBrowser, IDLE_CLOSE_MS)
    idleTimer.unref?.()
  }
}

async function getBrowser() {
  if (browser && browser.connected) return browser
  const { default: puppeteer } = await import('puppeteer-core')
  browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--mute-audio',
      '--hide-scrollbars',
      '--no-first-run',
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader'
    ]
  })
  return browser
}

async function closeBrowser() {
  const current = browser
  browser = null
  if (!current) return
  try {
    await withTimeout(current.close(), 5000)
  } catch {
    current.process()?.kill('SIGKILL')
  }
}

async function capture(iterationId, document) {
  const instance = await getBrowser()
  const page = await instance.newPage()
  try {
    await page.setViewport(VIEWPORT)
    // El juego es codigo no confiable: no puede salir a la red ni pegarle a la API.
    await page.setRequestInterception(true)
    page.on('request', (request) => {
      const url = request.url()
      if (url.startsWith('data:') || url.startsWith('blob:') || url === 'about:blank') request.continue()
      else request.abort()
    })
    page.on('dialog', (dialog) => dialog.dismiss().catch(() => {}))

    await page.setContent(document, { waitUntil: 'load', timeout: 10000 })
    await new Promise((resolve) => setTimeout(resolve, SETTLE_MS))

    const image = await page.screenshot({ type: 'webp', quality: 80 })
    const file = thumbPath(iterationId)
    fs.writeFileSync(`${file}.tmp`, image)
    fs.renameSync(`${file}.tmp`, file)
  } finally {
    await page.close().catch(() => {})
  }
}

function withTimeout(promise, ms) {
  let timer
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`tardo mas de ${ms} ms`)), ms)
    })
  ]).finally(() => clearTimeout(timer))
}
