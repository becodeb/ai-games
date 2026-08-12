export default function GalleryButton() {
  return (
    <a className="btn btn--primary" href="/galeria" target="_blank" rel="noreferrer">
      Ver galeria de juegos
      <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
        <path
          d="M6 3h7v7M13 3L4 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </a>
  )
}
