import { useEffect, useMemo, useState } from 'react'
import Layout from '../components/Layout.jsx'
import Modal from '../components/Modal.jsx'
import ImageResults from '../components/ImageResults.jsx'
import { EmptyState, PromptBlock, SectionTitle, Spinner } from '../components/ui.jsx'
import { api } from '../lib/api.js'
import { subscribe } from '../lib/socket.js'
import { relativeTime } from '../lib/format.js'

export default function ImageGallery() {
  const [projects, setProjects] = useState(null)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(null)

  useEffect(() => {
    let alive = true
    api.images
      .listGallery()
      .then((data) => alive && setProjects(data))
      .catch(() => alive && setProjects([]))
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    return subscribe('subscribe:image-gallery', undefined, {
      'image-gallery:sync': (data) => setProjects(data)
    })
  }, [])

  const filtered = useMemo(() => {
    const list = projects || []
    const term = query.trim().toLowerCase()
    if (!term) return list
    return list.filter(
      (item) => item.title.toLowerCase().includes(term) || (item.studentName || '').toLowerCase().includes(term)
    )
  }, [projects, query])

  // El modal se queda con la version fresca cuando entra un sync nuevo.
  const current = active ? filtered.find((item) => item.projectId === active.projectId) || active : null

  return (
    <Layout tagline="imagenes con IA" brandTo="/galeria-imagenes" wide>
      <SectionTitle
        eyebrow="Galeria"
        title="Imagenes del taller"
        description="Todos los pedidos que ya tienen imagenes entregadas. Se actualiza sola."
        actions={
          <input
            className="input input--search"
            placeholder="Buscar imagen o autor"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        }
      />

      {projects === null ? <Spinner label="Cargando galeria" /> : null}

      {projects !== null && !filtered.length ? (
        <EmptyState
          title="Todavia no hay imagenes publicadas"
          description="Apenas un profe entregue la primera tanda, va a aparecer aca."
        />
      ) : null}

      <div className="gallery-grid">
        {filtered.map((item) => (
          <button key={item.projectId} type="button" className="gallery-card" onClick={() => setActive(item)}>
            <span className="gallery-card__preview">
              <img className="gallery-card__image" src={item.images[0]?.url} alt={item.title} loading="lazy" />
            </span>
            <span className="gallery-card__body">
              <span className="gallery-card__title">{item.title}</span>
              <span className="gallery-card__meta">{item.studentName || 'Anonimo'}</span>
            </span>
            <span className="gallery-card__foot">
              <span>
                {item.versionCount} {item.versionCount === 1 ? 'version' : 'versiones'}
              </span>
              <span>{relativeTime(item.updatedAt)}</span>
            </span>
          </button>
        ))}
      </div>

      <Modal
        open={Boolean(current)}
        onClose={() => setActive(null)}
        title={current?.title || ''}
        description={current ? `${current.studentName || 'Anonimo'} · version ${current.version}` : ''}
        size="xl"
      >
        {current ? (
          <div className="gallery-detail">
            <ImageResults images={current.images} title={current.title} />
            <PromptBlock text={current.prompt} label="El pedido que escribio" />
          </div>
        ) : null}
      </Modal>
    </Layout>
  )
}
