import { Link } from 'react-router-dom'

export function Brand({ to = '/' }) {
  return (
    <Link className="brand" to={to}>
      <span className="brand__mark" aria-hidden="true" />
      <span className="brand__text">
        STEAMLAB<span className="brand__thin">/ juegos con IA</span>
      </span>
    </Link>
  )
}

export default function Layout({ children, actions, brandTo, wide = false }) {
  return (
    <div className="app">
      <header className="topbar">
        <div className={`topbar__inner${wide ? ' container--wide' : ' container'}`}>
          <Brand to={brandTo} />
          <div className="topbar__actions">{actions}</div>
        </div>
      </header>
      <main className={wide ? 'container--wide' : 'container'}>{children}</main>
      <footer className={`footer${wide ? ' container--wide' : ' container'}`}>
        <span>Taller de programacion con inteligencia artificial</span>
      </footer>
    </div>
  )
}
