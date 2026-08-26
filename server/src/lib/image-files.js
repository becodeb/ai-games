/**
 * Guardado de imagenes en disco, al lado de la base.
 * Los archivos viven en <data>/images/<id>.<ext> y se sirven por /api/images/file/:id.
 * El cliente los manda como data URL (base64) para no sumar dependencias de multipart.
 */
import fs from 'node:fs'
import path from 'node:path'
import { newId } from '../db.js'

const DATA_ROOT = process.env.DATABASE_PATH
  ? path.dirname(path.resolve(process.env.DATABASE_PATH))
  : path.resolve(process.cwd(), 'data')

export const IMAGES_DIR = path.join(DATA_ROOT, 'images')
fs.mkdirSync(IMAGES_DIR, { recursive: true })

const EXTENSIONS = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'image/gif': '.gif'
}

export const ALLOWED_MIME = Object.keys(EXTENSIONS)
/** Por archivo. El cliente ya achica lo que se pasa, esto es el techo duro. */
export const MAX_BYTES = 8 * 1024 * 1024

const DATA_URL = /^data:(image\/[a-z0-9.+-]+);base64,([\s\S]+)$/i

/** data URL -> { mime, buffer }. Devuelve null si no es una imagen valida. */
export function decodeDataUrl(value) {
  if (typeof value !== 'string') return null
  const match = value.match(DATA_URL)
  if (!match) return null

  const mime = match[1].toLowerCase()
  if (!ALLOWED_MIME.includes(mime)) return null

  const buffer = Buffer.from(match[2].replace(/\s/g, ''), 'base64')
  if (!buffer.length || buffer.length > MAX_BYTES) return null

  return { mime, buffer }
}

/** Escribe el archivo y devuelve el nombre relativo con el que se guarda en la base. */
export function writeImage({ mime, buffer }) {
  const id = newId()
  const filename = `${id}${EXTENSIONS[mime] || '.png'}`
  fs.writeFileSync(path.join(IMAGES_DIR, filename), buffer)
  return { id, filename, bytes: buffer.length }
}

/** Ruta absoluta de un archivo guardado. Nunca acepta rutas de afuera del directorio. */
export function imagePath(storagePath) {
  const safe = path.basename(String(storagePath || ''))
  if (!safe) return null
  const full = path.join(IMAGES_DIR, safe)
  return fs.existsSync(full) ? full : null
}

export function removeImage(storagePath) {
  const full = imagePath(storagePath)
  if (!full) return
  try {
    fs.unlinkSync(full)
  } catch {
    /* si ya no esta, seguimos */
  }
}
