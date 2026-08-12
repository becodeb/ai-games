import { useCallback, useEffect, useRef, useState } from 'react'
import { playUrl } from '../lib/api.js'

const SANDBOX = 'allow-scripts allow-pointer-lock allow-modals allow-popups allow-downloads'

/**
 * Render de un juego dentro de un iframe aislado.
 * Puede mostrar una iteracion guardada (`iterationId`) o un borrador (`srcDoc`).
 */
export default function GameFrame({
  iterationId,
  srcDoc,
  title = 'Juego',
  height = 480,
  onErrorChange,
  toolbarExtra
}) {
  const containerRef = useRef(null)
  const frameRef = useRef(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [error, setError] = useState(null)
  const [fullscreen, setFullscreen] = useState(false)

  // Guardamos el callback en un ref para que su identidad no dispare efectos.
  const notifyRef = useRef(onErrorChange)
  notifyRef.current = onErrorChange

  useEffect(() => {
    setError(null)
    notifyRef.current?.(null)
  }, [iterationId, srcDoc, reloadKey])

  useEffect(() => {
    function onMessage(event) {
      const data = event.data
      if (!data || data.__steamlab !== true) return
      if (frameRef.current && event.source !== frameRef.current.contentWindow) return

      if (data.type === 'game-error') {
        const text = [data.message, data.line ? `(linea ${data.line})` : ''].filter(Boolean).join(' ')
        setError(text)
        notifyRef.current?.(text)
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  useEffect(() => {
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  const toggleFullscreen = useCallback(async () => {
    const node = containerRef.current
    if (!node) return
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen()
      } else if (node.requestFullscreen) {
        await node.requestFullscreen()
      } else if (node.webkitRequestFullscreen) {
        node.webkitRequestFullscreen()
      }
    } catch {
      /* algunos navegadores lo bloquean: no rompemos la vista */
    }
  }, [])

  const source = srcDoc !== undefined ? { srcDoc } : { src: `${playUrl(iterationId)}?v=${reloadKey}` }

  return (
    <div className={`game${fullscreen ? ' game--fullscreen' : ''}`} ref={containerRef}>
      <div className="game__toolbar">
        <span className="game__label">{title}</span>
        <div className="game__actions">
          {toolbarExtra}
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => setReloadKey((k) => k + 1)}>
            Reiniciar
          </button>
          <button type="button" className="btn btn--sm" onClick={toggleFullscreen}>
            {fullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
          </button>
        </div>
      </div>

      <div className="game__stage" style={fullscreen ? undefined : { height }}>
        <iframe
          key={reloadKey}
          ref={frameRef}
          className="game__frame"
          title={title}
          sandbox={SANDBOX}
          allow="fullscreen; autoplay; gamepad"
          allowFullScreen
          {...source}
        />
      </div>

      {error ? (
        <div className="game__error">
          <strong>Se detecto un error:</strong> <span>{error}</span>
        </div>
      ) : null}
    </div>
  )
}
