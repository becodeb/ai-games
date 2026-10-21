/**
 * Prolijidad para mostrar en la galeria lo que escribieron los chicos
 * ("fermin weiss" -> "Fermin Weiss", "el minecraft" -> "El minecraft").
 * No toca la base: solo cambia como se ve.
 */

const SMALL_WORDS = new Set(['y', 'e', 'o', 'u', 'de', 'del', 'la', 'las', 'el', 'los', 'con'])

const TONES = ['#C8F55A', '#7DD3FC', '#F9A8D4', '#FCD34D', '#A5B4FC', '#5EEAD4', '#FDBA74']

function tidy(value) {
  return String(value || '').replace(/\s+/g, ' ').trim()
}

function capitalize(word) {
  return word ? word.charAt(0).toLocaleUpperCase('es') + word.slice(1) : word
}

export function gameTitle(raw) {
  const text = tidy(raw)
  return text ? capitalize(text) : 'Sin título'
}

export function authorName(raw) {
  const text = tidy(raw)
  if (!text) return 'Anónimo'
  // Si ya usaron mayusculas ("Bauti y los chicos") se respeta tal cual lo escribieron.
  if (text !== text.toLowerCase()) return text
  return text
    .split(' ')
    .map((word, index) => (index > 0 && SMALL_WORDS.has(word.toLowerCase()) ? word.toLowerCase() : capitalize(word)))
    .join(' ')
}

export function initialOf(name) {
  const match = tidy(name).match(/[\p{L}\p{N}]/u)
  return match ? match[0].toLocaleUpperCase('es') : '?'
}

/** Color estable por nombre, para el circulito del autor. */
export function toneOf(name) {
  let hash = 0
  for (const char of tidy(name).toLowerCase()) hash = (hash * 31 + char.codePointAt(0)) | 0
  return TONES[Math.abs(hash) % TONES.length]
}

/** Link a la pantalla de juego con lo necesario para mostrar titulo, autor y volver al mismo juego. */
export function playHref(game) {
  const params = new URLSearchParams({
    t: gameTitle(game.title),
    a: authorName(game.studentName),
    p: game.projectId
  })
  return `/jugar/${game.iterationId}?${params}`
}
