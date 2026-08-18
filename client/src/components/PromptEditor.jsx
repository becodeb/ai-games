import { useState } from 'react'

/**
 * El prompt renderizado como documento: texto fijo + huecos editables.
 * El alumno solo puede escribir dentro de los huecos, nunca borrar la frase.
 */
export default function PromptEditor({ lines, values, onChange, invalid = [], size = 'lg' }) {
  const [focused, setFocused] = useState(null)

  const focusedToken = lines
    .flatMap((line) => line.tokens)
    .find((token) => token.field && token.field === focused)

  return (
    <div className={`pdoc pdoc--${size}`}>
      <div className="pdoc__body">
        {lines.map((line) => (
          <p className="pdoc__line" key={line.id}>
            {line.tokens.map((token, index) =>
              token.field ? (
                <Slot
                  key={token.field}
                  token={token}
                  value={values[token.field] || ''}
                  invalid={invalid.includes(token.field)}
                  onChange={(next) => onChange(token.field, next)}
                  onFocus={() => setFocused(token.field)}
                  onBlur={() => setFocused((current) => (current === token.field ? null : current))}
                />
              ) : (
                <span className="pdoc__text" key={`t${index}`}>
                  {token.text}
                </span>
              )
            )}
          </p>
        ))}
      </div>

      {focusedToken?.suggestions?.length ? (
        <div className="pdoc__suggestions">
          <span className="pdoc__suggestions-label">Ideas</span>
          {focusedToken.suggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              className="chip"
              // onMouseDown para que el click llegue antes de que el hueco pierda el foco.
              onMouseDown={(event) => {
                event.preventDefault()
                onChange(focusedToken.field, suggestion)
              }}
            >
              {suggestion}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

/**
 * El hueco es un textarea superpuesto a un espejo invisible con el mismo texto.
 * El espejo define el ancho y el alto, asi el hueco crece solo y envuelve lineas.
 */
function Slot({ token, value, invalid, onChange, onFocus, onBlur }) {
  const classes = ['slot']
  if (value.trim()) classes.push('slot--filled')
  if (invalid) classes.push('slot--invalid')
  if (token.multiline) classes.push('slot--block')

  return (
    <span className={classes.join(' ')}>
      <span className="slot__mirror" aria-hidden="true">
        {value || token.placeholder}
        {'​'}
      </span>
      <textarea
        className="slot__input"
        rows={1}
        // cols=1 anula el ancho intrinseco del textarea: asi manda el espejo.
        cols={1}
        value={value}
        placeholder={token.placeholder}
        aria-label={token.placeholder}
        spellCheck={false}
        onChange={(event) => {
          const next = token.multiline ? event.target.value : event.target.value.replace(/\r?\n/g, ' ')
          onChange(next)
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !token.multiline) event.preventDefault()
        }}
        onFocus={onFocus}
        onBlur={onBlur}
      />
    </span>
  )
}
