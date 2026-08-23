import { useState } from 'react'
import { applyTheme, getTheme } from '../lib/theme.js'

/** Interruptor de tema. Vive en la barra superior de todas las pantallas. */
export default function ThemeToggle() {
  const [theme, setTheme] = useState(() => getTheme())
  const dark = theme === 'dark'

  return (
    <button
      type="button"
      className="btn btn--ghost btn--icon"
      onClick={() => setTheme(applyTheme(dark ? 'light' : 'dark'))}
      title={dark ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
      aria-label={dark ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
    >
      {dark ? <SunIcon /> : <MoonIcon />}
    </button>
  )
}

function SunIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <circle cx="12" cy="12" r="4.2" />
      <path
        d="M12 2.6v2.2M12 19.2v2.2M4.2 12H2M22 12h-2.2M6.5 6.5L4.9 4.9M19.1 19.1l-1.6-1.6M17.5 6.5l1.6-1.6M4.9 19.1l1.6-1.6"
        strokeLinecap="round"
      />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M20.5 14.3A8.6 8.6 0 0 1 9.7 3.5a8.6 8.6 0 1 0 10.8 10.8Z" strokeLinejoin="round" />
    </svg>
  )
}
