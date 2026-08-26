import { useState } from 'react'
import Modal from './Modal.jsx'
import { imageDownloadUrl } from '../lib/api.js'

/**
 * La tanda de imagenes que devolvio el profe.
 * Si `onSelect` esta, el alumno puede marcar cual quiere seguir mejorando:
 * esa es la que despues viaja como referencia en el pedido de correccion.
 */
export default function ImageResults({ images = [], selectedId = '', onSelect, title = '', label = 'Opcion' }) {
  const [zoom, setZoom] = useState(null)

  if (!images.length) return null

  return (
    <>
      <div className={`shots${images.length > 2 ? ' shots--grid' : ''}`}>
        {images.map((image, index) => {
          const chosen = image.id === selectedId
          return (
            <figure className={`shot${chosen ? ' shot--chosen' : ''}`} key={image.id}>
              <button
                type="button"
                className="shot__frame"
                onClick={() => setZoom(image)}
                aria-label={`Ver ${label.toLowerCase()} ${index + 1} en grande`}
              >
                <img src={image.url} alt={`${title || 'Imagen'} — ${label.toLowerCase()} ${index + 1}`} loading="lazy" />
              </button>

              <figcaption className="shot__foot">
                <span className="shot__index">{label} {index + 1}</span>
                <span className="shot__actions">
                  {onSelect ? (
                    <button
                      type="button"
                      className={`btn btn--sm${chosen ? ' btn--primary' : ''}`}
                      onClick={() => onSelect(chosen ? '' : image.id)}
                    >
                      {chosen ? 'Elegida' : 'Elegir esta'}
                    </button>
                  ) : null}
                  <a className="link-button" href={imageDownloadUrl(image.id)} download>
                    Descargar
                  </a>
                </span>
              </figcaption>
            </figure>
          )
        })}
      </div>

      <Modal
        open={Boolean(zoom)}
        onClose={() => setZoom(null)}
        title={title || 'Imagen'}
        description={zoom ? `${label} ${images.findIndex((image) => image.id === zoom.id) + 1} de ${images.length}` : ''}
        size="xl"
      >
        {zoom ? (
          <div className="shot-zoom">
            <img src={zoom.url} alt={title || 'Imagen en grande'} />
            <div className="actions">
              <a className="btn" href={imageDownloadUrl(zoom.id)} download>
                Descargar
              </a>
              {onSelect ? (
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={() => {
                    onSelect(zoom.id === selectedId ? '' : zoom.id)
                    setZoom(null)
                  }}
                >
                  {zoom.id === selectedId ? 'Sacar la eleccion' : 'Elegir esta para seguir'}
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
      </Modal>
    </>
  )
}
