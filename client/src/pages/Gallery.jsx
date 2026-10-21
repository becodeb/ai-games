import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import ScaledFrame from '../components/ScaledFrame.jsx'
import { api, playUrl } from '../lib/api.js'
import { subscribe } from '../lib/socket.js'
import { authorName, gameTitle, initialOf, playHref, toneOf } from '../lib/display.js'

/**
 * Galeria publica pensada para el celular (se entra desde los llaveros NFC):
 * una portada y despues un juego por pantalla, deslizando como en las historias.
 * "Ver todos" abre la grilla completa con buscador.
 */
export default function Gallery() {
  const games = useStableGames()
  const [active, setActive] = useState(0) // 0 = portada, 1..n = juegos
  const [showAll, setShowAll] = useState(false)
  const feedRef = useRef(null)
  const jumpedRef = useRef(false)

  const total = games ? games.length : 0
  const creators = useMemo(
    () => new Set((games || []).map((game) => authorName(game.studentName).toLowerCase())).size,
    [games]
  )

  const goTo = useCallback((index, smooth = true) => {
    const feed = feedRef.current
    if (!feed) return
    feed.scrollTo({ top: index * feed.clientHeight, behavior: smooth ? 'smooth' : 'auto' })
  }, [])

  // Slide visible segun el scroll (el snap lo deja siempre justo en una).
  useEffect(() => {
    const feed = feedRef.current
    if (!feed) return undefined
    let frame = 0
    const onScroll = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => setActive(Math.round(feed.scrollTop / Math.max(feed.clientHeight, 1))))
    }
    feed.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      cancelAnimationFrame(frame)
      feed.removeEventListener('scroll', onScroll)
    }
  }, [])

  // Si se entra con #proyecto (link compartido o "volver" desde el juego) arrancamos ahi.
  useEffect(() => {
    if (!games || jumpedRef.current) return
    jumpedRef.current = true
    const id = decodeURIComponent(window.location.hash.slice(1))
    const index = id ? games.findIndex((game) => game.projectId === id) : -1
    if (index >= 0) requestAnimationFrame(() => goTo(index + 1, false))
  }, [games, goTo])

  // El hash sigue al juego visible, asi un link copiado lleva a ese juego.
  useEffect(() => {
    if (!games || !jumpedRef.current) return
    const game = games[active - 1]
    const url = game ? `#${encodeURIComponent(game.projectId)}` : window.location.pathname
    window.history.replaceState(null, '', url)
  }, [active, games])

  // Flechas del teclado en la compu.
  useEffect(() => {
    const onKey = (event) => {
      if (showAll || event.defaultPrevented) return
      if (event.key === 'ArrowDown' || event.key === 'PageDown') {
        event.preventDefault()
        goTo(Math.min(active + 1, total))
      } else if (event.key === 'ArrowUp' || event.key === 'PageUp') {
        event.preventDefault()
        goTo(Math.max(active - 1, 0))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active, total, showAll, goTo])

  const pickFromGrid = (index) => {
    setShowAll(false)
    requestAnimationFrame(() => goTo(index + 1, false))
  }

  return (
    <div className="stories">
      <div className="stories__feed" ref={feedRef}>
        <Cover games={games} creators={creators} onStart={() => goTo(1)} onShowAll={() => setShowAll(true)} />
        {(games || []).map((game, index) => (
          <Story key={game.projectId} game={game} distance={Math.abs(index + 1 - active)} />
        ))}
      </div>

      <header className="stories__top">
        <div className="stories__progress" aria-hidden="true">
          <span style={{ width: total ? `${(Math.max(active, 0) / total) * 100}%` : 0 }} />
        </div>
        <div className="stories__topbar">
          <span className="stories__brand">
            <span className="stories__mark" aria-hidden="true" />
            STEAMLAB
          </span>
          {active > 0 && total ? (
            <span className="stories__count">
              {String(active).padStart(2, '0')} / {total}
            </span>
          ) : null}
        </div>
      </header>

      <nav className="stories__nav" aria-label="Navegación de la galería">
        <button
          type="button"
          className="stories__round"
          onClick={() => goTo(Math.max(active - 1, 0))}
          disabled={active === 0}
          aria-label="Juego anterior"
        >
          <Chevron dir="up" />
        </button>
        <button type="button" className="stories__all" onClick={() => setShowAll(true)} disabled={!total}>
          <GridIcon />
          Ver todos
        </button>
        <button
          type="button"
          className="stories__round stories__round--solid"
          onClick={() => goTo(Math.min(active + 1, total))}
          disabled={active >= total}
          aria-label="Juego siguiente"
        >
          <Chevron dir="down" />
        </button>
      </nav>

      {showAll ? <AllGames games={games || []} onPick={pickFromGrid} onClose={() => setShowAll(false)} /> : null}
    </div>
  )
}

/**
 * Lista de juegos con orden estable: si se publica uno nuevo mientras alguien esta mirando,
 * no se le mueve el juego que tiene en pantalla. Los nuevos van al final.
 */
function useStableGames() {
  const [games, setGames] = useState(null)
  const orderRef = useRef([])

  const apply = useCallback((list) => {
    const byId = new Map(list.map((game) => [game.projectId, game]))
    const kept = orderRef.current.filter((id) => byId.has(id))
    const fresh = list.map((game) => game.projectId).filter((id) => !kept.includes(id))
    orderRef.current = [...kept, ...fresh]
    setGames(orderRef.current.map((id) => byId.get(id)))
  }, [])

  useEffect(() => {
    let alive = true
    api
      .listGallery()
      .then((data) => alive && apply(data))
      .catch(() => alive && setGames((prev) => prev || []))
    return () => {
      alive = false
    }
  }, [apply])

  useEffect(() => subscribe('subscribe:gallery', undefined, { 'gallery:sync': apply }), [apply])

  return games
}

function Cover({ games, creators, onStart, onShowAll }) {
  const collage = (games || []).filter((game) => game.thumbUrl).slice(0, 6)
  const total = games ? games.length : 0

  return (
    <section className="story story--cover" aria-label="Portada">
      <div className="cover">
        {collage.length >= 3 ? (
          <div className="cover__collage" aria-hidden="true">
            {collage.map((game) => (
              <img key={game.projectId} src={game.thumbUrl} alt="" />
            ))}
          </div>
        ) : null}

        <div className="cover__text">
          <span className="cover__eyebrow">Taller de juegos con IA</span>
          <h1 className="cover__title">Juegos creados por chicos</h1>
          <p className="cover__lead">
            Cada juego lo inventó un alumno del taller y lo programó con inteligencia artificial. Deslizá para
            verlos y tocá <strong>Jugar</strong> para probarlos.
          </p>
          {games === null ? <span className="cover__stats">Cargando juegos...</span> : null}
          {games && total ? (
            <span className="cover__stats">
              {total} juegos · {creators} {creators === 1 ? 'creador' : 'creadores'}
            </span>
          ) : null}
          {games && !total ? (
            <span className="cover__stats">Todavía no hay juegos publicados. Apenas haya uno, aparece acá.</span>
          ) : null}
        </div>

        {total ? (
          <div className="cover__actions">
            <button type="button" className="story__play" onClick={onStart}>
              Empezar
              <Chevron dir="down" />
            </button>
            <button type="button" className="cover__link" onClick={onShowAll}>
              Ver la lista completa
            </button>
          </div>
        ) : null}
      </div>
    </section>
  )
}

function Story({ game, distance }) {
  const title = gameTitle(game.title)
  const author = authorName(game.studentName)
  const [broken, setBroken] = useState(false)
  const showThumb = game.thumbUrl && !broken

  return (
    <section className="story" aria-label={`${title}, de ${author}`}>
      {showThumb && distance <= 1 ? <img className="story__backdrop" src={game.thumbUrl} alt="" aria-hidden="true" /> : null}
      <div className="story__scrim" aria-hidden="true" />

      <div className="story__body">
        <div className="story__media">
          <div className="story__screen">
            {showThumb ? (
              <img
                src={game.thumbUrl}
                alt={`Captura de ${title}`}
                loading={distance <= 2 ? 'eager' : 'lazy'}
                decoding="async"
                onError={() => setBroken(true)}
              />
            ) : distance === 0 ? (
              <ScaledFrame
                src={playUrl(game.iterationId)}
                title={`Vista previa de ${title}`}
                sandbox="allow-scripts"
                interactive={false}
              />
            ) : (
              <span className="story__placeholder" style={{ color: toneOf(author) }}>
                {initialOf(title)}
              </span>
            )}
          </div>
        </div>

        <div className="story__info">
          <h2 className="story__title">{title}</h2>
          <div className="story__meta">
            <span className="avatar" style={{ background: toneOf(author) }} aria-hidden="true">
              {initialOf(author)}
            </span>
            <span className="story__by">
              <span className="story__label">Creado por</span>
              <span className="story__author">{author}</span>
            </span>
            {game.versionCount > 1 ? <span className="story__versions">{game.versionCount} versiones</span> : null}
          </div>
          <Link className="story__play" to={playHref(game)}>
            <PlayIcon />
            Jugar
          </Link>
        </div>
      </div>
    </section>
  )
}

function AllGames({ games, onPick, onClose }) {
  const [query, setQuery] = useState('')
  const closeRef = useRef(null)

  useEffect(() => {
    closeRef.current?.focus()
    const onKey = (event) => event.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const term = query.trim().toLowerCase()
  const items = games
    .map((game, index) => ({ game, index, title: gameTitle(game.title), author: authorName(game.studentName) }))
    .filter((item) => !term || item.title.toLowerCase().includes(term) || item.author.toLowerCase().includes(term))

  return (
    <div className="allgames" role="dialog" aria-modal="true" aria-label="Todos los juegos">
      <div className="allgames__head">
        <div className="allgames__row">
          <h2 className="allgames__title">Todos los juegos</h2>
          <button type="button" className="stories__round" onClick={onClose} aria-label="Cerrar" ref={closeRef}>
            <CloseIcon />
          </button>
        </div>
        <label className="allgames__search">
          <SearchIcon />
          <input
            type="search"
            placeholder="Buscar juego o creador"
            aria-label="Buscar juego o creador"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
      </div>

      {items.length ? (
        <div className="allgames__grid">
          {items.map(({ game, index, title, author }) => (
            <button key={game.projectId} type="button" className="tile" onClick={() => onPick(index)}>
              <span className="tile__screen">
                {game.thumbUrl ? (
                  <img src={game.thumbUrl} alt="" loading="lazy" decoding="async" />
                ) : (
                  <span className="story__placeholder" style={{ color: toneOf(author) }}>
                    {initialOf(title)}
                  </span>
                )}
              </span>
              <span className="tile__title">{title}</span>
              <span className="tile__author">{author}</span>
            </button>
          ))}
        </div>
      ) : (
        <p className="allgames__empty">No hay juegos que coincidan con "{query.trim()}".</p>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ iconos */

function Chevron({ dir }) {
  const d = { up: 'M5 15l7-7 7 7', down: 'M5 9l7 7 7-7' }[dir]
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  )
}

function PlayIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 4.5v15l12-7.5z" fill="currentColor" />
    </svg>
  )
}

function GridIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  )
}

function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  )
}
