import { useLayoutEffect, useRef, useState } from 'react'

/** Ventana "de compu" con la que se dibuja el juego. Las miniaturas del servidor usan la misma. */
export const VIRTUAL = { width: 1280, height: 800 }

/**
 * Iframe de juego que siempre se dibuja a 1280x800 y se achica (o agranda) para entrar
 * completo en su caja, sin recortes. En un celular el juego ve una pantalla de compu,
 * que es para lo que la IA lo diseno.
 *
 * `native`: el iframe ocupa la caja tal cual (pantallas grandes, donde no hace falta escalar).
 */
export default function ScaledFrame({ src, title, sandbox, allow, frameRef, interactive = true, native = false }) {
  const boxRef = useRef(null)
  const [box, setBox] = useState(null)

  useLayoutEffect(() => {
    const node = boxRef.current
    if (!node) return undefined
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      setBox((prev) => (prev && prev.width === width && prev.height === height ? prev : { width, height }))
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  const scale = box ? Math.min(box.width / VIRTUAL.width, box.height / VIRTUAL.height) : 0
  const style = native
    ? { width: '100%', height: '100%' }
    : {
        width: VIRTUAL.width,
        height: VIRTUAL.height,
        transform: `translate(-50%, -50%) scale(${scale})`
      }

  return (
    <div
      ref={boxRef}
      className={`scaled-frame${native ? ' scaled-frame--native' : ''}${interactive ? '' : ' scaled-frame--static'}`}
    >
      {box && (native || scale > 0) ? (
        <iframe
          ref={frameRef}
          className="scaled-frame__iframe"
          style={style}
          title={title}
          src={src}
          sandbox={sandbox}
          allow={allow}
          allowFullScreen={interactive}
          tabIndex={interactive ? undefined : -1}
          aria-hidden={interactive ? undefined : true}
        />
      ) : null}
    </div>
  )
}
