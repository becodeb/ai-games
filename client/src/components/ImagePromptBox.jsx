import { useEffect, useRef } from 'react'

/**
 * El pedido de imagen: un comienzo fijo que el alumno no puede borrar
 * ("Generame una imagen") y despues texto libre. Es el equivalente al
 * prompt-con-huecos de los juegos, pero para escribir con las propias palabras.
 */
export default function ImagePromptBox({
  prefix,
  value,
  onChange,
  placeholder = '',
  hints = [],
  invalid = false,
  minRows = 5,
  disabled = false
}) {
  const ref = useRef(null)

  // El cuadro crece con lo que se escribe: nunca hay que scrollear adentro.
  useEffect(() => {
    const node = ref.current
    if (!node) return
    node.style.height = 'auto'
    node.style.height = `${node.scrollHeight}px`
  }, [value])

  return (
    <div className={`ibox${invalid ? ' ibox--invalid' : ''}`}>
      <div className="ibox__doc">
        <p className="ibox__prefix">
          {prefix}
          <span className="ibox__lock" title="Este comienzo ya viene escrito">fijo</span>
        </p>
        <textarea
          ref={ref}
          className="ibox__input"
          rows={minRows}
          value={value}
          disabled={disabled}
          placeholder={placeholder}
          spellCheck={false}
          onChange={(event) => onChange(event.target.value)}
          aria-label="Segui el pedido con tus palabras"
        />
      </div>

      {hints.length ? (
        <div className="ibox__hints">
          <span className="ibox__hints-label">Conta, si podes:</span>
          {hints.map((hint) => (
            <span className="ibox__hint" key={hint}>
              {hint}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  )
}
