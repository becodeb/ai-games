import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Layout from '../components/Layout.jsx'
import Modal from '../components/Modal.jsx'
import { Badge, EmptyState, Spinner } from '../components/ui.jsx'
import { api } from '../lib/api.js'
import { PROJECT_STATUS, relativeTime, statusInfo } from '../lib/format.js'
import { getMyImageProjectIds, getMyProjectIds } from '../lib/storage.js'
import GalleryButton from '../components/GalleryButton.jsx'
import ImageGalleryButton from '../components/ImageGalleryButton.jsx'

export default function StudentHome() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [games, setGames] = useState(null)
  const [images, setImages] = useState(null)
  const [query, setQuery] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    let alive = true
    setError('')
    Promise.all([api.listProjects(), api.images.listProjects()])
      .then(([gameList, imageList]) => {
        if (!alive) return
        setGames(gameList)
        setImages(imageList)
      })
      .catch((err) => alive && setError(err.message))
    return () => {
      alive = false
    }
  }, [open])

  const myGameIds = useMemo(() => getMyProjectIds(), [open])
  const myImageIds = useMemo(() => getMyImageProjectIds(), [open])

  const groups = useMemo(() => {
    const term = query.trim().toLowerCase()
    const match = (project) =>
      !term ||
      project.title.toLowerCase().includes(term) ||
      (project.studentName || '').toLowerCase().includes(term)

    const gameList = (games || []).filter(match)
    const imageList = (images || []).filter(match)

    return {
      mine: [
        ...gameList.filter((p) => myGameIds.includes(p.id)).map((p) => ({ ...p, kind: 'game' })),
        ...imageList.filter((p) => myImageIds.includes(p.id)).map((p) => ({ ...p, kind: 'image' }))
      ],
      games: gameList.filter((p) => !myGameIds.includes(p.id)),
      images: imageList.filter((p) => !myImageIds.includes(p.id))
    }
  }, [games, images, query, myGameIds, myImageIds])

  const goTo = (project) =>
    navigate(project.kind === 'image' ? `/imagen/${project.id}` : `/proyecto/${project.id}`)

  const nothing = !groups.mine.length && !groups.games.length && !groups.images.length

  return (
    <Layout
      actions={
        <>
          <GalleryButton />
          <ImageGalleryButton />
        </>
      }
    >
      <section className="hero">
        <span className="eyebrow">Taller de creacion con IA</span>
        <h1 className="hero__title">
          Escribi bien el pedido.
          <br />
          La IA lo crea.
        </h1>
        <p className="hero__lead">
          Vas a armar un pedido claro para una inteligencia artificial, tu profe lo va a ejecutar y en unos minutos vas
          a tener tu propio videojuego o tus propias imagenes.
        </p>
      </section>

      <section className="choice-grid">
        <Link className="choice" to="/nuevo">
          <span className="choice__index">01</span>
          <h2 className="choice__title">Crear nuevo juego</h2>
          <p className="choice__text">
            Completa los campos, mira como se arma tu pedido y mandaselo a los profes.
          </p>
          <span className="choice__cta">Empezar</span>
        </Link>

        <Link className="choice" to="/nueva-imagen">
          <span className="choice__index">02</span>
          <h2 className="choice__title">Crear una imagen</h2>
          <p className="choice__text">
            Conta con tus palabras que imagen queres, adjunta referencias y recibi 4 opciones para elegir.
          </p>
          <span className="choice__cta">Empezar</span>
        </Link>

        <button type="button" className="choice choice--button" onClick={() => setOpen(true)}>
          <span className="choice__index">03</span>
          <h2 className="choice__title">Continuar un proyecto</h2>
          <p className="choice__text">
            Busca tu juego o tu imagen y segui desde donde lo dejaste, con todo tu historial.
          </p>
          <span className="choice__cta">Buscar el mio</span>
        </button>
      </section>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Continuar un proyecto"
        description="Elegi tu juego o tu imagen para recuperar tus pedidos y tus versiones."
        size="lg"
      >
        <input
          className="input"
          placeholder="Buscar por titulo o nombre"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          autoFocus
        />

        {error ? <p className="alert alert--error">{error}</p> : null}

        {games === null && images === null && !error ? (
          <Spinner label="Buscando proyectos" />
        ) : (
          <div className="project-picker">
            {groups.mine.length ? (
              <>
                <h3 className="project-picker__group">En esta computadora</h3>
                {groups.mine.map((project) => (
                  <ProjectRow key={`${project.kind}-${project.id}`} project={project} onPick={() => goTo(project)} />
                ))}
              </>
            ) : null}

            {groups.games.length ? (
              <>
                <h3 className="project-picker__group">Juegos del taller</h3>
                {groups.games.map((project) => (
                  <ProjectRow
                    key={`game-${project.id}`}
                    project={{ ...project, kind: 'game' }}
                    onPick={() => navigate(`/proyecto/${project.id}`)}
                  />
                ))}
              </>
            ) : null}

            {groups.images.length ? (
              <>
                <h3 className="project-picker__group">Imagenes del taller</h3>
                {groups.images.map((project) => (
                  <ProjectRow
                    key={`image-${project.id}`}
                    project={{ ...project, kind: 'image' }}
                    onPick={() => navigate(`/imagen/${project.id}`)}
                  />
                ))}
              </>
            ) : null}

            {nothing ? (
              <EmptyState
                title="No hay proyectos todavia"
                description="Cuando alguien cree el primero, va a aparecer aca."
              />
            ) : null}
          </div>
        )}
      </Modal>
    </Layout>
  )
}

function ProjectRow({ project, onPick }) {
  const status = statusInfo(PROJECT_STATUS, project.status)
  return (
    <button type="button" className="project-row" onClick={onPick}>
      <div className="project-row__main">
        <span className="project-row__title">
          <span className={`kind-tag kind-tag--${project.kind}`}>
            {project.kind === 'image' ? 'imagen' : 'juego'}
          </span>
          {project.title}
        </span>
        <span className="project-row__meta">
          {project.studentName || 'Sin nombre'} · version {project.currentVersion} · {relativeTime(project.updatedAt)}
        </span>
      </div>
      <Badge tone={status.tone}>{status.label}</Badge>
    </button>
  )
}
