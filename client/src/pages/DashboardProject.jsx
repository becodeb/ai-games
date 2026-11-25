import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Layout from '../components/Layout.jsx'
import GameFrame from '../components/GameFrame.jsx'
import NameModal from '../components/NameModal.jsx'
import AiCard from '../components/AiCard.jsx'
import { Badge, EmptyState, PromptBlock, Spinner } from '../components/ui.jsx'
import { useToast } from '../components/Toast.jsx'
import { api, downloadUrl } from '../lib/api.js'
import { subscribe } from '../lib/socket.js'
import {
  ITERATION_STATUS,
  PROJECT_STATUS,
  clockTime,
  copyToClipboard,
  relativeTime,
  statusInfo
} from '../lib/format.js'
import { looksLikeFullDocument, stripCodeFences } from '../lib/code.js'
import { getTeacherName, setTeacherName } from '../lib/teacher.js'
import { buildRestartContext, iterationCodeText, previousWithCode, withNewPrompt } from '../lib/summary.js'

const EMPTY_CODE = { html: '', css: '', js: '' }

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pendiente' },
  { value: 'processing', label: 'En proceso' },
  { value: 'completed', label: 'Completado' },
  { value: 'draft', label: 'Borrador' }
]

export default function DashboardProject() {
  const { id } = useParams()
  const toast = useToast()

  const [detail, setDetail] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [selectedId, setSelectedId] = useState(null)
  const [form, setForm] = useState(EMPTY_CODE)
  const [mode, setMode] = useState('single')
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [preview, setPreview] = useState('')
  const [aiUrl, setAiUrl] = useState('')
  const [aiUrlDirty, setAiUrlDirty] = useState(false)
  const [me, setMe] = useState(() => getTeacherName())
  const [askName, setAskName] = useState(() => !getTeacherName())
  const [showBase, setShowBase] = useState(false)

  // Generacion con IA: los intentos son borradores privados que se cargan en el mismo formulario.
  const [aiConfig, setAiConfig] = useState(null)
  const [attemptsState, setAttemptsState] = useState({ id: null, list: [] })
  const [draftId, setDraftId] = useState(null)
  const [pendingDraftId, setPendingDraftId] = useState(null)
  const [feedback, setFeedback] = useState('')
  const [previewError, setPreviewError] = useState(null)
  const [aiWorking, setAiWorking] = useState(false)

  const dirtyRef = useRef(false)
  dirtyRef.current = dirty
  const formRef = useRef(form)
  formRef.current = form
  const draftRef = useRef(null)
  draftRef.current = draftId
  const selectedIdRef = useRef(null)
  selectedIdRef.current = selectedId
  const fetchTicketRef = useRef(0)
  // Intento que ya se evaluo para cargar solo, por version abierta (no pisa lo que el profe eligio despues).
  const consideredRef = useRef({ selId: null, attemptId: null })
  // Pedidos hechos en esta sesion (intento -> editor tal como se mando): su resultado se carga solo.
  const requestedRef = useRef(new Map())

  /* ------------------------------------------------------------- carga */

  useEffect(() => {
    let alive = true
    setDetail(null)
    setLoadError('')
    api
      .getProject(id)
      .then((data) => alive && setDetail(data))
      .catch((err) => alive && setLoadError(err.message))
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

  const iterations = detail?.iterations || []
  const project = detail?.project

  /* ------------------------------------------------------- IA: estado */

  useEffect(() => {
    let alive = true
    api.ai
      .status()
      .then((data) => alive && setAiConfig(data))
      .catch(() => alive && setAiConfig({ enabled: false }))
    return () => {
      alive = false
    }
  }, [])
  const aiEnabled = Boolean(aiConfig?.enabled)

  const refreshAttempts = useCallback((iterationId) => {
    const ticket = ++fetchTicketRef.current
    return api.ai
      .list(iterationId)
      .then((data) => {
        if (ticket === fetchTicketRef.current) setAttemptsState({ id: iterationId, list: data.attempts || [] })
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!aiEnabled) return undefined
    return subscribe('subscribe:teacher', undefined, {
      'ai:changed': (data) => {
        if (data?.iterationId && data.iterationId === selectedIdRef.current) refreshAttempts(data.iterationId)
      }
    })
  }, [aiEnabled, refreshAttempts])

  useEffect(() => {
    if (aiEnabled && selectedId) refreshAttempts(selectedId)
  }, [aiEnabled, selectedId, refreshAttempts])

  /* ------------------------------------------- tomar el proyecto al abrir */

  const claimedRef = useRef(false)
  useEffect(() => {
    if (!project || !me || claimedRef.current) return
    if (project.status !== 'pending') return

    claimedRef.current = true
    api
      .patchProject(id, { status: 'processing', teacherName: me })
      .then(setDetail)
      .catch(() => {
        claimedRef.current = false
      })
  }, [project, me, id])

  // Seleccion por defecto: la primera iteracion pendiente, si no la ultima.
  useEffect(() => {
    if (!iterations.length) return
    if (iterations.some((it) => it.id === selectedId)) return
    const pending = iterations.find((it) => it.status === 'pending')
    setSelectedId((pending || iterations[iterations.length - 1]).id)
  }, [iterations, selectedId])

  const selected = useMemo(
    () => iterations.find((it) => it.id === selectedId) || null,
    [iterations, selectedId]
  )

  // Cargamos el codigo guardado. Si el profe cambio de version, siempre recargamos;
  // si sigue en la misma y tiene cambios sin guardar, no le pisamos lo que escribio.
  const loadedForRef = useRef(null)
  useEffect(() => {
    if (!selected) return
    const changedSelection = loadedForRef.current !== selected.id
    // Ni lo que el profe escribio ni un borrador de la IA cargado se pisan con un project:sync.
    if (!changedSelection && (dirtyRef.current || draftRef.current)) return

    loadedForRef.current = selected.id
    if (changedSelection) {
      draftRef.current = null
      setDraftId(null)
      setPendingDraftId(null)
      setFeedback('')
      consideredRef.current = { selId: selected.id, attemptId: null }
    }
    const code = selected.code || EMPTY_CODE
    setForm({ html: code.html || '', css: code.css || '', js: code.js || '' })
    setMode(code.css || code.js ? 'split' : 'single')
    setDirty(false)
  }, [selected])

  const attempts = attemptsState.id === selectedId ? attemptsState.list : []
  const latestAttempt = attempts[attempts.length - 1] || null
  const aiBusy = latestAttempt ? latestAttempt.status === 'queued' || latestAttempt.status === 'generating' : false

  const loadDraft = useCallback((attempt) => {
    draftRef.current = attempt.id
    setDraftId(attempt.id)
    setPendingDraftId(null)
    setForm({ html: attempt.code, css: '', js: '' })
    setMode('single')
    setDirty(false)
  }, [])

  // Cuando llega un borrador listo: se carga solo si no pisa nada del profe; si no, queda un boton.
  useEffect(() => {
    if (!selected || !aiEnabled || attemptsState.id !== selected.id) return
    const ready = attemptsState.list.filter((attempt) => attempt.status === 'ready' && attempt.code)
    if (!ready.length) return
    if (consideredRef.current.selId !== selected.id) consideredRef.current = { selId: selected.id, attemptId: null }

    // 1) Algo que pidio el profe en esta sesion (generar o rehacer): vale tambien sobre una version ya publicada.
    for (const attempt of ready) {
      if (!requestedRef.current.has(attempt.id)) continue
      const sent = requestedRef.current.get(attempt.id)
      requestedRef.current.delete(attempt.id)
      consideredRef.current.attemptId = attempt.id
      if (!dirtyRef.current || JSON.stringify(formRef.current) === sent) loadDraft(attempt)
      else setPendingDraftId(attempt.id)
      return
    }

    // 2) Version todavia sin publicar: el ultimo borrador se carga al abrirla o cuando llega.
    if (selected.hasCode) return
    const latest = ready[ready.length - 1]
    if (consideredRef.current.attemptId === latest.id) return
    consideredRef.current.attemptId = latest.id
    if (!dirtyRef.current) loadDraft(latest)
    else setPendingDraftId(latest.id)
  }, [attemptsState, selected, aiEnabled, loadDraft])

  // Por si se pierde un aviso en vivo: mientras la IA trabaja se vuelve a preguntar cada tanto.
  useEffect(() => {
    if (!aiBusy || !selectedId) return undefined
    const timer = setInterval(() => refreshAttempts(selectedId), 5000)
    return () => clearInterval(timer)
  }, [aiBusy, selectedId, refreshAttempts])

  useEffect(() => {
    if (!project || aiUrlDirty) return
    setAiUrl(project.aiChatUrl || '')
  }, [project, aiUrlDirty])

  /* --------------------------------------------------------- preview */

  useEffect(() => {
    const empty = !form.html.trim() && !form.css.trim() && !form.js.trim()
    if (empty) {
      setPreview('')
      return undefined
    }

    let alive = true
    const timer = setTimeout(() => {
      api
        .preview({ ...form, title: project?.title || 'Juego' })
        .then((data) => alive && setPreview(data.document || ''))
        .catch(() => alive && setPreview(''))
    }, 450)

    return () => {
      alive = false
      clearTimeout(timer)
    }
  }, [form, project?.title])

  /* --------------------------------------------------------- acciones */

  const setCode = useCallback((key) => (event) => {
    const raw = event.target.value
    const value = /^\s*```/.test(raw) ? stripCodeFences(raw) : raw
    setDirty(true)
    setForm((current) => ({ ...current, [key]: value }))
  }, [])

  const baseIteration = useMemo(
    () => (selected ? previousWithCode(iterations, selected.version) : null),
    [iterations, selected]
  )

  async function copyText(text, message) {
    const ok = await copyToClipboard(text)
    toast(ok ? message : 'No se pudo copiar', ok ? 'ok' : 'error')
  }

  async function save() {
    if (!selected) return
    if (!form.html.trim() && !form.js.trim()) {
      toast('Pega al menos el HTML del juego', 'error')
      return
    }
    setSaving(true)
    try {
      const data = await api.saveIterationCode(selected.id, { ...form, publishedBy: me || 'teacher' })
      // Lo publicado pasa a ser lo que hay en el editor: ya no es un borrador.
      draftRef.current = null
      setDraftId(null)
      setPendingDraftId(null)
      setDetail(data)
      setDirty(false)
      toast('Enviado al alumno', 'ok')
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  /** Pide un intento a la IA. Con cambios, parte del codigo que hay en el editor ahora. */
  async function requestAi(changes) {
    if (!selected) return
    const iterationId = selected.id
    setAiWorking(true)
    try {
      const body = { requestedBy: me || 'teacher' }
      if (changes) {
        body.feedback = changes
        body.code = form
      }
      const { attempt } = await api.ai.generate(iterationId, body)
      requestedRef.current.set(attempt.id, JSON.stringify(form))
      if (changes && changes === feedback) setFeedback('')
      await refreshAttempts(iterationId)
    } catch (err) {
      toast(err.message, 'error')
      refreshAttempts(iterationId)
    } finally {
      setAiWorking(false)
    }
  }

  async function cancelAi() {
    if (!selected) return
    setAiWorking(true)
    try {
      await api.ai.cancel(selected.id)
      await refreshAttempts(selected.id)
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setAiWorking(false)
    }
  }

  function chooseAttempt(attempt) {
    const replacesEdits = dirtyRef.current && pendingDraftId !== attempt.id && draftRef.current !== attempt.id
    if (replacesEdits && !window.confirm('Esto reemplaza los cambios que hiciste en el editor. Cargar igual?')) return
    loadDraft(attempt)
  }

  function addPreviewError() {
    if (!previewError) return
    const line = `Hay un error en el juego: ${previewError}`
    setFeedback((current) => (current.trim() ? `${current.trimEnd()}\n${line}` : line))
  }

  async function patch(payload, message) {
    try {
      const data = await api.patchProject(id, payload)
      setDetail(data)
      if (message) toast(message, 'ok')
    } catch (err) {
      toast(err.message, 'error')
    }
  }

  /* ----------------------------------------------------------- render */

  if (loadError) {
    return (
      <Layout brandTo="/dashboard" wide>
        <EmptyState
          title="Proyecto no encontrado"
          description={loadError}
          action={
            <Link className="btn btn--primary" to="/dashboard">
              Volver al panel
            </Link>
          }
        />
      </Layout>
    )
  }

  if (!detail) {
    return (
      <Layout brandTo="/dashboard" wide>
        <Spinner label="Cargando proyecto" />
      </Layout>
    )
  }

  const status = statusInfo(PROJECT_STATUS, project.status)
  const isFullDoc = looksLikeFullDocument(form.html)
  const takenByOther = project.teacherName && project.teacherName !== me

  const previewCard = (
    <div className="card">
      <div className="card__head">
        <h3>Previsualizacion</h3>
        <span className="muted">Asi lo va a ver el alumno</span>
      </div>
      {preview ? (
        <GameFrame srcDoc={preview} title="Previsualizacion" height={420} onErrorChange={setPreviewError} />
      ) : (
        <EmptyState title="Sin codigo" description="Pega la respuesta de la IA para ver el juego aca." />
      )}
    </div>
  )

  return (
    <Layout
      brandTo="/dashboard"
      wide
      actions={
        <>
          <button type="button" className="btn btn--ghost" onClick={() => setAskName(true)}>
            {me ? `Sos ${me}` : 'Poner mi nombre'}
          </button>
          <Link className="btn btn--ghost" to="/dashboard">
            Volver al panel
          </Link>
          <a className="btn btn--ghost" href={`/proyecto/${id}`} target="_blank" rel="noreferrer">
            Ver como el alumno
          </a>
        </>
      }
    >
      <header className="project-head">
        <div>
          <span className="eyebrow">Proyecto</span>
          <h1>{project.title}</h1>
          <p className="project-head__meta">
            {project.studentName || 'Sin nombre'} · {iterations.length} versiones · actualizado{' '}
            {relativeTime(project.updatedAt)}
          </p>
        </div>
        <div className="project-head__controls">
          {project.teacherName ? (
            <Badge tone={takenByOther ? 'warn' : 'info'}>
              {takenByOther ? `Lo tiene ${project.teacherName}` : `Lo tenes vos`}
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
            {iterations.map((iteration) => (
              <button
                key={iteration.id}
                type="button"
                className={`version-chip${iteration.id === selectedId ? ' version-chip--active' : ''}${
                  iteration.status === 'pending' ? ' version-chip--pending' : ''
                }`}
                onClick={() => setSelectedId(iteration.id)}
                title={statusInfo(ITERATION_STATUS, iteration.status).label}
              >
                v{iteration.version}
              </button>
            ))}
          </div>

          {selected ? (
            <>
              <div className="card">
                <div className="card__head">
                  <h3>
                    {selected.kind === 'initial' ? 'Prompt inicial' : `Cambios pedidos (v${selected.version})`}
                  </h3>
                  <div className="card__head-actions">
                    <span className="muted">{clockTime(selected.createdAt)}</span>
                    <Badge tone={statusInfo(ITERATION_STATUS, selected.status).tone}>
                      {statusInfo(ITERATION_STATUS, selected.status).label}
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

              {/* ------------------------ contexto para retomar la charla */}
              <div className="card">
                <div className="card__head">
                  <h3>Si se corto la conversacion</h3>
                  <span className="muted">
                    {baseIteration ? `Base: v${baseIteration.version}` : 'Sin version previa'} · incluye el nuevo pedido
                  </span>
                </div>

                <div className="actions actions--tight">
                  <button
                    type="button"
                    className="btn btn--sm"
                    onClick={() =>
                      copyText(
                        buildRestartContext(project, iterations, {
                          upToVersion: selected.version,
                          newPrompt: selected.promptFull
                        }),
                        'Resumen completo + nuevo pedido copiado'
                      )
                    }
                  >
                    Copiar resumen + codigo base
                  </button>
                  <button
                    type="button"
                    className="btn btn--sm"
                    onClick={() =>
                      copyText(
                        buildRestartContext(project, iterations, {
                          upToVersion: selected.version,
                          includeCode: false,
                          newPrompt: selected.promptFull
                        }),
                        'Historial + nuevo pedido copiado'
                      )
                    }
                  >
                    Solo el historial
                  </button>
                  {baseIteration ? (
                    <button
                      type="button"
                      className="btn btn--sm"
                      onClick={() =>
                        copyText(
                          withNewPrompt(iterationCodeText(baseIteration), selected.promptFull),
                          `Codigo v${baseIteration.version} + nuevo pedido copiado`
                        )
                      }
                    >
                      Copiar codigo v{baseIteration.version}
                    </button>
                  ) : null}
                </div>

                {baseIteration ? (
                  <>
                    <button type="button" className="link-button" onClick={() => setShowBase((value) => !value)}>
                      {showBase ? 'Ocultar el codigo anterior' : `Ver el codigo de la v${baseIteration.version}`}
                    </button>
                    {showBase ? (
                      <textarea
                        className="input input--code"
                        rows={12}
                        readOnly
                        spellCheck={false}
                        value={iterationCodeText(baseIteration)}
                        onFocus={(event) => event.target.select()}
                      />
                    ) : null}
                  </>
                ) : (
                  <p className="note">Esta es la primera version: todavia no hay codigo anterior.</p>
                )}
              </div>

              {selected.hasCode ? (
                <div className="card">
                  <div className="card__head">
                    <h3>Version publicada</h3>
                    <div className="card__head-actions">
                      {selected.publishedBy === 'student' ? (
                        <Badge>La subio el alumno</Badge>
                      ) : selected.publishedBy && selected.publishedBy !== 'teacher' ? (
                        <Badge>Lo hizo {selected.publishedBy}</Badge>
                      ) : null}
                      <a className="btn btn--ghost btn--sm" href={downloadUrl(selected.id)} download>
                        Descargar HTML
                      </a>
                    </div>
                  </div>
                  <GameFrame iterationId={selected.id} title={`Publicado — v${selected.version}`} height={320} />
                </div>
              ) : null}
            </>
          ) : (
            <EmptyState title="Este proyecto no tiene prompts" />
          )}
        </section>

        {/* --------------------------------------------- columna derecha */}
        <section className="workspace__col">
          {aiEnabled && selected ? (
            <AiCard
              attempts={attempts}
              loadedId={draftId}
              // El ultimo intento ya quedo publicado si la version se guardo despues de que termino.
              published={Boolean(
                selected.hasCode && latestAttempt?.finishedAt && selected.updatedAt > latestAttempt.finishedAt
              )}
              pendingDraft={attempts.find((attempt) => attempt.id === pendingDraftId) || null}
              canRedo={Boolean(form.html.trim() || form.js.trim())}
              feedback={feedback}
              onFeedback={setFeedback}
              previewError={previewError}
              working={aiWorking}
              saving={saving}
              onGenerate={() => requestAi('')}
              onCancel={cancelAi}
              onRetry={() => requestAi(latestAttempt?.feedback || '')}
              onRedo={() => requestAi(feedback.trim())}
              onLoad={chooseAttempt}
              onApprove={save}
              onAddError={addPreviewError}
            />
          ) : null}

          {/* Con IA lo primero es mirar el juego: la vista previa va arriba del codigo. */}
          {aiEnabled ? previewCard : null}

          <div className="card">
            <div className="card__head">
              <h3>Respuesta de la IA</h3>
              <div className="tabs tabs--sm">
                <button
                  type="button"
                  className={`tab${mode === 'single' ? ' tab--active' : ''}`}
                  onClick={() => setMode('single')}
                >
                  Archivo unico
                </button>
                <button
                  type="button"
                  className={`tab${mode === 'split' ? ' tab--active' : ''}`}
                  onClick={() => setMode('split')}
                >
                  HTML + CSS + JS
                </button>
              </div>
            </div>

            {mode === 'single' ? (
              <label className="field">
                <span className="field__label">Pega el archivo HTML completo</span>
                <textarea
                  className="input input--code"
                  rows={16}
                  spellCheck={false}
                  placeholder="<!DOCTYPE html> ..."
                  value={form.html}
                  onChange={setCode('html')}
                />
                <span className="field__hint">
                  {isFullDoc
                    ? 'Documento completo detectado.'
                    : 'Si pegas solo un fragmento, lo envolvemos en un HTML valido automaticamente.'}
                </span>
              </label>
            ) : (
              <div className="code-grid">
                <label className="field">
                  <span className="field__label">HTML</span>
                  <textarea
                    className="input input--code"
                    rows={10}
                    spellCheck={false}
                    value={form.html}
                    onChange={setCode('html')}
                  />
                </label>
                <label className="field">
                  <span className="field__label">CSS</span>
                  <textarea
                    className="input input--code"
                    rows={8}
                    spellCheck={false}
                    value={form.css}
                    onChange={setCode('css')}
                  />
                </label>
                <label className="field">
                  <span className="field__label">JavaScript</span>
                  <textarea
                    className="input input--code"
                    rows={10}
                    spellCheck={false}
                    value={form.js}
                    onChange={setCode('js')}
                  />
                </label>
              </div>
            )}

            <div className="actions actions--between">
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => {
                  draftRef.current = null
                  setDraftId(null)
                  setDirty(true)
                  setForm(EMPTY_CODE)
                }}
              >
                Limpiar
              </button>
              <button type="button" className="btn btn--primary btn--lg" onClick={save} disabled={saving}>
                {selected?.hasCode ? 'Guardar cambios y actualizar al alumno' : 'Aprobar y enviar al alumno'}
              </button>
            </div>

            {dirty ? (
              <p className="note note--warn">Tenes cambios sin guardar.</p>
            ) : draftId ? (
              <p className="note">
                {selected?.hasCode
                  ? 'Borrador de la IA sin aprobar: el alumno sigue viendo la version publicada.'
                  : 'Borrador de la IA: todavia no se envio al alumno.'}
              </p>
            ) : null}
          </div>

          {aiEnabled ? null : previewCard}
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
