import { FirebaseError } from 'firebase/app'
import type { User } from 'firebase/auth'
import { getFirebaseClient } from './client'
import { FirebaseClientError } from './errors'

const LEARNER_EMAIL_PREFIX = 'l2e-'
const LEARNER_EMAIL_DOMAIN = 'learners.l2e-lab.invalid'
const MIN_USERNAME_LENGTH = 3
const MAX_USERNAME_LENGTH = 24
const MIN_PASSWORD_LENGTH = 8
const MAX_PASSWORD_LENGTH = 72

export type LearnerAuthUnsubscribe = () => void

export interface LearnerAuthSession {
  uid: string
  username: string
  displayName: string
}

export type LearnerAuthState =
  | { status: 'signed-out'; session: null }
  | { status: 'authenticated'; session: LearnerAuthSession }
  | { status: 'error'; session: null; error: LearnerAuthError }

export type LearnerAuthErrorCode =
  | 'not-in-browser'
  | 'not-configured'
  | 'invalid-username'
  | 'username-taken'
  | 'weak-password'
  | 'invalid-credentials'
  | 'account-disabled'
  | 'too-many-requests'
  | 'email-password-disabled'
  | 'signed-out'
  | 'wrong-provider'
  | 'permission-denied'
  | 'network-error'
  | 'service-unavailable'
  | 'unknown'

export class LearnerAuthError extends Error {
  readonly code: LearnerAuthErrorCode
  readonly retryable: boolean
  readonly cause?: unknown

  constructor(
    code: LearnerAuthErrorCode,
    message: string,
    options?: { cause?: unknown; retryable?: boolean },
  ) {
    super(message)
    this.name = 'LearnerAuthError'
    this.code = code
    this.retryable = options?.retryable ?? false
    this.cause = options?.cause
  }
}

/**
 * Converts a learner-facing username into one stable, case-insensitive key.
 * Spaces and punctuation separators intentionally collapse to a hyphen so
 * variants such as "Ada Dev" and "ada-dev" address the same account.
 */
export function normalizeLearnerUsername(value: string): string {
  const normalized = value
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[._-]+/g, '-')

  if (
    normalized.length < MIN_USERNAME_LENGTH
    || normalized.length > MAX_USERNAME_LENGTH
    || !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(normalized)
  ) {
    throw new LearnerAuthError(
      'invalid-username',
      `Choose a username with ${MIN_USERNAME_LENGTH}-${MAX_USERNAME_LENGTH} letters or numbers. Hyphens may be used between words.`,
    )
  }

  return normalized
}

function internalEmailForUsername(username: string): string {
  return `${LEARNER_EMAIL_PREFIX}${username}@${LEARNER_EMAIL_DOMAIN}`
}

function usernameFromInternalEmail(email: string | null): string | null {
  if (!email) return null
  const suffix = `@${LEARNER_EMAIL_DOMAIN}`
  const lowerEmail = email.trim().toLowerCase()
  if (!lowerEmail.startsWith(LEARNER_EMAIL_PREFIX) || !lowerEmail.endsWith(suffix)) return null
  const username = lowerEmail.slice(LEARNER_EMAIL_PREFIX.length, -suffix.length)
  try {
    return normalizeLearnerUsername(username) === username ? username : null
  } catch {
    return null
  }
}

function validatePassword(password: string) {
  if (password.length < MIN_PASSWORD_LENGTH || password.length > MAX_PASSWORD_LENGTH) {
    throw new LearnerAuthError(
      'weak-password',
      `Use a password between ${MIN_PASSWORD_LENGTH} and ${MAX_PASSWORD_LENGTH} characters.`,
    )
  }
}

function sessionFromUser(user: User, username: string): LearnerAuthSession {
  const displayName = user.displayName?.trim().slice(0, 40) || username
  return { uid: user.uid, username, displayName }
}

async function authenticatedSessionFromUser(
  user: User | null,
  forceRefresh: boolean,
): Promise<LearnerAuthSession | null> {
  if (!user || user.isAnonymous) return null
  const username = usernameFromInternalEmail(user.email)
  if (!username) return null
  const token = await user.getIdTokenResult(forceRefresh)
  if (token.signInProvider !== 'password') return null
  return sessionFromUser(user, username)
}

