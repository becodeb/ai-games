/** Quien esta usando el panel en esta computadora. */

const KEY = 'steamlab:teacher-name'

export function getTeacherName() {
  try {
    return window.localStorage.getItem(KEY) || ''
  } catch {
    return ''
  }
}

export function setTeacherName(name) {
  try {
    const value = String(name || '').trim()
    if (value) window.localStorage.setItem(KEY, value)
    else window.localStorage.removeItem(KEY)
  } catch {
    /* modo incognito: seguimos sin persistir */
  }
}
