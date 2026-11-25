import { useEffect, useState } from 'react'
import { Badge, Spinner } from './ui.jsx'

const BUSY = ['queued', 'generating']

function useSecondsSince(iso, active) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return undefined
    setNow(Date.now())
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [active])
  const start = iso ? Date.parse(iso) : NaN
  return Number.isNaN(start) ? 0 : Math.max(0, Math.round((now - start) / 1000))
}

function tokens(attempt) {
  if (!attempt.inputTokens && !attempt.outputTokens) return ''
  return `${attempt.inputTokens.toLocaleString('es-AR')} tokens de entrada · ${attempt.outputTokens.toLocaleString('es-AR')} de salida`
}

/**
 * Tarjeta "Juego hecho por la IA". Solo muestra estado y dispara acciones: el borrador vive en el
 * formulario de DashboardProject, que decide cuando cargarlo.
 */
export default function AiCard({
  attempts,
  loadedId,
  published,
  pendingDraft,
  canRedo,
  feedback,
  onFeedback,
  previewError,
  working,
  saving,
  onGenerate,
  onCancel,
  onRetry,
  onRedo,
  onLoad,
  onApprove,
  onAddError
}) {
  const latest = attempts[attempts.length - 1] || null
  const busy = latest ? BUSY.includes(latest.status) : false
  const seconds = useSecondsSince(latest?.startedAt || latest?.createdAt, busy)
  const readyAttempts = attempts.filter((attempt) => attempt.status === 'ready' && attempt.code)
  const shown = attempts.find((attempt) => attempt.id === loadedId) || null

  return (
    <div className="card">
      <div className="card__head">
        <h3>Juego hecho por la IA</h3>
        {latest?.status === 'ready' ? (
          <Badge tone="ok">{published && !loadedId ? 'Ya publicado' : 'Listo para revisar'}</Badge>
        ) : null}
        {latest?.status === 'error' ? <Badge tone="danger">La IA fallo</Badge> : null}
      </div>

      {!latest || latest.status === 'canceled' ? (
        <div className="ai-card__status">
          <button type="button" className="btn btn--primary" onClick={onGenerate} disabled={working}>
            Generar con IA
          </button>
          <span className="muted">Crea un borrador a partir del pedido. No le llega al alumno hasta que lo apruebes.</span>
        </div>
      ) : null}

      {busy ? (
        <div className="ai-card__status" role="status">
          <Spinner label="La IA esta generando" />
          <span>
            {latest.status === 'queued' ? 'Esperando turno…' : 'Generando…'} <strong>{seconds} s</strong>
          </span>
          <button type="button" className="btn btn--sm" onClick={onCancel} disabled={working}>
            Cancelar
          </button>
        </div>
      ) : null}

      {latest?.status === 'error' ? (
        <>
          <p className="alert alert--error">{latest.error || 'La IA no pudo generar el juego.'}</p>
          <div className="actions actions--tight">
            <button type="button" className="btn" onClick={onRetry} disabled={working}>
              Reintentar
            </button>
          </div>
        </>
      ) : null}

      {latest?.status === 'ready' ? (
        <>
          {latest.warning ? <p className="alert alert--error">{latest.warning}. Podes pedirle a la IA que lo rehaga.</p> : null}
          <p className="ai-card__tokens">{tokens(latest)}</p>
          {published && !loadedId ? (
            <p className="note">El alumno ya ve este intento. Si lo cambias, usa el boton de guardar del editor.</p>
          ) : (
            <div className="actions actions--tight">
              <button type="button" className="btn btn--primary" onClick={onApprove} disabled={saving}>
                Aprobar y enviar al alumno
              </button>
            </div>
          )}
        </>
      ) : null}

      {pendingDraft ? (
        <p className="note note--warn">
          La IA termino un borrador nuevo (intento {pendingDraft.seq}), pero tenes cambios tuyos en el editor.{' '}
          <button type="button" className="link-button" onClick={() => onLoad(pendingDraft)}>
            Cargar esta version
          </button>
        </p>
      ) : null}

      {readyAttempts.length ? (
        <>
          <div className="ai-card__chips" role="group" aria-label="Intentos de la IA">
            {readyAttempts.map((attempt) => (
              <button
                key={attempt.id}
                type="button"
                className={`version-chip${attempt.id === loadedId ? ' version-chip--active' : ''}`}
                title={attempt.feedback || 'Primera version de la IA'}
                onClick={() => onLoad(attempt)}
              >
                Intento {attempt.seq}
              </button>
            ))}
          </div>
          {shown ? (
            <p className="ai-card__feedback">
              {shown.feedback ? `Cambio pedido: ${shown.feedback}` : 'Primera version de la IA, a partir del pedido.'}
            </p>
          ) : null}
        </>
      ) : null}

      {!busy && canRedo ? (
        <div className="ai-card__redo">
          <label className="field">
            <span className="field__label">Pedile cambios a la IA</span>
            <textarea
              className="input input--area"
              rows={3}
              maxLength={4000}
              placeholder="Ej: que las naves vayan mas rapido y agregar un puntaje"
              value={feedback}
              onChange={(event) => onFeedback(event.target.value)}
            />
            <span className="field__hint">Parte del codigo que ves en el editor (con tus ajustes) y no crea una version nueva.</span>
          </label>
          <div className="actions actions--tight">
            <button type="button" className="btn" onClick={onRedo} disabled={working || !feedback.trim()}>
              Rehacer con estos cambios
            </button>
            {previewError ? (
              <button type="button" className="btn btn--ghost btn--sm" onClick={onAddError}>
                Agregar el error de la vista previa
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}
