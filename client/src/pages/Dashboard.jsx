import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Layout from '../components/Layout.jsx'
import NameModal from '../components/NameModal.jsx'
import { Badge, EmptyState, SectionTitle, Spinner } from '../components/ui.jsx'
import { api } from '../lib/api.js'
import { subscribe } from '../lib/socket.js'
import { PROJECT_STATUS, relativeTime, statusInfo } from '../lib/format.js'
import { getTeacherName, setTeacherName } from '../lib/teacher.js'

const FILTERS = [
  { value: 'all', label: 'Todos' },
  { value: 'pending', label: 'Pendientes' },
  { value: 'processing', label: 'En proceso' },
  { value: 'completed', label: 'Completados' }
]

export default function Dashboard() {
  const [projects, setProjects] = useState(null)
  const [filter, setFilter] = useState('all')
  const [query, setQuery] = useState('')
  const [me, setMe] = useState(() => getTeacherName())
  const [askName, setAskName] = useState(() => !getTeacherName())

  useEffect(() => {
    let alive = true
    api.listDashboard().then((data) => alive && setProjects(data)).catch(() => alive && setProjects([]))
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    return subscribe('subscribe:dashboard', undefined, {
      'dashboard:sync': (data) => setProjects(data)
    })
  }, [])

  const { pending, rest, counts } = useMemo(() => {
    const list = projects || []
    const term = query.trim().toLowerCase()

    const matches = list.filter((project) => {
      const byFilter = filter === 'all' || project.status === filter
      const byTerm =
        !term ||
        project.title.toLowerCase().includes(term) ||
        (project.studentName || '').toLowerCase().includes(term)
      return byFilter && byTerm
    })

    return {
      pending: matches.filter((p) => p.status === 'pending'),
      rest: matches.filter((p) => p.status !== 'pending'),
      counts: {
        all: list.length,
        pending: list.filter((p) => p.status === 'pending').length,
        processing: list.filter((p) => p.status === 'processing').length,
        completed: list.filter((p) => p.status === 'completed').length
      }
    }
  }, [projects, filter, query])

  return (
    <Layout
      brandTo="/dashboard"
      wide
      actions={
        <>
          <button type="button" className="btn btn--ghost" onClick={() => setAskName(true)}>
            {me ? `Sos ${me}` : 'Poner mi nombre'}
          </button>
          <a className="btn btn--ghost" href="/galeria" target="_blank" rel="noreferrer">
            Galeria
          </a>
          <Link className="btn btn--ghost" to="/">
            Vista de alumno
          </Link>
        </>
      }
    >
      <SectionTitle
        eyebrow="Panel del profesor"
        title="Proyectos del taller"
        description="Los pedidos pendientes aparecen primero. Al abrir uno queda tomado a tu nombre."
      />

      <div className="toolbar">
        <div className="tabs">
          {FILTERS.map((item) => (
            <button
              key={item.value}
              type="button"
              className={`tab${filter === item.value ? ' tab--active' : ''}`}
              onClick={() => setFilter(item.value)}
            >
              {item.label}
              <span className="tab__count">{counts[item.value] ?? 0}</span>
            </button>
          ))}
        </div>
        <input
          className="input input--search"
          placeholder="Buscar por juego o alumno"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      {projects === null ? <Spinner label="Cargando proyectos" /> : null}

      {projects !== null && !pending.length && !rest.length ? (
        <EmptyState title="Nada por aca" description="Cuando los chicos envien sus pedidos, van a aparecer en esta lista." />
      ) : null}

      {pending.length ? (
        <>
          <h3 className="group-title group-title--warn">Esperando respuesta ({pending.length})</h3>
          <div className="card-grid">
            {pending.map((project) => (
              <ProjectCard key={project.id} project={project} me={me} highlight />
            ))}
          </div>
        </>
      ) : null}

      {rest.length ? (
        <>
          <h3 className="group-title">Resto de los proyectos</h3>
          <div className="card-grid">
            {rest.map((project) => (
              <ProjectCard key={project.id} project={project} me={me} />
            ))}
          </div>
        </>
      ) : null}

      <NameModal
        open={askName}
        current={me}
        onSave={(name) => {
          setTeacherName(name)
          setMe(name)
          setAskName(false)
        }}
        onClose={me ? () => setAskName(false) : undefined}
      />
    </Layout>
  )
}

function ProjectCard({ project, me, highlight = false }) {
  const status = statusInfo(PROJECT_STATUS, project.status)
  const takenByOther = project.teacherName && project.teacherName !== me

  return (
    <Link className={`project-card${highlight ? ' project-card--highlight' : ''}`} to={`/dashboard/${project.id}`}>
      <div className="project-card__head">
        <h4>{project.title}</h4>
        <Badge tone={status.tone}>{status.label}</Badge>
      </div>
      <p className="project-card__student">{project.studentName || 'Sin nombre'}</p>
      <p className="project-card__preview">{project.lastPromptPreview || 'Sin prompt'}</p>
      <div className="project-card__foot">
        <span>
          Version {project.currentVersion} · {project.deliveredCount} jugables
        </span>
        <span>{relativeTime(project.updatedAt)}</span>
      </div>
      {project.teacherName ? (
        <span className={`project-card__flag${takenByOther ? ' project-card__flag--other' : ''}`}>
          {takenByOther ? `Lo tiene ${project.teacherName}` : 'Lo tenes vos'}
        </span>
      ) : null}
    </Link>
  )
}
