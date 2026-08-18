import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Layout from '../components/Layout.jsx'
import GalleryButton from '../components/GalleryButton.jsx'
import GameFrame from '../components/GameFrame.jsx'
import IterationForm from '../components/IterationForm.jsx'
import CodeDrop from '../components/CodeDrop.jsx'
import { Badge, EmptyState, PromptBlock, Spinner } from '../components/ui.jsx'
import { useToast } from '../components/Toast.jsx'
import { api } from '../lib/api.js'
import { subscribe } from '../lib/socket.js'
import { ITERATION_STATUS, PROJECT_STATUS, clockTime, copyToClipboard, statusInfo } from '../lib/format.js'
import { rememberProject } from '../lib/storage.js'

export default function StudentProject() {
  const { id } = useParams()
  const toast = useToast()
  const [detail, setDetail] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [gameErrors, setGameErrors] = useState({})
  const [openDrop, setOpenDrop] = useState({})

  useEffect(() => {
    let alive = true
    setDetail(null)
    setError('')
    api
      .getProject(id)
      .then((data) => {
        if (!alive) return
        setDetail(data)
        rememberProject(id)
      })
      .catch((err) => alive && setError(err.message))
    return () => {
      alive = false
    }
  }, [id])

  useEffect(() => {
    return subscribe('subscribe:project', id, {
      'project:sync': (data) => {
        if (data?.project?.id === id) setDetail(data)
      }
    })
  }, [id])

  const trackError = useCallback((iterationId) => {
    return (message) =>
      setGameErrors((current) => {
        if (current[iterationId] === message || (!message && !current[iterationId])) return current
        return { ...current, [iterationId]: message }
      })
  }, [])

  async function copyPrompt(iteration) {
    const ok = await copyToClipboard(iteration.promptFull)
    if (ok) setOpenDrop((current) => ({ ...current, [iteration.id]: true }))
    toast(ok ? 'Prompt copiado' : 'No se pudo copiar, seleccionalo a mano', ok ? 'ok' : 'error')
  }

  async function sendExisting(iteration) {
    setBusy(true)
    try {
      const data = await api.sendIteration(iteration.id)
      setDetail(data)
      toast('Enviado a los profes', 'ok')
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  async function submitIteration({ fields, readable, full, send }, reset) {
    setBusy(true)
    try {
      let copied = false
      if (!send) copied = await copyToClipboard(full)

      const data = await api.addIteration(id, {
        fields,
        promptReadable: readable,
        promptFull: full,
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
      <Layout actions={<GalleryButton />}>
        <EmptyState
          title="No encontramos ese juego"
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
      <Layout actions={<GalleryButton />}>
        <Spinner label="Cargando tu juego" />
      </Layout>
    )
  }

  const { project, iterations } = detail
  const last = iterations[iterations.length - 1]
  const status = statusInfo(PROJECT_STATUS, project.status)
  const lastError = last ? gameErrors[last.id] : null

  return (
    <Layout
      actions={
        <>
          <Link className="btn btn--ghost" to="/">
            Cambiar de juego
          </Link>
          <GalleryButton />
        </>
      }
    >
      <header className="project-head">
        <div>
          <span className="eyebrow">Tu proyecto</span>
          <h1>{project.title}</h1>
          <p className="project-head__meta">
            {project.studentName || 'Sin nombre'} · {iterations.length}{' '}
            {iterations.length === 1 ? 'version' : 'versiones'}
            {project.teacherName ? ` · lo esta viendo ${project.teacherName}` : ''}
          </p>
        </div>
        <Badge tone={status.tone}>{status.label}</Badge>
      </header>

      <ol className="timeline">
        {iterations.map((iteration) => {
          const isLast = iteration.id === last?.id
          const dropOpen = openDrop[iteration.id] ?? (isLast && iteration.status === 'copied')

          return (
            <li className="timeline__item" key={iteration.id}>
              <div className="timeline__marker">
                <span>v{iteration.version}</span>
              </div>

              <div className="timeline__content">
                <div className="card">
                  <div className="card__head">
                    <h3>
                      {iteration.kind === 'initial' ? 'Prompt inicial' : `Cambios pedidos (v${iteration.version})`}
                    </h3>
                    <div className="card__head-actions">
                      <span className="muted">{clockTime(iteration.createdAt)}</span>
                      <Badge tone={statusInfo(ITERATION_STATUS, iteration.status).tone}>
                        {statusInfo(ITERATION_STATUS, iteration.status).label}
                      </Badge>
                    </div>
                  </div>

                  <PromptBlock text={iteration.promptReadable} label="Lo que le pediste a la IA" />

                  <div className="actions actions--tight">
                    <button type="button" className="btn btn--sm" onClick={() => copyPrompt(iteration)}>
                      Copiar prompt
                    </button>
                    {iteration.status === 'copied' ? (
                      <button
                        type="button"
                        className="btn btn--sm btn--primary"
                        onClick={() => sendExisting(iteration)}
                        disabled={busy}
                      >
                        Enviar a los profes
                      </button>
                    ) : null}
                    {!iteration.hasCode && !dropOpen ? (
                      <button
                        type="button"
                        className="link-button"
                        onClick={() => setOpenDrop((current) => ({ ...current, [iteration.id]: true }))}
                      >
                        Ya tengo la respuesta de la IA
                      </button>
                    ) : null}
                  </div>
                </div>

                {iteration.hasCode ? (
                  <GameFrame
                    iterationId={iteration.id}
                    title={`${project.title} — version ${iteration.version}`}
                    height={520}
                    onErrorChange={trackError(iteration.id)}
                  />
                ) : iteration.status === 'pending' ? (
                  <div className="waiting">
                    <span className="waiting__pulse" aria-hidden="true" />
                    <div>
                      <strong>El profesor esta procesando tu juego...</strong>
                      <p>No cierres la pagina. Cuando este listo aparece aca solo, sin recargar.</p>
                    </div>
                  </div>
                ) : null}

                {!iteration.hasCode && dropOpen ? (
                  <CodeDrop
                    iterationId={iteration.id}
                    title={project.title}
                    initialCode={iteration.code?.html || ''}
                    publishedBy="student"
                    onSaved={setDetail}
                  />
                ) : null}
              </div>
            </li>
          )
        })}
      </ol>

      <IterationForm version={last ? last.version : 1} busy={busy} detectedError={lastError} onSubmit={submitIteration} />
    </Layout>
  )
}
