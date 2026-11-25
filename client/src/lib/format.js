export const PROJECT_STATUS = {
  draft: { label: 'Borrador', tone: 'neutral' },
  pending: { label: 'Pendiente', tone: 'warn' },
  processing: { label: 'En proceso', tone: 'info' },
  completed: { label: 'Completado', tone: 'ok' }
}

export const ITERATION_STATUS = {
  copied: { label: 'Prompt copiado', tone: 'neutral' },
  pending: { label: 'Esperando al profe', tone: 'warn' },
  delivered: { label: 'Juego listo', tone: 'ok' }
}

/** Insignia de una version pendiente segun la fase de la IA (`iteration.ai`); sin fase cae al estado normal. */
export function iterationBadge(iteration) {
  const phase = iteration.status === 'pending' ? iteration.ai?.phase : null
  if (phase === 'queued' || phase === 'generating') return { label: 'La IA lo esta armando', tone: 'info' }
  if (phase === 'review') return { label: 'Esperando aprobacion', tone: 'warn' }
  return statusInfo(ITERATION_STATUS, iteration.status)
}

/** Mismo ciclo que las iteraciones de juego, pero lo que llega son imagenes. */
export const IMAGE_REQUEST_STATUS = {
  copied: { label: 'Prompt copiado', tone: 'neutral' },
  pending: { label: 'Esperando al profe', tone: 'warn' },
  delivered: { label: 'Imagenes listas', tone: 'ok' }
}

/** Estado del ultimo intento de la IA (aiStatus del dashboard). `canceled` no muestra nada. */
export const AI_STATUS = {
  queued: { label: 'IA generando', tone: 'info' },
  generating: { label: 'IA generando', tone: 'info' },
  ready: { label: 'Listo para revisar', tone: 'ok' },
  error: { label: 'La IA fallo', tone: 'danger' }
}

export function statusInfo(map, value) {
  return map[value] || { label: value || '—', tone: 'neutral' }
}

export function relativeTime(iso) {
  if (!iso) return ''
  const date = new Date(iso)
  const diff = Date.now() - date.getTime()
  if (Number.isNaN(diff)) return ''

  const minutes = Math.round(diff / 60000)
  if (minutes < 1) return 'recien'
  if (minutes < 60) return `hace ${minutes} min`

  const hours = Math.round(minutes / 60)
  if (hours < 24) return `hace ${hours} h`

  const days = Math.round(hours / 24)
  if (days < 7) return `hace ${days} d`

  return date.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })
}

export function clockTime(iso) {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
}

export async function copyToClipboard(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    /* caemos al metodo viejo */
  }

  try {
    const area = document.createElement('textarea')
    area.value = text
    area.setAttribute('readonly', '')
    area.style.position = 'fixed'
    area.style.opacity = '0'
    document.body.appendChild(area)
    area.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(area)
    return ok
  } catch {
    return false
  }
}
