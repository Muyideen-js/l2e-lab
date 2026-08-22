import { useEffect, useRef, useState } from 'react'
import {
  BookOpen,
  Code2,
  LogIn,
  LogOut,
  LayoutGrid,
  Menu,
  Sparkles,
  UsersRound,
  X,
} from 'lucide-react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { Brand } from '../components/Brand'
import { PwaInstallPrompt } from '../components/PwaInstallPrompt'
import { usePublicProgress, type LearnerSyncStatus } from './PublicProgressContext'
import './public.css'
import './public-pages.css'
import './public-detail.css'
import './public-responsive.css'
import './public-app.css'

const publicNavigation = [
  { label: 'Projects', to: '/projects', icon: LayoutGrid },
  { label: 'Daily 100', to: '/daily', icon: BookOpen },
  { label: 'Playground', to: '/playground', icon: Code2 },
  { label: 'Community', to: '/community', icon: UsersRound },
  { label: 'My learning', to: '/my-learning', icon: Sparkles },
]

const syncStatusLabels: Record<LearnerSyncStatus, string> = {
  idle: 'Connected',
  syncing: 'Syncing',
  synced: 'Synced',
  offline: 'Offline',
  error: 'Sync issue',
}

function activeNavClass({ isActive }: { isActive: boolean }) {
  return `pl-nav__link${isActive ? ' pl-nav__link--active' : ''}`
}

export function PublicLayout() {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const location = useLocation()
  const progress = usePublicProgress()
  const syncStatusLabel = syncStatusLabels[progress.syncStatus]

  useEffect(() => {
    setMenuOpen(false)
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [location.pathname])

  useEffect(() => {
    if (!menuOpen) return

    function closeMenuOnEscape(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      event.preventDefault()
      setMenuOpen(false)
      window.requestAnimationFrame(() => menuButtonRef.current?.focus())
    }

    document.addEventListener('keydown', closeMenuOnEscape)
    return () => document.removeEventListener('keydown', closeMenuOnEscape)
  }, [menuOpen])

  return (
    <div className="pl-shell">
      <header className="pl-header">
        <div className="pl-container pl-header__inner">
          <Link className="pl-header__brand" to="/" aria-label="L2E LAB learning hub">
            <Brand compact />
            <span className="pl-header__brand-note">Learning hub</span>
          </Link>

          <nav className="pl-nav" aria-label="Primary navigation">
            {publicNavigation.map(({ label, to }) => (
              <NavLink className={activeNavClass} to={to} key={to}>{label}</NavLink>
            ))}
          </nav>

          <div className="pl-header__actions">
            {progress.isAuthenticated ? (
              <>
                <Link className="pl-account-chip" to="/my-learning">
                  <span className={`pl-account-chip__dot is-${progress.syncStatus}`} aria-hidden="true" />
                  <span className="pl-account-chip__username">@{progress.authSession?.username}</span>
                  <span className="pl-account-chip__status" aria-live="polite">{syncStatusLabel}</span>
                </Link>
                <button
                  className="pl-signout-button"
                  type="button"
                  aria-label="Sign out of L2E LAB"
                  onClick={() => { void progress.signOut() }}
                >
                  <LogOut size={15} />
                </button>
              </>
            ) : (
              <Link className="pl-signin-button" to="/auth?mode=signin">
                <LogIn size={15} /> Sign in
              </Link>
            )}
            <Link className="pl-button pl-button--primary pl-header__play" to="/playground">
              <Code2 size={16} /> Open playground
            </Link>
            <button
              ref={menuButtonRef}
              className="pl-menu-button"
              type="button"
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={menuOpen}
              aria-controls="l2e-mobile-navigation"
              onClick={() => setMenuOpen((current) => !current)}
            >
              {menuOpen ? <X size={21} /> : <Menu size={21} />}
            </button>
          </div>
        </div>

        {menuOpen && (
          <div className="pl-mobile-menu" id="l2e-mobile-navigation">
            <nav className="pl-container" aria-label="Mobile navigation">
              {publicNavigation.map(({ label, to, icon: Icon }) => (
                <NavLink className={activeNavClass} to={to} key={to}>
                  <Icon size={17} /> {label}
                </NavLink>
              ))}
              {progress.isAuthenticated ? (
                <button className="pl-mobile-auth" type="button" onClick={() => { void progress.signOut() }}>
                  <LogOut size={17} />
                  <span>Sign out @{progress.authSession?.username}</span>
                  <small>{syncStatusLabel}</small>
                </button>
              ) : (
                <Link className="pl-mobile-auth" to="/auth?mode=signin">
                  <LogIn size={17} /> Sign in or create account
                </Link>
              )}
            </nav>
          </div>
        )}
      </header>

      <main className="pl-main">
        <Outlet />
      </main>
      <PwaInstallPrompt />
    </div>
  )
}

export function PublicToolLayout() {
  const location = useLocation()

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [location.pathname])

  return (
    <div className="pl-tool-shell">
      <main className="pl-tool-main">
        <Outlet />
      </main>
    </div>
  )
}
