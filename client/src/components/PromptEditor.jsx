/**
 * El prompt renderizado como documento en prosa: texto fijo + huecos editables.
 * Cada linea es una frase natural que el alumno no puede romper; solo escribe
 * dentro de los huecos. Si un token tiene `options`, sus chips aparecen debajo
 * de la linea y se eligen con un clic.
 *
 * Con `sections` las lineas se agrupan en bloques separados por titulos sutiles
 * (La Orden / La Idea / El Formato) que son de la interfaz, no del prompt.
 */
export default function PromptEditor({ lines, values, onChange, invalid = [], size = 'lg', sections = [], docTitle = '' }) {
  const grouped = sections.length
    ? sections
        .map((section) => ({ ...section, lines: lines.filter((line) => line.section === section.id) }))
        .filter((section) => section.lines.length)
    : [{ lines }]

  return (
    <div className={`pdoc pdoc--${size}`}>
      {docTitle ? <p className="pdoc__title">{docTitle}</p> : null}

      {grouped.map((section) => (
        <section className="pdoc__section" key={section.id || 'plain'}>
          {section.title ? <h3 className="pdoc__section-title">{section.title}</h3> : null}

          <div className="pdoc__body">
            {section.lines.map((line) =>
              line.text ? (
                <p className="pdoc__line pdoc__line--text" key={line.id}>
                  <span className="pdoc__text">{line.text}</span>
                </p>
              ) : (
                <div className="pdoc__row" key={line.id}>
                  <p className="pdoc__line">
                    {line.tokens.map((token, index) =>
                      token.field ? (
                        <Slot
                          key={token.field}
                          token={token}
                          value={values[token.field] || ''}
                          invalid={invalid.includes(token.field)}
                          onChange={(next) => onChange(token.field, next)}
                        />
                      ) : (
                        <span className="pdoc__text" key={`t${index}`}>
                          {token.text}
                        </span>
                      )
                    )}
                  </p>
                  {line.tokens.some((token) => token.options?.length) ? (
                    <div className="pdoc__options">
                      {line.tokens
                        .filter((token) => token.options?.length)
                        .map((token) =>
                          token.options.map((option) => (
                            <button
                              type="button"
                              key={option}
                              className={`chip${(values[token.field] || '') === option ? ' chip--active' : ''}`}
                              onClick={() => onChange(token.field, (values[token.field] || '') === option ? '' : option)}
                            >
                              {option}
                            </button>
                          ))
                        )}
                    </div>
                  ) : null}
                </div>
              )
            )}
          </div>
        </section>
      ))}
    </div>
  )
}

/**
 * El hueco es un textarea superpuesto a un espejo invisible con el mismo texto.
 * El espejo define el ancho y el alto, asi el hueco crece solo y envuelve lineas.
 */
function Slot({ token, value, invalid, onChange }) {
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
      />
    </span>
  )
}