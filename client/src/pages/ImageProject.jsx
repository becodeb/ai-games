import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Layout from '../components/Layout.jsx'
import ImageGalleryButton from '../components/ImageGalleryButton.jsx'
import ImageResults from '../components/ImageResults.jsx'
import ImageFixForm from '../components/ImageFixForm.jsx'
import ImageDrop from '../components/ImageDrop.jsx'
import { Badge, EmptyState, PromptBlock, Spinner } from '../components/ui.jsx'
import { useToast } from '../components/Toast.jsx'
import { api } from '../lib/api.js'
import { subscribe } from '../lib/socket.js'
import { IMAGE_REQUEST_STATUS, PROJECT_STATUS, clockTime, copyToClipboard, statusInfo } from '../lib/format.js'
import { rememberImageProject } from '../lib/storage.js'

export default function ImageProject() {
  const { id } = useParams()
  const toast = useToast()
  const [detail, setDetail] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [chosenId, setChosenId] = useState('')
  const [openDrop, setOpenDrop] = useState({})

  useEffect(() => {
    let alive = true
    setDetail(null)
    setError('')
    api.images
      .getProject(id)
      .then((data) => {
        if (!alive) return
        setDetail(data)
        rememberImageProject(id)
      })
      .catch((err) => alive && setError(err.message))
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
  const last = requests[requests.length - 1]

  // Todas las imagenes entregadas, para poder resolver cual eligio en cada version.
  const allResults = useMemo(() => requests.flatMap((request) => request.results), [requests])
  const lastResults = useMemo(() => {
    for (let index = requests.length - 1; index >= 0; index -= 1) {
      if (requests[index].results.length) return requests[index].results
    }
    return []
  }, [requests])

  // Por defecto queda elegida la primera opcion de la ultima tanda.
  useEffect(() => {
    if (!lastResults.length) return
    setChosenId((current) => (lastResults.some((image) => image.id === current) ? current : lastResults[0].id))
  }, [lastResults])

  const chosen = allResults.find((image) => image.id === chosenId) || null

  async function copyPrompt(request) {
    const ok = await copyToClipboard(request.promptFull)
    if (ok) setOpenDrop((current) => ({ ...current, [request.id]: true }))
    toast(ok ? 'Prompt copiado' : 'No se pudo copiar, seleccionalo a mano', ok ? 'ok' : 'error')
  }

  async function sendExisting(request) {
    setBusy(true)
    try {
      const data = await api.images.sendRequest(request.id)
      setDetail(data)
      toast('Enviado a los profes', 'ok')
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  async function submitFix({ promptText, readable, full, references, baseAssetId, send }, reset) {
    setBusy(true)
    try {
      let copied = false
      if (!send) copied = await copyToClipboard(full)

      const data = await api.images.addRequest(id, {
        promptText,
        promptReadable: readable,
        promptFull: full,
        references,
        baseAssetId,
        send
      })
      setDetail(data)
      reset()
      toast(send ? 'Enviado a los profes' : copied ? 'Prompt copiado' : 'Guardado (copialo a mano)', 'ok')
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  if (error) {
    return (
      <Layout tagline="imagenes con IA" actions={<ImageGalleryButton />}>
        <EmptyState
          title="No encontramos esa imagen"
          description={error}
          action={
            <Link className="btn btn--primary" to="/">
              Volver al inicio
            </Link>
          }
        />
      </Layout>
    )
  }

  if (!detail) {
    return (
      <Layout tagline="imagenes con IA" actions={<ImageGalleryButton />}>
        <Spinner label="Cargando tu imagen" />
      </Layout>
    )
  }

  const { project } = detail
  const status = statusInfo(PROJECT_STATUS, project.status)
  const waitingForTeacher = last?.status === 'pending'

  return (
    <Layout
      tagline="imagenes con IA"
      actions={
        <>
          <Link className="btn btn--ghost" to="/">
            Cambiar de proyecto
          </Link>
          <ImageGalleryButton />
        </>
      }
    >
      <header className="project-head">
        <div>
          <span className="eyebrow">Tu imagen</span>
          <h1>{project.title}</h1>
          <p className="project-head__meta">
            {project.studentName || 'Sin nombre'} · {requests.length}{' '}
            {requests.length === 1 ? 'pedido' : 'pedidos'}
            {project.teacherName ? ` · lo esta viendo ${project.teacherName}` : ''}
          </p>
        </div>
        <Badge tone={status.tone}>{status.label}</Badge>
      </header>

      <ol className="timeline">
        {requests.map((request) => {
          const isLast = request.id === last?.id
          const dropOpen = openDrop[request.id] ?? (isLast && request.status === 'copied')
          const base = request.baseAssetId
            ? allResults.find((image) => image.id === request.baseAssetId)
            : null

          return (
            <li className="timeline__item" key={request.id}>
              <div className="timeline__marker">
                <span>v{request.version}</span>
              </div>

              <div className="timeline__content">
                <div className="card">
                  <div className="card__head">
                    <h3>
                      {request.kind === 'initial' ? 'Pedido inicial' : `Correccion pedida (v${request.version})`}
                    </h3>
                    <div className="card__head-actions">
                      <span className="muted">{clockTime(request.createdAt)}</span>
                      <Badge tone={statusInfo(IMAGE_REQUEST_STATUS, request.status).tone}>
                        {statusInfo(IMAGE_REQUEST_STATUS, request.status).label}
                      </Badge>
                    </div>
                  </div>

                  <PromptBlock text={request.promptReadable} label="Lo que le pediste a la IA" />

                  {base ? (
                    <div className="chosen chosen--compact">
                      <img className="chosen__thumb" src={base.url} alt="Imagen de partida" />
                      <span className="muted">Partiste de esta imagen de la version anterior.</span>
                    </div>
                  ) : null}

                  {request.references.length ? (
                    <div className="refs">
                      <span className="field__label">Referencias que adjuntaste</span>
                      <div className="refs__grid">
                        {request.references.map((reference) => (
                          <img key={reference.id} src={reference.url} alt={reference.filename || 'Referencia'} />
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div className="actions actions--tight">
                    <button type="button" className="btn btn--sm" onClick={() => copyPrompt(request)}>
                      Copiar prompt
                    </button>
                    {request.status === 'copied' ? (
                      <button
                        type="button"
                        className="btn btn--sm btn--primary"
                        onClick={() => sendExisting(request)}
                        disabled={busy}
                      >
                        Enviar a los profes
                      </button>
                    ) : null}
                    {!request.hasResults && !dropOpen ? (
                      <button
                        type="button"
                        className="link-button"
                        onClick={() => setOpenDrop((current) => ({ ...current, [request.id]: true }))}
                      >
                        Ya tengo las imagenes de la IA
                      </button>
                    ) : null}
                  </div>
                </div>

                {request.hasResults ? (
                  <div className="card">
                    <div className="card__head">
                      <h3>Las 4 imagenes de la version {request.version}</h3>
                      <span className="muted">Toca una para verla en grande</span>
                    </div>
                    <ImageResults
                      images={request.results}
                      selectedId={chosenId}
                      onSelect={setChosenId}
                      title={project.title}
                    />
                  </div>
                ) : request.status === 'pending' ? (
                  <div className="waiting">
                    <span className="waiting__pulse" aria-hidden="true" />
                    <div>
                      <strong>El profesor esta generando tus imagenes...</strong>
                      <p>No cierres la pagina. Cuando esten listas aparecen aca solas, sin recargar.</p>
                    </div>
                  </div>
                ) : null}

                {!request.hasResults && dropOpen ? (
                  <ImageDrop requestId={request.id} onSaved={setDetail} />
                ) : null}
              </div>
            </li>
          )
        })}
      </ol>

      {waitingForTeacher ? (
        <div className="waiting waiting--muted">
          <div>
            <strong>Ya enviaste tu pedido</strong>
            <p>
              Cuando el profe suba estas imagenes vas a poder pedir correcciones nuevas. Si las generaste vos, subilas
              arriba y se desbloquea solo.
            </p>
          </div>
        </div>
      ) : (
        <ImageFixForm
          version={last ? last.version : 1}
          busy={busy}
          chosen={chosen}
          needsChoice={lastResults.length > 0}
          onSubmit={submitFix}
        />
      )}
    </Layout>
  )
}
