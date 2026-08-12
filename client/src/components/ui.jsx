import { useId } from 'react'

export function Badge({ tone = 'neutral', children }) {
  return <span className={`badge badge--${tone}`}>{children}</span>
}

export function Field({ label, hint, children, required = false }) {
  return (
    <label className="field">
      <span className="field__label">
        {label}
        {required ? <span className="field__required" aria-hidden="true"> *</span> : null}
      </span>
      {children}
      {hint ? <span className="field__hint">{hint}</span> : null}
    </label>
  )
}

export function TextInput({ label, hint, required, ...props }) {
  return (
    <Field label={label} hint={hint} required={required}>
      <input className="input" {...props} />
    </Field>
  )
}

export function TextArea({ label, hint, required, rows = 3, ...props }) {
  return (
    <Field label={label} hint={hint} required={required}>
      <textarea className="input input--area" rows={rows} {...props} />
    </Field>
  )
}

export function Select({ label, hint, options, required, ...props }) {
  return (
    <Field label={label} hint={hint} required={required}>
      <div className="select-wrap">
        <select className="input input--select" {...props}>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <svg className="select-wrap__caret" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
          <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>
    </Field>
  )
}

export function EmptyState({ title, description, action }) {
  return (
    <div className="empty">
      <h3 className="empty__title">{title}</h3>
      {description ? <p className="empty__description">{description}</p> : null}
      {action}
    </div>
  )
}

export function Spinner({ label = 'Cargando' }) {
  return (
    <div className="spinner" role="status" aria-label={label}>
      <span className="spinner__dot" />
      <span className="spinner__dot" />
      <span className="spinner__dot" />
    </div>
  )
}

export function SectionTitle({ eyebrow, title, description, actions }) {
  return (
    <div className="section-title">
      <div>
        {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
      </div>
      {actions ? <div className="section-title__actions">{actions}</div> : null}
    </div>
  )
}

export function PromptBlock({ text, label = 'Asi se lee tu pedido', actions }) {
  const id = useId()
  return (
    <div className="prompt-block">
      <div className="prompt-block__head">
        <span className="prompt-block__label" id={id}>
          {label}
        </span>
        {actions ? <div className="prompt-block__actions">{actions}</div> : null}
      </div>
      <pre className="prompt-block__body" tabIndex={0} aria-labelledby={id}>
        {text}
      </pre>
    </div>
  )
}
