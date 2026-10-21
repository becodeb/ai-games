import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import ScaledFrame from '../components/ScaledFrame.jsx'
import { playUrl } from '../lib/api.js'

const SANDBOX = 'allow-scripts allow-pointer-lock allow-modals allow-popups allow-downloads'

/** Teclas que mandan los controles tactiles. El juego las recibe como si fueran del teclado. */
const KEYS = {
  up: { key: 'ArrowUp', code: 'ArrowUp', keyCode: 38 },
  down: { key: 'ArrowDown', code: 'ArrowDown', keyCode: 40 },
  left: { key: 'ArrowLeft', code: 'ArrowLeft', keyCode: 37 },
  right: { key: 'ArrowRight', code: 'ArrowRight', keyCode: 39 },
  space: { key: ' ', code: 'Space', keyCode: 32 },
  enter: { key: 'Enter', code: 'Enter', keyCode: 13 }
}

function useMedia(query) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const media = window.matchMedia(query)
    const onChange = () => setMatches(media.matches)
    onChange()
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [query])
  return matches
}

/**
 * Pagina dedicada: el juego ocupa toda la pantalla.
 * En celulares y pantallas chicas se dibuja a 1280x800 y se achica entero (nada recortado),
 * y aparecen flechas y botones tactiles para los juegos que se manejan con teclado.
 */
export default function Play() {
  const { iterationId } = useParams()
  const [params] = useSearchParams()
  const title = params.get('t') || 'Juego'
  const author = params.get('a') || ''
  const projectId = params.get('p') || ''
  const backTo = projectId ? `/galeria#${encodeURIComponent(projectId)}` : '/galeria'

  const playerRef = useRef(null)
  const frameRef = useRef(null)
  const pressedRef = useRef(new Set())
  const [reloadKey, setReloadKey] = useState(0)
  const [controlsChoice, setControlsChoice] = useState(null)
  const [fullscreen, setFullscreen] = useState(false)

  const touch = useMedia('(pointer: coarse)')
  const portrait = useMedia('(orientation: portrait)')
  const roomy = useMedia('(min-width: 1100px) and (min-height: 700px)')
  const showControls = controlsChoice ?? touch

  const sendKey = useCallback((name, down) => {
    const pressed = pressedRef.current
    if (down === pressed.has(name)) return
    if (down) pressed.add(name)
    else pressed.delete(name)
    frameRef.current?.contentWindow?.postMessage({ __steamlab: true, type: 'key', down, ...KEYS[name] }, '*')
  }, [])

  const releaseAll = useCallback(() => {
    for (const name of [...pressedRef.current]) sendKey(name, false)
  }, [sendKey])

  useEffect(() => releaseAll, [releaseAll])
  useEffect(() => {
    if (!showControls) releaseAll()
  }, [showControls, releaseAll])

  useEffect(() => {
    document.title = `${title} · STEAMLAB`
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement || document.webkitFullscreenElement))
    document.addEventListener('fullscreenchange', onChange)
    document.addEventListener('webkitfullscreenchange', onChange)
    return () => {
      document.removeEventListener('fullscreenchange', onChange)
      document.removeEventListener('webkitfullscreenchange', onChange)
    }
  }, [title])

  const canFullscreen = Boolean(document.fullscreenEnabled || document.webkitFullscreenEnabled)

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement || document.webkitFullscreenElement) {
        await (document.exitFullscreen?.() || document.webkitExitFullscreen?.())
        return
      }
      const node = playerRef.current
      await (node.requestFullscreen?.() || node.webkitRequestFullscreen?.())
      // En Android, ya en pantalla completa, se puede girar solo a horizontal.
      await window.screen?.orientation?.lock?.('landscape').catch(() => {})
    } catch {
      /* algunos navegadores no lo permiten: seguimos sin pantalla completa */
    }
  }

  const stacked = showControls && portrait

  return (
    <div className={`player${stacked ? ' player--stacked' : ''}`} ref={playerRef}>
      <div className="player__stage">
        <ScaledFrame
          key={reloadKey}
          frameRef={frameRef}
          src={playUrl(iterationId)}
          title={title}
          sandbox={SANDBOX}
          allow="fullscreen; autoplay; gamepad"
          native={roomy && !touch}
        />
      </div>

      <header className="player__bar">
        <Link className="player__back" to={backTo}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" />
          </svg>
          <span className="player__names">
            <span className="player__title">{title}</span>
            {author ? <span className="player__author">por {author}</span> : <span className="player__author">Volver a la galería</span>}
          </span>
        </Link>
        <div className="player__tools">
          <button type="button" className="player__tool" onClick={() => setReloadKey((k) => k + 1)} aria-label="Reiniciar juego">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 12a8 8 0 1 0 2.4-5.7" />
              <path d="M4 4v5h5" />
            </svg>
          </button>
          <button
            type="button"
            className={`player__tool${showControls ? ' is-on' : ''}`}
            onClick={() => setControlsChoice(!showControls)}
            aria-label={showControls ? 'Ocultar controles' : 'Mostrar controles'}
            aria-pressed={showControls}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="2.5" y="7" width="19" height="10" rx="5" />
              <path d="M7 10.5v3M5.5 12h3" />
              <circle cx="16" cy="11" r="0.9" fill="currentColor" />
              <circle cx="18" cy="13" r="0.9" fill="currentColor" />
            </svg>
          </button>
          {canFullscreen ? (
            <button type="button" className="player__tool" onClick={toggleFullscreen} aria-label={fullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                {fullscreen ? <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" /> : <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />}
              </svg>
            </button>
          ) : null}
        </div>
      </header>

      {stacked && !fullscreen ? <p className="player__hint">Girá el celu para verlo más grande</p> : null}

      {showControls ? <TouchPad send={sendKey} /> : null}
    </div>
  )
}

function TouchPad({ send }) {
  return (
    <div className="pad">
      <div className="pad__dpad">
        <PadButton name="up" label="Arriba" send={send} className="pad__key pad__key--up" icon="M12 6l7 10H5z" />
        <PadButton name="left" label="Izquierda" send={send} className="pad__key pad__key--left" icon="M6 12l10-7v14z" />
        <span className="pad__hub" aria-hidden="true" />
        <PadButton name="right" label="Derecha" send={send} className="pad__key pad__key--right" icon="M18 12L8 5v14z" />
        <PadButton name="down" label="Abajo" send={send} className="pad__key pad__key--down" icon="M12 18L5 8h14z" />
      </div>
      <div className="pad__actions">
        <PadButton name="enter" label="Enter" send={send} className="pad__action pad__action--small" text="ENTER" />
        <PadButton name="space" label="Espacio" send={send} className="pad__action" text="ESPACIO" />
      </div>
    </div>
  )
}

function PadButton({ name, label, send, className, icon, text }) {
  const press = (event) => {
    event.preventDefault()
    event.currentTarget.setPointerCapture?.(event.pointerId)
    send(name, true)
  }
  const release = () => send(name, false)

  return (
    <button
      type="button"
      className={className}
      aria-label={label}
      onPointerDown={press}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={release}
      onContextMenu={(event) => event.preventDefault()}
    >
      {text ? (
        <span>{text}</span>
      ) : (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d={icon} />
        </svg>
      )}
    </button>
  )
}
