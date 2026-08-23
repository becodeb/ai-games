/**
 * Tema de la interfaz. La app abre oscura siempre: es la direccion visual.
 * El claro existe para aulas con proyector o mucha luz y se recuerda por navegador.
 *
 * El tema se aplica en index.html antes de pintar, asi que aca solo se cambia.
 */

const KEY = 'steamlab:theme'
export const DEFAULT_THEME = 'dark'

export function getTheme() {
  try {
    const stored = window.localStorage.getItem(KEY)
    return stored === 'light' || stored === 'dark' ? stored : DEFAULT_THEME
  } catch {
    return DEFAULT_THEME
  }
}

export function applyTheme(theme) {
  const value = theme === 'light' ? 'light' : 'dark'
  document.documentElement.setAttribute('data-theme', value)
  try {
    window.localStorage.setItem(KEY, value)
  } catch {
    /* modo incognito: vale para esta sesion nomas */
  }
  return value
}
