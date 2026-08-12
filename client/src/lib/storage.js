/** Memoria local del navegador del alumno: sus proyectos y su nombre. */

const KEY_PROJECTS = 'steamlab:my-projects'
const KEY_NAME = 'steamlab:student-name'

function safeRead(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function safeWrite(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* modo incognito o storage lleno: seguimos sin persistir */
  }
}

export function getMyProjectIds() {
  const value = safeRead(KEY_PROJECTS, [])
  return Array.isArray(value) ? value.filter((id) => typeof id === 'string') : []
}

export function rememberProject(id) {
  if (!id) return
  const ids = getMyProjectIds().filter((existing) => existing !== id)
  ids.unshift(id)
  safeWrite(KEY_PROJECTS, ids.slice(0, 30))
}

export function getStudentName() {
  const value = safeRead(KEY_NAME, '')
  return typeof value === 'string' ? value : ''
}

export function setStudentName(name) {
  safeWrite(KEY_NAME, String(name || ''))
}
