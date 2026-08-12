import { io } from 'socket.io-client'

let socket = null

/** Una sola conexion compartida por toda la app. */
export function getSocket() {
  if (!socket) {
    socket = io({
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      reconnectionDelay: 500,
      reconnectionDelayMax: 4000
    })
  }
  return socket
}

/**
 * Se suscribe a una sala y devuelve la funcion de limpieza.
 * Reenvia la suscripcion en cada reconexion para no perder eventos.
 *
 * @param {string} subscribeEvent p.ej. 'subscribe:project'
 * @param {string|undefined} payload id del proyecto, si aplica
 * @param {Record<string, Function>} handlers eventos entrantes
 */
export function subscribe(subscribeEvent, payload, handlers) {
  const s = getSocket()
  const room = roomName(subscribeEvent, payload)

  const send = () => s.emit(subscribeEvent, payload)
  send()
  s.on('connect', send)

  const entries = Object.entries(handlers || {})
  entries.forEach(([event, handler]) => s.on(event, handler))

  return () => {
    s.off('connect', send)
    entries.forEach(([event, handler]) => s.off(event, handler))
    if (room) s.emit('unsubscribe', room)
  }
}

function roomName(subscribeEvent, payload) {
  switch (subscribeEvent) {
    case 'subscribe:project':
      return `project:${payload}`
    case 'subscribe:teacher':
      return `teacher:${payload}`
    case 'subscribe:dashboard':
      return 'dashboard'
    case 'subscribe:gallery':
      return 'gallery'
    default:
      return null
  }
}
