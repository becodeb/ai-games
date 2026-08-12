import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Layout from '../components/Layout.jsx'
import Modal from '../components/Modal.jsx'
import { Badge, EmptyState, Spinner } from '../components/ui.jsx'
import { api } from '../lib/api.js'
import { PROJECT_STATUS, relativeTime, statusInfo } from '../lib/format.js'
import { getMyProjectIds } from '../lib/storage.js'
import GalleryButton from '../components/GalleryButton.jsx'

export default function StudentHome() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [projects, setProjects] = useState(null)
  const [query, setQuery] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    let alive = true
    setError('')
    api
      .listProjects()
      .then((data) => alive && setProjects(data))
      .catch((err) => alive && setError(err.message))
    return () => {
      alive = false
    }
  }, [open])

  const myIds = useMemo(() => getMyProjectIds(), [open])

  const { mine, others } = useMemo(() => {
    const list = projects || []
    const term = query.trim().toLowerCase()
    const filtered = term
      ? list.filter(
          (p) =>
            p.title.toLowerCase().includes(term) ||
            (p.studentName || '').toLowerCase().includes(term)
        )
      : list
    return {
      mine: filtered.filter((p) => myIds.includes(p.id)),
      others: filtered.filter((p) => !myIds.includes(p.id))
    }
  }, [projects, query, myIds])

  return (
    <Layout actions={<GalleryButton />}>
      <section className="hero">
        <span className="eyebrow">Taller de programacion con IA</span>
        <h1 className="hero__title">
          Escribi bien el pedido.
          <br />
          La IA escribe el juego.
        </h1>
        <p className="hero__lead">
          Vas a armar un pedido claro para una inteligencia artificial, tu profe lo va a ejecutar y en unos minutos vas
          a estar jugando tu propio videojuego hecho con HTML, CSS y JavaScript.
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

        <button type="button" className="choice choice--button" onClick={() => setOpen(true)}>
          <span className="choice__index">02</span>
          <h2 className="choice__title">Continuar un juego existente</h2>
          <p className="choice__text">
            Busca tu juego por titulo y segui desde donde lo dejaste, con todo tu historial.
          </p>
          <span className="choice__cta">Buscar mi juego</span>
        </button>
      </section>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Continuar un juego"
        description="Elegi tu juego de la lista para recuperar tus prompts y tus versiones."
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

        {projects === null && !error ? (
          <Spinner label="Buscando juegos" />
        ) : (
          <div className="project-picker">
            {mine.length ? (
              <>
                <h3 className="project-picker__group">En esta computadora</h3>
                {mine.map((project) => (
                  <ProjectRow key={project.id} project={project} onPick={() => navigate(`/proyecto/${project.id}`)} />
                ))}
              </>
            ) : null}

            {others.length ? (
              <>
                <h3 className="project-picker__group">Todos los juegos del taller</h3>
                {others.map((project) => (
                  <ProjectRow key={project.id} project={project} onPick={() => navigate(`/proyecto/${project.id}`)} />
                ))}
              </>
            ) : null}

            {!mine.length && !others.length ? (
              <EmptyState
                title="No hay juegos todavia"
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
        <span className="project-row__title">{project.title}</span>
        <span className="project-row__meta">
          {project.studentName || 'Sin nombre'} · version {project.currentVersion} · {relativeTime(project.updatedAt)}
        </span>
      </div>
      <Badge tone={status.tone}>{status.label}</Badge>
    </button>
  )
}