async function updateLearnerDisplayName(user: User, username: string): Promise<void> {
  if (user.displayName === username) return
  try {
    const { updateProfile } = await import('firebase/auth')
    await updateProfile(user, { displayName: username })
  } catch {
    // The deterministic username remains recoverable from the Auth email.
    // A later sign-in retries this non-security-critical profile update.
  }
}

export function toLearnerAuthError(error: unknown): LearnerAuthError {
  if (error instanceof LearnerAuthError) return error

  if (error instanceof FirebaseClientError) {
    if (error.code === 'not-in-browser' || error.code === 'not-configured') {
      return new LearnerAuthError(error.code, error.message, { cause: error })
    }
    if (error.code === 'permission-denied') {
      return new LearnerAuthError(
        'permission-denied',
        'Firebase refused access to this learner profile. Sign in again and retry.',
        { cause: error },
      )
    }
    if (error.code === 'network-error') {
      return new LearnerAuthError(
        'network-error',
        'L2E LAB could not reach Firebase. Check your connection and try again.',
        { cause: error, retryable: true },
      )
    }
  }

  if (error instanceof FirebaseError) {
    switch (error.code) {
      case 'auth/email-already-in-use':
        return new LearnerAuthError(
          'username-taken',
          'That username is already taken. Choose another one or sign in instead.',
          { cause: error },
        )
      case 'auth/weak-password':
      case 'auth/password-does-not-meet-requirements':
        return new LearnerAuthError(
          'weak-password',
          'Choose a stronger password with at least 8 characters.',
          { cause: error },
        )
      case 'auth/invalid-credential':
      case 'auth/invalid-login-credentials':
      case 'auth/user-not-found':
      case 'auth/wrong-password':
      case 'auth/invalid-email':
        return new LearnerAuthError(
          'invalid-credentials',
          'The username or password is incorrect.',
          { cause: error },
        )
      case 'auth/user-disabled':
        return new LearnerAuthError(
          'account-disabled',
          'This learner account has been disabled. Ask an L2E LAB coordinator for help.',
          { cause: error },
        )
      case 'auth/too-many-requests':
        return new LearnerAuthError(
          'too-many-requests',
          'Too many attempts were made. Wait a moment before trying again.',
          { cause: error, retryable: true },
        )
      case 'auth/operation-not-allowed':
        return new LearnerAuthError(
          'email-password-disabled',
          'Username/password access is not enabled for L2E LAB in Firebase Authentication.',
          { cause: error },
        )
      case 'auth/network-request-failed':
      case 'firestore/unavailable':
      case 'unavailable':
        return new LearnerAuthError(
          'network-error',
          'L2E LAB could not reach Firebase. Check your connection and try again.',
          { cause: error, retryable: true },
        )
      case 'permission-denied':
      case 'firestore/permission-denied':
        return new LearnerAuthError(
          'permission-denied',
          'Firebase refused access to this learner profile. Sign in again and retry.',
          { cause: error },
        )
      case 'firestore/failed-precondition':
        return new LearnerAuthError(
          'service-unavailable',
          'Firebase is not ready for learner progress yet. Check the deployed Firestore rules.',
          { cause: error, retryable: true },
        )
    }
  }

  return new LearnerAuthError(
    'unknown',
    'L2E LAB could not complete this account request.',
    { cause: error, retryable: true },
  )
}

/** Creates a unique learner account without exposing its internal Auth email. */
export async function signUpLearner(
  usernameInput: string,
  password: string,
): Promise<LearnerAuthSession> {
  const username = normalizeLearnerUsername(usernameInput)
  validatePassword(password)

  try {
    const [{ auth }, authSdk] = await Promise.all([
      getFirebaseClient(),
      import('firebase/auth'),
    ])
    const credential = await authSdk.createUserWithEmailAndPassword(
      auth,
      internalEmailForUsername(username),
      password,
    )
    await updateLearnerDisplayName(credential.user, username)
    const session = await authenticatedSessionFromUser(credential.user, true)
    if (!session) {
      await authSdk.signOut(auth).catch(() => undefined)
      throw new LearnerAuthError(
        'wrong-provider',
        'Firebase did not create a valid L2E LAB learner session.',
      )
    }
    return session
  } catch (error) {
    throw toLearnerAuthError(error)
  }
}

