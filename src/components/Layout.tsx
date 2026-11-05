import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { displayName } from '../lib/format'
import type { Profile } from '../types'

export function Layout({ profile }: { profile: Profile }) {
  const { signOut } = useAuth()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <Link to="/" className="brand">
          <span className="brand-mark" aria-hidden="true">
            С
          </span>
          <span>СтройCRM</span>
        </Link>

        <nav className="nav">
          <NavLink
            to="/objects"
            className={({ isActive }) => (isActive ? 'nav-link nav-link-active' : 'nav-link')}
          >
            Объекты
          </NavLink>
          {profile.role === 'executor' ? (
            <NavLink
              to="/my-tasks"
              className={({ isActive }) => (isActive ? 'nav-link nav-link-active' : 'nav-link')}
            >
              Мои задачи
            </NavLink>
          ) : null}
        </nav>

        <div className="user-box">
          <div className="user-meta">
            <span className="user-name">{displayName(profile)}</span>
            <span className="user-role">
              {profile.role === 'tasker' ? 'Постановщик' : 'Исполнитель'}
            </span>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={handleSignOut}>
            Выйти
          </button>
        </div>
      </header>

      <main className="page">
        <Outlet />
      </main>
    </div>
  )
}
