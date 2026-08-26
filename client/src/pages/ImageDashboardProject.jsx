import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Layout from '../components/Layout.jsx'
import NameModal from '../components/NameModal.jsx'
import ImageAttachments from '../components/ImageAttachments.jsx'
import ImageResults from '../components/ImageResults.jsx'
import { Badge, EmptyState, PromptBlock, Spinner } from '../components/ui.jsx'
import { useToast } from '../components/Toast.jsx'
import { api, imageDownloadUrl } from '../lib/api.js'
import { subscribe } from '../lib/socket.js'
import {
  IMAGE_REQUEST_STATUS,
  PROJECT_STATUS,
  clockTime,
  copyToClipboard,
  relativeTime,
  statusInfo
} from '../lib/format.js'
import { getTeacherName, setTeacherName } from '../lib/teacher.js'
import { buildImageRestartContext, previousWithResults } from '../lib/imageSummary.js'

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pendiente' },
  { value: 'processing', label: 'En proceso' },
  { value: 'completed', label: 'Completado' },
  { value: 'draft', label: 'Borrador' }
]

export default function ImageDashboardProject() {
  const { id } = useParams()
  const toast = useToast()

  const [detail, setDetail] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [selectedId, setSelectedId] = useState(null)
  const [uploads, setUploads] = useState([])
  const [saving, setSaving] = useState(false)
  const [aiUrl, setAiUrl] = useState('')
  const [aiUrlDirty, setAiUrlDirty] = useState(false)
  const [me, setMe] = useState(() => getTeacherName())
  const [askName, setAskName] = useState(() => !getTeacherName())

  /* ------------------------------------------------------------- carga */

  useEffect(() => {
    let alive = true
    setDetail(null)
    setLoadError('')
    api.images
      .getProject(id)
      .then((data) => alive && setDetail(data))
      .catch((err) => alive && setLoadError(err.message))
    return () => {
      alive = false
    }
  }, [id])

  useEffect(() => {
    return subscribe('subscribe:image-project', id, {
      'image-project:sync': (data) => {
        if (data?.project?.id === id) setDetail(data)
      }
    })
  }, [id])

  const requests = detail?.requests || []
  const project = detail?.project

  /* ------------------------------------------- tomar el proyecto al abrir */

  const claimedRef = useRef(false)
  useEffect(() => {
    if (!project || !me || claimedRef.current) return
    if (project.status !== 'pending') return

    claimedRef.current = true
    api.images
      .patchProject(id, { status: 'processing', teacherName: me })
      .then(setDetail)
      .catch(() => {
        claimedRef.current = false
      })
  }, [project, me, id])

  // Seleccion por defecto: el primer pedido pendiente, si no el ultimo.
  useEffect(() => {
    if (!requests.length) return
    if (requests.some((request) => request.id === selectedId)) return
    const pending = requests.find((request) => request.status === 'pending')
    setSelectedId((pending || requests[requests.length - 1]).id)
  }, [requests, selectedId])

  const selected = useMemo(
    () => requests.find((request) => request.id === selectedId) || null,
    [requests, selectedId]
  )

  // Al cambiar de version se limpia lo que habia cargado para no publicarlo donde no va.
  const loadedForRef = useRef(null)
  useEffect(() => {
    if (!selected || loadedForRef.current === selected.id) return
    loadedForRef.current = selected.id
    setUploads([])
  }, [selected])

  useEffect(() => {
    if (!project || aiUrlDirty) return
    setAiUrl(project.aiChatUrl || '')
  }, [project, aiUrlDirty])

  /* --------------------------------------------------------- acciones */

  const allResults = useMemo(() => requests.flatMap((request) => request.results), [requests])
  const baseImage = selected?.baseAssetId
    ? allResults.find((image) => image.id === selected.baseAssetId) || null
    : null
  const baseRequest = useMemo(
    () => (selected ? previousWithResults(requests, selected.version) : null),
    [requests, selected]
  )

  async function copyText(text, message) {
    const ok = await copyToClipboard(text)
    toast(ok ? message : 'No se pudo copiar', ok ? 'ok' : 'error')
  }

  async function publish() {
    if (!selected) return
    if (!uploads.length) {
      toast('Subi al menos una imagen', 'error')
      return
    }
    setSaving(true)
    try {
      const data = await api.images.saveResults(selected.id, {
        results: uploads,
        publishedBy: me || 'teacher'
      })
      setDetail(data)
      setUploads([])
      toast('Enviado al alumno', 'ok')
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  async function patch(payload, message) {
    try {
      const data = await api.images.patchProject(id, payload)
      setDetail(data)
      if (message) toast(message, 'ok')
    } catch (err) {
      toast(err.message, 'error')
    }
  }

  /* ----------------------------------------------------------- render */

  if (loadError) {
    return (
      <Layout tagline="imagenes con IA" brandTo="/dashboard-imagenes" wide>
        <EmptyState
          title="Proyecto no encontrado"
          description={loadError}
          action={
            <Link className="btn btn--primary" to="/dashboard-imagenes">
              Volver al panel
            </Link>
          }
        />
      </Layout>
    )
  }

  if (!detail) {
    return (
      <Layout tagline="imagenes con IA" brandTo="/dashboard-imagenes" wide>
        <Spinner label="Cargando proyecto" />
      </Layout>
    )
  }

  const status = statusInfo(PROJECT_STATUS, project.status)
  const takenByOther = project.teacherName && project.teacherName !== me

  return (
    <Layout
      tagline="imagenes con IA"
      brandTo="/dashboard-imagenes"
      wide
      actions={
        <>
          <button type="button" className="btn btn--ghost" onClick={() => setAskName(true)}>
            {me ? `Sos ${me}` : 'Poner mi nombre'}
          </button>
          <Link className="btn btn--ghost" to="/dashboard-imagenes">
            Volver al panel
          </Link>
          <a className="btn btn--ghost" href={`/imagen/${id}`} target="_blank" rel="noreferrer">
            Ver como el alumno
          </a>
        </>
      }
    >
      <header className="project-head">
        <div>
          <span className="eyebrow">Pedido de imagen</span>
          <h1>{project.title}</h1>
          <p className="project-head__meta">
            {project.studentName || 'Sin nombre'} · {requests.length} versiones · actualizado{' '}
            {relativeTime(project.updatedAt)}
          </p>
        </div>
        <div className="project-head__controls">
          {project.teacherName ? (
            <Badge tone={takenByOther ? 'warn' : 'info'}>
              {takenByOther ? `Lo tiene ${project.teacherName}` : 'Lo tenes vos'}
            </Badge>
          ) : null}
          {takenByOther ? (
            <button
              type="button"
              className="btn btn--sm"
              onClick={() => patch({ teacherName: me }, 'Proyecto tomado')}
            >
              Tomarlo yo
            </button>
          ) : null}
          <Badge tone={status.tone}>{status.label}</Badge>
          <div className="select-wrap select-wrap--compact">
            <select
              className="input input--select"
              value={project.status}
              onChange={(event) => patch({ status: event.target.value }, 'Estado actualizado')}
              aria-label="Estado del proyecto"
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </header>

      <div className="teacher-bar">
        <label className="field field--inline">
          <span className="field__label">Enlace del chat de la IA (solo profes)</span>
          <input
            className="input"
            type="url"
            placeholder="https://gemini.google.com/app/..."
            value={aiUrl}
            onChange={(event) => {
              setAiUrlDirty(true)
              setAiUrl(event.target.value)
            }}
          />
        </label>
        <button
          type="button"
          className="btn"
          onClick={() => {
            setAiUrlDirty(false)
            patch({ aiChatUrl: aiUrl }, 'Enlace guardado')
          }}
        >
          Guardar enlace
        </button>
        {project.aiChatUrl ? (
          <a className="btn btn--ghost" href={project.aiChatUrl} target="_blank" rel="noreferrer">
            Abrir chat
          </a>
        ) : null}
      </div>

      <div className="workspace">
        {/* -------------------------------------------- columna izquierda */}
        <section className="workspace__col">
          <div className="version-list">
            {requests.map((request) => (
              <button
                key={request.id}
                type="button"
                className={`version-chip${request.id === selectedId ? ' version-chip--active' : ''}${
                  request.status === 'pending' ? ' version-chip--pending' : ''
                }`}
                onClick={() => setSelectedId(request.id)}
                title={statusInfo(IMAGE_REQUEST_STATUS, request.status).label}
              >
                v{request.version}
              </button>
            ))}
          </div>

          {selected ? (
            <>
              <div className="card">
                <div className="card__head">
                  <h3>
                    {selected.kind === 'initial' ? 'Pedido inicial' : `Correccion pedida (v${selected.version})`}
                  </h3>
                  <div className="card__head-actions">
                    <span className="muted">{clockTime(selected.createdAt)}</span>
                    <Badge tone={statusInfo(IMAGE_REQUEST_STATUS, selected.status).tone}>
                      {statusInfo(IMAGE_REQUEST_STATUS, selected.status).label}
                    </Badge>
                  </div>
                </div>

                <button
                  type="button"
                  className="btn btn--primary btn--block btn--lg"
                  onClick={() => copyText(selected.promptFull, 'Prompt copiado, pegalo en la IA')}
                >
                  Copiar prompt para la IA
                </button>

                <PromptBlock text={selected.promptFull} label="Prompt completo (con reglas tecnicas)" />
              </div>

              {baseImage ? (
                <div className="card">
                  <div className="card__head">
                    <h3>Imagen que eligio el alumno</h3>
                    <a className="btn btn--ghost btn--sm" href={imageDownloadUrl(baseImage.id)} download>
                      Descargar para adjuntarla
                    </a>
                  </div>
                  <p className="note">
                    Descargala y adjuntala en el chat de la IA junto con el prompt: es el punto de partida de esta
                    correccion.
                  </p>
                  <ImageResults images={[baseImage]} title={project.title} label="Punto de partida" />
                </div>
              ) : null}

              {selected.references.length ? (
                <div className="card">
                  <div className="card__head">
                    <h3>Referencias que adjunto el alumno</h3>
                    <span className="muted">{selected.references.length} archivo(s)</span>
                  </div>
                  <ImageResults images={selected.references} title="Referencia" label="Referencia" />
                </div>
              ) : null}

              <div className="card">
                <div className="card__head">
                  <h3>Si se corto la conversacion</h3>
                  <span className="muted">
                    {baseRequest ? `Base: v${baseRequest.version}` : 'Sin version previa'} · incluye el nuevo pedido
                  </span>
                </div>
                <div className="actions actions--tight">
                  <button
                    type="button"
                    className="btn btn--sm"
                    onClick={() =>
                      copyText(
                        buildImageRestartContext(project, requests, {
                          upToVersion: selected.version,
                          newPrompt: selected.promptFull
                        }),
                        'Historial + nuevo pedido copiado'
                      )
                    }
                  >
                    Copiar historial + nuevo pedido
                  </button>
                </div>
                <p className="note">
                  Las imagenes no se copian como texto: adjunta la que eligio el alumno en el chat nuevo.
                </p>
              </div>

              {selected.hasResults ? (
                <div className="card">
                  <div className="card__head">
                    <h3>Version entregada</h3>
                    <div className="card__head-actions">
                      {selected.publishedBy === 'student' ? (
                        <Badge>Las subio el alumno</Badge>
                      ) : selected.publishedBy && selected.publishedBy !== 'teacher' ? (
                        <Badge>Las hizo {selected.publishedBy}</Badge>
                      ) : null}
                    </div>
                  </div>
                  <ImageResults images={selected.results} title={project.title} />
                </div>
              ) : null}
            </>
          ) : (
            <EmptyState title="Este proyecto no tiene pedidos" />
          )}
        </section>

        {/* --------------------------------------------- columna derecha */}
        <section className="workspace__col">
          <div className="card">
            <div className="card__head">
              <h3>Respuesta de la IA</h3>
              <span className="muted">4 imagenes por pedido</span>
            </div>

            <ImageAttachments
              items={uploads}
              onChange={setUploads}
              max={4}
              kind="result"
              label="Subi las imagenes generadas"
              hint="PNG, JPG o WEBP. Si subis menos de 4 tambien se puede entregar."
              disabled={saving}
            />

            <div className="actions actions--between">
              <button type="button" className="btn btn--ghost" onClick={() => setUploads([])} disabled={saving}>
                Limpiar
              </button>
              <button
                type="button"
                className="btn btn--primary btn--lg"
                onClick={publish}
                disabled={saving || !uploads.length}
              >
                {selected?.hasResults ? 'Reemplazar y actualizar al alumno' : 'Aprobar y enviar al alumno'}
              </button>
            </div>

            {selected?.hasResults ? (
              <p className="note note--warn">
                Esta version ya tiene imagenes entregadas: si publicas de nuevo, reemplazan a las anteriores.
              </p>
            ) : null}
          </div>

          <div className="card">
            <div className="card__head">
              <h3>Previsualizacion</h3>
              <span className="muted">Asi las va a ver el alumno</span>
            </div>
            {uploads.length ? (
              <div className="shots shots--grid">
                {uploads.map((item, index) => (
                  <figure className="shot" key={`${item.name}-${index}`}>
                    <span className="shot__frame">
                      <img src={item.dataUrl} alt={item.name || `Opcion ${index + 1}`} />
                    </span>
                    <figcaption className="shot__foot">
                      <span className="shot__index">Opcion {index + 1}</span>
                    </figcaption>
                  </figure>
                ))}
              </div>
            ) : (
              <EmptyState title="Sin imagenes" description="Subi lo que te devolvio la IA para verlo aca." />
            )}
          </div>
        </section>
      </div>

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
