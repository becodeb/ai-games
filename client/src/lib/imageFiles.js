/**
 * Lectura de archivos de imagen en el navegador.
 * Viajan al servidor como data URL adentro del JSON, asi no hace falta multipart.
 * Antes de mandarlas las achicamos si son enormes: la foto de un celular puede
 * pesar 10 MB y en la pantalla se ve exactamente igual con 1600 px de lado.
 */

export const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']
export const ACCEPT_ATTR = 'image/png,image/jpeg,image/webp,image/gif'

/** Techo duro del servidor, por archivo. */
export const MAX_BYTES = 8 * 1024 * 1024

/** A partir de aca conviene reencodear antes de mandar. */
const SHRINK_OVER_BYTES = 1.5 * 1024 * 1024

const REFERENCE_MAX_SIDE = 1400
const RESULT_MAX_SIDE = 1920

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error(`No pudimos leer ${file.name}`))
    reader.readAsDataURL(file)
  })
}

function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('El archivo no parece una imagen'))
    image.src = dataUrl
  })
}

/** Reencodea a JPG limitando el lado mas largo. Devuelve null si no hace falta. */
async function shrink(dataUrl, maxSide) {
  const image = await loadImage(dataUrl)
  const longest = Math.max(image.width, image.height)
  const scale = longest > maxSide ? maxSide / longest : 1

  const canvas = document.createElement('canvas')
  canvas.width = Math.round(image.width * scale)
  canvas.height = Math.round(image.height * scale)

  const context = canvas.getContext('2d')
  if (!context) return null
  context.drawImage(image, 0, 0, canvas.width, canvas.height)

  return canvas.toDataURL('image/jpeg', 0.9)
}

/**
 * Un archivo -> { name, dataUrl } listo para el POST.
 * `kind` decide cuanto se puede achicar: las referencias son solo para mirar,
 * los resultados son la obra final y se cuidan mas.
 */
export async function fileToPayload(file, kind = 'reference') {
  if (!file) throw new Error('Archivo vacio')
  if (!ACCEPTED_TYPES.includes(file.type)) {
    throw new Error(`${file.name}: solo PNG, JPG, WEBP o GIF`)
  }

  const dataUrl = await readAsDataUrl(file)
  const maxSide = kind === 'result' ? RESULT_MAX_SIDE : REFERENCE_MAX_SIDE

  // Los GIF se mandan tal cual: pasarlos por canvas les come la animacion.
  const needsShrink = file.type !== 'image/gif' && (file.size > SHRINK_OVER_BYTES || kind === 'reference')

  if (needsShrink) {
    try {
      const smaller = await shrink(dataUrl, maxSide)
      if (smaller && smaller.length < dataUrl.length) {
        return { name: file.name, dataUrl: smaller }
      }
    } catch {
      /* si el canvas falla mandamos el original */
    }
  }

  if (file.size > MAX_BYTES) {
    throw new Error(`${file.name} pesa demasiado (maximo 8 MB)`)
  }
  return { name: file.name, dataUrl }
}

/** Varios archivos en paralelo, respetando el limite de la tanda. */
export async function filesToPayloads(files, { kind = 'reference', limit = 4 } = {}) {
  const list = Array.from(files || []).slice(0, limit)
  return Promise.all(list.map((file) => fileToPayload(file, kind)))
}

export function prettyBytes(bytes) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