export async function signInLearner(
  usernameInput: string,
  password: string,
): Promise<LearnerAuthSession> {
  const username = normalizeLearnerUsername(usernameInput)
  if (!password) {
    throw new LearnerAuthError('invalid-credentials', 'Enter your password to continue.')
  }

  try {
    const [{ auth }, authSdk] = await Promise.all([
      getFirebaseClient(),
      import('firebase/auth'),
    ])
    const credential = await authSdk.signInWithEmailAndPassword(
      auth,
      internalEmailForUsername(username),
      password,
    )
    const session = await authenticatedSessionFromUser(credential.user, true)
    if (!session || session.username !== username) {
      await authSdk.signOut(auth).catch(() => undefined)
      throw new LearnerAuthError(
        'wrong-provider',
        'This Firebase account is not a valid L2E LAB learner account.',
      )
    }
    await updateLearnerDisplayName(credential.user, username)
    return { ...session, displayName: username }
  } catch (error) {
    throw toLearnerAuthError(error)
  }
}

export async function getCurrentLearnerSession(
  options: { forceRefresh?: boolean } = {},
): Promise<LearnerAuthSession | null> {
  try {
    const { auth } = await getFirebaseClient()
    await auth.authStateReady()
    const user = auth.currentUser
    const session = await authenticatedSessionFromUser(
      user,
      options.forceRefresh ?? false,
    )
    if (session) {
      if (user) await updateLearnerDisplayName(user, session.username)
      return { ...session, displayName: session.username }
    }

    // Retire anonymous sessions left by the previous account model, as well as
    // any unexpected provider session attached to the learner Firebase app.
    if (user) {
      const { signOut } = await import('firebase/auth')
      await signOut(auth)
    }
    return null
  } catch (error) {
    throw toLearnerAuthError(error)
  }
}

/** Returns a fresh Firebase ID token for trusted same-origin API requests. */
export async function getLearnerIdToken(): Promise<string> {
  try {
    const { auth } = await getFirebaseClient()
    await auth.authStateReady()
    const session = await authenticatedSessionFromUser(auth.currentUser, false)
    if (!auth.currentUser || !session) {
      throw new LearnerAuthError('signed-out', 'Sign in to L2E LAB to collaborate.')
    }
    return await auth.currentUser.getIdToken()
  } catch (error) {
    throw toLearnerAuthError(error)
  }
}

export async function observeLearnerAuth(
  listener: (state: LearnerAuthState) => void,
): Promise<LearnerAuthUnsubscribe> {
  const { auth } = await getFirebaseClient()
  const { onIdTokenChanged, signOut } = await import('firebase/auth')
  let active = true
  let revision = 0
  let suppressNextSignedOut = false

  const unsubscribe = onIdTokenChanged(
    auth,
    (user) => {
      const currentRevision = ++revision
      if (!user && suppressNextSignedOut) {
        suppressNextSignedOut = false
        return
      }

      void authenticatedSessionFromUser(user, false)
        .then((session) => {
          if (!active || currentRevision !== revision) return
          if (session) {
            listener({
              status: 'authenticated',
              session: { ...session, displayName: session.username },
            })
            return
          }
          if (!user) {
            listener({ status: 'signed-out', session: null })
            return
          }

          // Old anonymous sessions are simply signed out. An unexpected
          // non-password account is surfaced as a configuration error.
          if (user.isAnonymous) {
            listener({ status: 'signed-out', session: null })
          } else {
            listener({
              status: 'error',
              session: null,
              error: new LearnerAuthError(
                'wrong-provider',
                'This session is not a valid L2E LAB username/password account.',
              ),
            })
          }
          suppressNextSignedOut = true
          void signOut(auth).catch(() => {
            suppressNextSignedOut = false
          })
        })
        .catch((error: unknown) => {
          if (active && currentRevision === revision) {
            listener({
              status: 'error',
              session: null,
              error: toLearnerAuthError(error),
            })
          }
        })
    },
    (error) => {
      if (active) {
        listener({
          status: 'error',
          session: null,
          error: toLearnerAuthError(error),
        })
      }
    },
  )

  return () => {
    active = false
    revision += 1
    unsubscribe()
  }
}

export async function signOutLearner(): Promise<void> {
  try {
    const [{ auth }, authSdk] = await Promise.all([
      getFirebaseClient(),
      import('firebase/auth'),
    ])
    await authSdk.signOut(auth)
  } catch (error) {
    throw toLearnerAuthError(error)
  }
}
