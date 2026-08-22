import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
} from 'react'
import {
  ArrowRight,
  Check,
  Code2,
  Eye,
  EyeOff,
  LoaderCircle,
  LockKeyhole,
  ShieldCheck,
  UserPlus,
  UserRound,
  X,
} from 'lucide-react'
import { Brand } from '../components/Brand'
import { useToasts } from '../context/ToastContext'
import './username-gate.css'

export type LearnerAuthMode = 'signup' | 'signin'

type UsernameGateProps = {
  destinationLabel: string
  initialMode?: LearnerAuthMode
  onSignUp: (username: string, password: string) => Promise<string>
  onSignIn: (username: string, password: string) => Promise<string>
  onCancel: () => void
}

type FormErrorField = 'username' | 'password' | 'confirmation' | 'form'

type FormError = {
  field: FormErrorField
  message: string
}

function cleanUsername(value: string): string {
  return value.trim().toLowerCase()
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message
  return 'L2E LAB could not complete that request. Check your connection and try again.'
}

export function UsernameGate({
  destinationLabel,
  initialMode = 'signup',
  onSignUp,
  onSignIn,
  onCancel,
}: UsernameGateProps) {
  const [mode, setMode] = useState<LearnerAuthMode>(initialMode)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<FormError | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)
  const confirmationRef = useRef<HTMLInputElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const onCancelRef = useRef(onCancel)
  const submittingRef = useRef(submitting)
  const titleId = useId()
  const descriptionId = useId()
  const errorId = useId()
  const usernameHintId = useId()
  const { notify } = useToasts()

  onCancelRef.current = onCancel
  submittingRef.current = submitting

  useEffect(() => {
    setMode(initialMode)
  }, [initialMode])

  useEffect(() => {
    const launcher = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    inputRef.current?.focus()

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !submittingRef.current) {
        event.preventDefault()
        onCancelRef.current()
        return
      }

      if (event.key !== 'Tab' || !dialogRef.current) return
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
      ))
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown)
      if (launcher?.isConnected) launcher.focus()
    }
  }, [])

  function changeMode(nextMode: LearnerAuthMode) {
    if (submitting || nextMode === mode) return
    setMode(nextMode)
    setError(null)
    setPassword('')
    setConfirmation('')
    window.setTimeout(() => inputRef.current?.focus(), 0)
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const cleaned = cleanUsername(username)

    if (!/^[a-z0-9](?:[a-z0-9-]{1,22}[a-z0-9])$/.test(cleaned)) {
      setError({
        field: 'username',
        message: 'Use 3-24 lowercase letters or numbers, with hyphens only between words.',
      })
      inputRef.current?.focus()
      return
    }
    if (password.length < 8) {
      setError({ field: 'password', message: 'Your password must contain at least 8 characters.' })
      passwordRef.current?.focus()
      return
    }
    if (mode === 'signup' && password !== confirmation) {
      setError({ field: 'confirmation', message: 'Those passwords do not match yet.' })
      confirmationRef.current?.focus()
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      if (mode === 'signup') {
        const canonicalUsername = await onSignUp(cleaned, password)
        notify(`Account created. Welcome to L2E LAB, @${canonicalUsername}.`, 'success')
      } else {
        const canonicalUsername = await onSignIn(cleaned, password)
        notify(`Signed in as @${canonicalUsername}.`, 'success')
      }
    } catch (nextError) {
      setError({ field: 'form', message: errorMessage(nextError) })
      setSubmitting(false)
    }
  }

  const signingUp = mode === 'signup'

  return (
    <div
      className="username-gate"
      onMouseDown={(event) => {
        if (!submitting && event.target === event.currentTarget) onCancel()
      }}
    >
      <div
        className="username-gate__dialog"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
      >
        <header className="username-gate__topbar">
          <Brand compact />
          <span><Code2 size={14} /> LEARNER ACCESS</span>
          <button type="button" onClick={onCancel} aria-label="Cancel and go back" disabled={submitting}>
            <X size={18} />
          </button>
        </header>

        <div className="username-gate__body">
          <div className="username-gate__heading">
            <span className="username-gate__icon">
              {signingUp ? <UserPlus size={24} /> : <UserRound size={24} />}
            </span>
            <div>
              <p className="username-gate__eyebrow">{signingUp ? 'CREATE YOUR LEARNER ACCOUNT' : 'WELCOME BACK'}</p>
              <h1 id={titleId}>{signingUp ? 'Make every build count.' : 'Continue where you stopped.'}</h1>
            </div>
          </div>
          <p id={descriptionId} className="username-gate__description">
            {signingUp
              ? `Create an account before opening ${destinationLabel}. Your completed work will follow you when you sign in on another device.`
              : `Sign in with your L2E username to open ${destinationLabel} and load your progress.`}
          </p>

          <div className="username-gate__tabs" role="group" aria-label="Learner account action">
            <button
              type="button"
              aria-pressed={signingUp}
              className={signingUp ? 'is-active' : ''}
              onClick={() => changeMode('signup')}
            >
              <UserPlus size={15} /> Create account
            </button>
            <button
              type="button"
              aria-pressed={!signingUp}
              className={!signingUp ? 'is-active' : ''}
              onClick={() => changeMode('signin')}
            >
              <LockKeyhole size={15} /> Sign in
            </button>
          </div>

          <form
            onSubmit={submit}
            noValidate
            aria-describedby={error?.field === 'form' ? errorId : undefined}
          >
            <label htmlFor="learner-username">L2E username</label>
            <div className={`username-gate__input${error?.field === 'username' ? ' is-invalid' : ''}`}>
              <span>@</span>
              <input
                ref={inputRef}
                id="learner-username"
                value={username}
                onChange={(event) => {
                  setUsername(event.target.value.toLowerCase().replace(/[\s._-]+/g, '-').replace(/^-+/, '').slice(0, 24))
                  if (error) setError(null)
                }}
                placeholder="Input your Learn2Earn username"
                maxLength={24}
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                aria-invalid={error?.field === 'username'}
                aria-describedby={`${usernameHintId}${error?.field === 'username' ? ` ${errorId}` : ''}`}
              />
              <small>{username.length}/24</small>
            </div>
            <p className="username-gate__hint" id={usernameHintId}>
              Dots, underscores and spaces are saved as one hyphen.
            </p>

            <label htmlFor="learner-password">Password</label>
            <div className={`username-gate__input username-gate__input--password${error?.field === 'password' ? ' is-invalid' : ''}`}>
              <span><LockKeyhole size={14} /></span>
              <input
                ref={passwordRef}
                id="learner-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value)
                  if (error) setError(null)
                }}
                placeholder="At least 8 characters"
                minLength={8}
                maxLength={72}
                autoComplete={signingUp ? 'new-password' : 'current-password'}
                aria-invalid={error?.field === 'password'}
                aria-describedby={error?.field === 'password' ? errorId : undefined}
              />
              <button
                type="button"
                className="username-gate__reveal"
                onClick={() => setShowPassword((current) => !current)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            {signingUp && (
              <>
                <label htmlFor="learner-password-confirmation">Confirm password</label>
                <div className={`username-gate__input username-gate__input--password${error?.field === 'confirmation' ? ' is-invalid' : ''}`}>
                  <span><Check size={14} /></span>
                  <input
                    ref={confirmationRef}
                    id="learner-password-confirmation"
                    type={showPassword ? 'text' : 'password'}
                    value={confirmation}
                    onChange={(event) => {
                      setConfirmation(event.target.value)
                      if (error) setError(null)
                    }}
                    placeholder="Type the same password again"
                    minLength={8}
                    maxLength={72}
                    autoComplete="new-password"
                    aria-invalid={error?.field === 'confirmation'}
                    aria-describedby={error?.field === 'confirmation' ? errorId : undefined}
                  />
                </div>
              </>
            )}

            {error && <p className="username-gate__error" id={errorId} role="alert">{error.message}</p>}

            <div className="username-gate__actions">
              <button type="button" className="username-gate__cancel" onClick={onCancel} disabled={submitting}>Cancel</button>
              <button type="submit" className="username-gate__continue" disabled={submitting}>
                {submitting ? <><LoaderCircle className="spin" size={16} /> Please wait</> : <>{signingUp ? 'Create account' : 'Sign in'} <ArrowRight size={16} /></>}
              </button>
            </div>
          </form>
        </div>

        <footer className="username-gate__privacy">
          <ShieldCheck size={16} />
          <p><strong>No email address needed.</strong> Firebase securely handles your password. L2E LAB syncs only your username and learning progress.</p>
        </footer>
      </div>
    </div>
  )
}
