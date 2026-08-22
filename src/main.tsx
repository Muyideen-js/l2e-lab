import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './styles.css'
import './student.css'
import './builder.css'
import './workspace.css'

const PRELOAD_RECOVERY_KEY = 'l2e-lab-preload-recovery-at'

window.addEventListener('vite:preloadError', (event) => {
  let lastRecoveryAt = 0
  try {
    lastRecoveryAt = Number(window.sessionStorage.getItem(PRELOAD_RECOVERY_KEY) ?? 0)
  } catch {
    // Storage can be unavailable in hardened/private browsing modes.
  }
  if (Date.now() - lastRecoveryAt < 15_000) return

  event.preventDefault()
  try {
    window.sessionStorage.setItem(PRELOAD_RECOVERY_KEY, String(Date.now()))
  } catch {
    // Recovery still works without the loop guard.
  }

  void (async () => {
    try {
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations()
        await Promise.all(registrations.map((registration) => registration.unregister()))
      }

      if ('caches' in window) {
        const cacheNames = await window.caches.keys()
        await Promise.all(
          cacheNames
            .filter((cacheName) => cacheName.includes('workbox-precache'))
            .map((cacheName) => window.caches.delete(cacheName)),
        )
      }
    } finally {
      window.location.reload()
    }
  })()
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
        <App />
    </BrowserRouter>
  </StrictMode>,
)
