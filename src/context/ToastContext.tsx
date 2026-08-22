import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { Check, X, Info, AlertTriangle } from 'lucide-react'

export type ToastKind = 'success' | 'error' | 'info' | 'warning'

export interface Toast {
  id: string
  kind: ToastKind
  message: string
  timeout: number | null
}

interface ToastContextValue {
  toasts: Toast[]
  notify: (message: string, kind?: ToastKind, durationMs?: number) => void
  dismiss: (id: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const DEFAULT_DURATION = 4200

const toastIcons: Record<ToastKind, ReactNode> = {
  success: <Check size={15} />,
  error: <X size={15} />,
  info: <Info size={15} />,
  warning: <AlertTriangle size={15} />,
}

export function ToastContainer() {
  const { toasts, dismiss } = useToasts()

  if (toasts.length === 0) return null

  return (
    <div className="toast-stack" role="status" aria-live="polite" aria-atomic="true">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast toast--${toast.kind}`}>
          <span>{toastIcons[toast.kind]}</span>
          <p>{toast.message}</p>
          <button
            onClick={() => dismiss(toast.id)}
            aria-label="Dismiss notification"
            type="button"
          >
            <X size={15} />
          </button>
        </div>
      ))}
    </div>
  )
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const dismiss = useCallback((id: string) => {
    setToasts((current) => {
      const existing = current.find((toast) => toast.id === id)
      if (existing?.timeout) clearTimeout(existing.timeout)
      return current.filter((toast) => toast.id !== id)
    })
  }, [])

  const notify = useCallback(
    (message: string, kind: ToastKind = 'success', durationMs = DEFAULT_DURATION) => {
      const id = crypto.randomUUID()
      const timeout = window.setTimeout(() => dismiss(id), durationMs)
      const toast: Toast = {
        id,
        kind,
        message,
        timeout,
      }
      setToasts((current) => {
        if (current.some((item) => item.kind === kind && item.message === message)) {
          clearTimeout(timeout)
          return current
        }
        return [...current, toast]
      })
      return id
    },
    [dismiss],
  )

  const value = { toasts, notify, dismiss }

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastContainer />
    </ToastContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useToasts(): ToastContextValue {
  const value = useContext(ToastContext)
  if (!value) throw new Error('useToasts must be used inside ToastProvider')
  return value
}
