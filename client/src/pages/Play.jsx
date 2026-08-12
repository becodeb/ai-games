import { useSearchParams, useParams, Link } from 'react-router-dom'
import { playUrl } from '../lib/api.js'

const SANDBOX = 'allow-scripts allow-pointer-lock allow-modals allow-popups allow-downloads'

/** Pagina dedicada: el juego ocupa toda la ventana. */
export default function Play() {
  const { iterationId } = useParams()
  const [params] = useSearchParams()
  const title = params.get('t') || 'Juego'

  return (
    <div className="play">
      <header className="play__bar">
        <span className="play__title">{title}</span>
        <div className="play__actions">
          <button
            type="button"
            className="btn btn--sm"
            onClick={() => document.documentElement.requestFullscreen?.()}
          >
            Pantalla completa
          </button>
          <Link className="btn btn--ghost btn--sm" to="/galeria">
            Galeria
          </Link>
        </div>
      </header>
      <iframe
        className="play__frame"
        title={title}
        src={playUrl(iterationId)}
        sandbox={SANDBOX}
        allow="fullscreen; autoplay; gamepad"
        allowFullScreen
      />
    </div>
  )
}
