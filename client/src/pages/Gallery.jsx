import { useEffect, useMemo, useState } from 'react'
import Layout from '../components/Layout.jsx'
import Modal from '../components/Modal.jsx'
import GameFrame from '../components/GameFrame.jsx'
import { EmptyState, SectionTitle, Spinner } from '../components/ui.jsx'
import { api, playUrl } from '../lib/api.js'
import { subscribe } from '../lib/socket.js'
import { relativeTime } from '../lib/format.js'

export default function Gallery() {
  const [games, setGames] = useState(null)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(null)

  useEffect(() => {
    let alive = true
    api.listGallery().then((data) => alive && setGames(data)).catch(() => alive && setGames([]))
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    return subscribe('subscribe:gallery', undefined, {
      'gallery:sync': (data) => setGames(data)
    })
  }, [])

  const filtered = useMemo(() => {
    const list = games || []
    const term = query.trim().toLowerCase()
    if (!term) return list
    return list.filter(
      (game) => game.title.toLowerCase().includes(term) || (game.studentName || '').toLowerCase().includes(term)
    )
  }, [games, query])

  return (
    <Layout brandTo="/galeria" wide>
      <SectionTitle
        eyebrow="Galeria"
        title="Juegos del taller"
        description="Todos los juegos que ya tienen una version jugable. Se actualiza sola."
        actions={
          <input
            className="input input--search"
            placeholder="Buscar juego o autor"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        }
      />

      {games === null ? <Spinner label="Cargando galeria" /> : null}

      {games !== null && !filtered.length ? (
        <EmptyState
          title="Todavia no hay juegos publicados"
          description="Apenas un profe cargue la primera version jugable, va a aparecer aca."
        />
      ) : null}

      <div className="gallery-grid">
        {filtered.map((game) => (
          <button key={game.iterationId} type="button" className="gallery-card" onClick={() => setActive(game)}>
            <span className="gallery-card__preview" aria-hidden="true">
              <iframe
                className="gallery-card__frame"
                title={`Preview de ${game.title}`}
                src={playUrl(game.iterationId)}
                sandbox="allow-scripts"
                loading="lazy"
                tabIndex={-1}
              />
            </span>
            <span className="gallery-card__body">
              <span className="gallery-card__title">{game.title}</span>
              <span className="gallery-card__meta">{game.studentName || 'Anonimo'}</span>
            </span>
            <span className="gallery-card__foot">
              <span>
                {game.versionCount} {game.versionCount === 1 ? 'version' : 'versiones'}
              </span>
              <span>{relativeTime(game.updatedAt)}</span>
            </span>
          </button>
        ))}
      </div>

      <Modal
        open={Boolean(active)}
        onClose={() => setActive(null)}
        title={active?.title || ''}
        description={active ? `${active.studentName || 'Anonimo'} · version ${active.version}` : ''}
        size="xl"
      >
        {active ? (
          <GameFrame
            iterationId={active.iterationId}
            title={active.title}
            height={520}
            toolbarExtra={
              <a
                className="btn btn--ghost btn--sm"
                href={`/jugar/${active.iterationId}?t=${encodeURIComponent(active.title)}`}
                target="_blank"
                rel="noreferrer"
              >
                Abrir en pestana nueva
              </a>
            }
          />
        ) : null}
      </Modal>
    </Layout>
  )
}
