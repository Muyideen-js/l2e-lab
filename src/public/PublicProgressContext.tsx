import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { LoaderCircle } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useToasts } from '../context/ToastContext'
import type {
  HydratedLearnerProgress,
  LearnerAuthSession,
  LearnerProgressSnapshot,
} from '../lib/firebase'
import { getProjectBySlug, seedShowcaseItems } from './data'
import { UsernameGate, type LearnerAuthMode } from './UsernameGate'
import type {
  DailyProgress,
  LearningTrack,
  ProjectSubmissionInput,
  PublicProgressSnapshot,
  ShowcaseItem,
} from './types'

const LEGACY_STORAGE_KEY = 'l2e-lab-public-progress-v1'
const ACCOUNT_STORAGE_PREFIX = 'l2e-lab-account-progress-v2:'
const LEGACY_MIGRATION_PREFIX = 'l2e-lab-legacy-progress-migrated-v2:'
const CLOUD_SYNC_RETRY_DELAYS = [1_500, 3_000, 6_000, 12_000, 30_000] as const
const CLOUD_SYNC_DEADLINE_MS = 4_000

export type LearnerAuthStatus = 'checking' | 'signed-out' | 'authenticated' | 'error'
export type LearnerSyncStatus = 'idle' | 'syncing' | 'synced' | 'offline' | 'error'

function cloudSyncErrorMessage(error: unknown, offline: boolean): string {
  if (offline) {
    return 'You are offline. New progress is safe on this device and will sync when you reconnect.'
  }

  const code = error && typeof error === 'object' && 'code' in error
    ? String(error.code)
    : ''
  if (code === 'permission-denied') {
    return 'Cloud progress is blocked by Firestore permissions. Your work is safe here while L2E LAB publishes the latest rules.'
  }
  if (code === 'not-configured') {
    return 'Cloud progress is not configured yet. Your work is safe on this device.'
  }
  return 'Progress could not sync yet. It is safe on this device and L2E LAB will retry.'
}

const emptyDailyProgress = (): DailyProgress => ({
  python: [],
  react: [],
  javascript: [],
})

const initialSnapshot = (displayName = 'Guest Builder'): PublicProgressSnapshot => ({
  displayName,
  finishedProjectIds: [],
  dailyProgress: emptyDailyProgress(),
  submissions: [],
  likedShowcaseIds: [],
})

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return [...new Set(value.filter((item): item is string => typeof item === 'string'))]
}

function dayArray(value: unknown): number[] {
  if (!Array.isArray(value)) return []
  return [...new Set(value.filter(
    (item): item is number => Number.isInteger(item) && item >= 1 && item <= 100,
  ))].sort((left, right) => left - right)
}

function sameArray<T>(left: readonly T[], right: readonly T[]): boolean {
  return left.length === right.length && left.every((item, index) => item === right[index])
}

function parseSnapshot(raw: string | null, displayName: string): PublicProgressSnapshot {
  if (!raw) return initialSnapshot(displayName)
  try {
    const parsed = JSON.parse(raw) as Partial<PublicProgressSnapshot>
    const progress = parsed.dailyProgress as Partial<DailyProgress> | undefined
    return {
      displayName,
      finishedProjectIds: stringArray(parsed.finishedProjectIds),
      dailyProgress: {
        python: dayArray(progress?.python),
        react: dayArray(progress?.react),
        javascript: dayArray(progress?.javascript),
      },
      submissions: Array.isArray(parsed.submissions)
        ? parsed.submissions.filter((item): item is ShowcaseItem => Boolean(
          item
          && typeof item === 'object'
          && 'id' in item
          && typeof item.id === 'string'
          && 'source' in item
          && item.source === 'local',
        ))
        : [],
      likedShowcaseIds: stringArray(parsed.likedShowcaseIds),
    }
  } catch {
    return initialSnapshot(displayName)
  }
}

function accountStorageKey(uid: string): string {
  return `${ACCOUNT_STORAGE_PREFIX}${uid}`
}

function legacyIdentityKey(value: string): string {
  return value
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[._-]+/g, '-')
}

function loadAccountSnapshot(session: LearnerAuthSession): PublicProgressSnapshot {
  if (typeof window === 'undefined') return initialSnapshot(session.username)

  try {
    const accountRaw = window.localStorage.getItem(accountStorageKey(session.uid))
    if (accountRaw) return parseSnapshot(accountRaw, session.username)

    // Migrate the previous local-only profile only when its name matches this
    // account. That preserves existing progress without leaking one learner's
    // work into another learner's account on a shared computer.
    const migrationKey = `${LEGACY_MIGRATION_PREFIX}${session.uid}`
    if (window.localStorage.getItem(migrationKey) !== 'true') {
      const legacyRaw = window.localStorage.getItem(LEGACY_STORAGE_KEY)
      const legacy = legacyRaw
        ? JSON.parse(legacyRaw) as Partial<PublicProgressSnapshot>
        : null
      const legacyName = typeof legacy?.displayName === 'string' ? legacy.displayName : ''
      if (legacyRaw && legacyIdentityKey(legacyName) === session.username) {
        const migrated = parseSnapshot(legacyRaw, session.username)
        window.localStorage.setItem(accountStorageKey(session.uid), JSON.stringify(migrated))
        window.localStorage.setItem(migrationKey, 'true')
        return migrated
      }
    }
  } catch {
    // Blocked storage or a corrupt legacy snapshot starts clean; cloud
    // hydration still restores completion after authentication.
  }

  return initialSnapshot(session.username)
}

function mergeHydratedProgress(
  current: PublicProgressSnapshot,
  cloud: HydratedLearnerProgress,
): PublicProgressSnapshot {
  const dailyProgress: DailyProgress = {
    python: dayArray([...current.dailyProgress.python, ...cloud.dailyProgress.python]),
    react: dayArray([...current.dailyProgress.react, ...cloud.dailyProgress.react]),
    javascript: dayArray([
      ...current.dailyProgress.javascript,
      ...cloud.dailyProgress.javascript,
    ]),
  }
  const finishedProjectIds = stringArray([
    ...current.finishedProjectIds,
    ...cloud.finishedProjectIds,
  ]).sort()

  const unchanged = sameArray(current.dailyProgress.python, dailyProgress.python)
    && sameArray(current.dailyProgress.react, dailyProgress.react)
    && sameArray(current.dailyProgress.javascript, dailyProgress.javascript)
    && sameArray([...current.finishedProjectIds].sort(), finishedProjectIds)

  return unchanged ? current : {
    ...current,
    dailyProgress,
    finishedProjectIds,
  }
}

function remoteAdditionCount(
  current: PublicProgressSnapshot,
  cloud: HydratedLearnerProgress,
): number {
  const dailyAdds = (Object.keys(current.dailyProgress) as LearningTrack[])
    .reduce((total, track) => total + cloud.dailyProgress[track]
      .filter((day) => !current.dailyProgress[track].includes(day)).length, 0)
  const projectAdds = cloud.finishedProjectIds
    .filter((projectId) => !current.finishedProjectIds.includes(projectId)).length
  return dailyAdds + projectAdds
}

type AuthGateRoute = {
  destinationLabel: string
  cancelTo: string
  initialMode: LearnerAuthMode
}

function decodeURIComponentSafe(input: string): string {
  try {
    return decodeURIComponent(input)
  } catch {
    return input
  }
}

function authGateForPath(pathname: string, search: string): AuthGateRoute | null {
  const cleanPath = pathname.replace(/\/+$/, '') || '/'
  if (cleanPath === '/auth') {
    const requestedMode = new URLSearchParams(search).get('mode')
    return {
      destinationLabel: 'your learning dashboard',
      cancelTo: '/',
      initialMode: requestedMode === 'signin' ? 'signin' : 'signup',
    }
  }
  if (cleanPath === '/my-learning') {
    return { destinationLabel: 'your learning dashboard', cancelTo: '/', initialMode: 'signin' }
  }
  if (cleanPath === '/daily/python' || cleanPath.startsWith('/daily/python/')) {
    return { destinationLabel: 'the 100 Days of Python course', cancelTo: '/daily', initialMode: 'signup' }
  }
  if (cleanPath === '/playground') {
    return { destinationLabel: 'the Python playground', cancelTo: '/', initialMode: 'signup' }
  }

  const projectBuildMatch = cleanPath.match(/^\/projects\/([^/]+)\/build$/)
  if (!projectBuildMatch) return null
  const rawSlug = projectBuildMatch[1]
  const slug = decodeURIComponentSafe(rawSlug)
  const project = getProjectBySlug(slug) ?? getProjectBySlug(rawSlug)
  if (project?.track !== 'python') return null
  return {
    destinationLabel: `${project.title} workspace`,
    cancelTo: `/projects/${project.slug}`,
    initialMode: 'signup',
  }
}

function initialsFor(name: string): string {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('')
  return initials || 'LB'
}

function newSubmissionId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `showcase-${crypto.randomUUID()}`
  }
  return `showcase-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

async function waitForCloudSync(sync: Promise<void>): Promise<void> {
  let deadlineId: number | undefined
  await Promise.race([
    sync,
    new Promise<void>((resolve) => {
      deadlineId = window.setTimeout(resolve, CLOUD_SYNC_DEADLINE_MS)
    }),
  ])
  if (deadlineId !== undefined) window.clearTimeout(deadlineId)
}

export interface PublicProgressContextValue extends PublicProgressSnapshot {
  authStatus: LearnerAuthStatus
  authSession: LearnerAuthSession | null
  isAuthenticated: boolean
  syncStatus: LearnerSyncStatus
  showcaseItems: ShowcaseItem[]
  signUp: (username: string, password: string) => Promise<string>
  signIn: (username: string, password: string) => Promise<string>
  signOut: () => Promise<void>
  markProjectFinished: (projectId: string) => void
  isProjectFinished: (projectId: string) => boolean
  finishChallenge: (track: LearningTrack, day: number) => void
  isChallengeFinished: (track: LearningTrack, day: number) => boolean
  submitProject: (input: ProjectSubmissionInput) => ShowcaseItem
  toggleLike: (showcaseId: string) => void
  isLiked: (showcaseId: string) => boolean
}

const PublicProgressContext = createContext<PublicProgressContextValue | null>(null)

export function PublicProgressProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<PublicProgressSnapshot>(() => initialSnapshot())
  const [authStatus, setAuthStatus] = useState<LearnerAuthStatus>('checking')
  const [authSession, setAuthSession] = useState<LearnerAuthSession | null>(null)
  const [syncStatus, setSyncStatus] = useState<LearnerSyncStatus>('idle')
  const [syncRetryRevision, setSyncRetryRevision] = useState(0)
  const latestSnapshotRef = useRef(snapshot)
  const authSessionRef = useRef<LearnerAuthSession | null>(null)
  const authStatusRef = useRef<LearnerAuthStatus>('checking')
  const syncStatusRef = useRef<LearnerSyncStatus>('idle')
  const cloudSyncChainRef = useRef<Promise<void>>(Promise.resolve())
  const lastCloudFingerprintRef = useRef('')
  const syncRetryFingerprintRef = useRef('')
  const syncRetryAttemptRef = useRef(0)
  const syncRetryTimerRef = useRef<number | null>(null)
  const profileGenerationRef = useRef(0)
  const subscriptionInitializedRef = useRef(false)
  const lastRealtimeFingerprintRef = useRef('')
  const lastSyncErrorRef = useRef('')
  const location = useLocation()
  const navigate = useNavigate()
  const { notify } = useToasts()

  latestSnapshotRef.current = snapshot
  syncStatusRef.current = syncStatus

  const clearCloudSyncRetry = useCallback(() => {
    if (syncRetryTimerRef.current !== null) {
      window.clearTimeout(syncRetryTimerRef.current)
      syncRetryTimerRef.current = null
    }
    syncRetryAttemptRef.current = 0
    syncRetryFingerprintRef.current = ''
  }, [])

  const scheduleCloudSyncRetry = useCallback(() => {
    if (syncRetryTimerRef.current !== null) window.clearTimeout(syncRetryTimerRef.current)
    const retryIndex = syncRetryAttemptRef.current
    if (retryIndex >= CLOUD_SYNC_RETRY_DELAYS.length) {
      syncRetryTimerRef.current = null
      return
    }

    syncRetryAttemptRef.current = retryIndex + 1
    syncRetryTimerRef.current = window.setTimeout(() => {
      syncRetryTimerRef.current = null
      setSyncRetryRevision((revision) => revision + 1)
    }, CLOUD_SYNC_RETRY_DELAYS[retryIndex])
  }, [])

  const activateSession = useCallback((session: LearnerAuthSession) => {
    if (
      authStatusRef.current === 'authenticated'
      && authSessionRef.current?.uid === session.uid
    ) {
      authSessionRef.current = session
      // Username identity is immutable for a UID. Keeping the existing state
      // object prevents token refreshes from making editors reload a local
      // draft while the learner is typing.
      return
    }

    clearCloudSyncRetry()
    profileGenerationRef.current += 1
    authSessionRef.current = session
    authStatusRef.current = 'authenticated'
    subscriptionInitializedRef.current = false
    lastRealtimeFingerprintRef.current = ''
    lastCloudFingerprintRef.current = ''
    lastSyncErrorRef.current = ''
    const accountSnapshot = loadAccountSnapshot(session)
    latestSnapshotRef.current = accountSnapshot
    setSnapshot(accountSnapshot)
    setAuthSession(session)
    setAuthStatus('authenticated')
    setSyncStatus(navigator.onLine ? 'syncing' : 'offline')
  }, [clearCloudSyncRetry])

  const deactivateSession = useCallback((status: 'signed-out' | 'error') => {
    clearCloudSyncRetry()
    profileGenerationRef.current += 1
    authSessionRef.current = null
    authStatusRef.current = status
    subscriptionInitializedRef.current = false
    lastRealtimeFingerprintRef.current = ''
    lastCloudFingerprintRef.current = ''
    lastSyncErrorRef.current = ''
    const cleanSnapshot = initialSnapshot()
    latestSnapshotRef.current = cleanSnapshot
    setSnapshot(cleanSnapshot)
    setAuthSession(null)
    setAuthStatus(status)
    setSyncStatus('idle')
  }, [clearCloudSyncRetry])

  useEffect(() => {
    let disposed = false
    let unsubscribe: (() => void) | undefined

    void import('../lib/firebase')
      .then(({ observeLearnerAuth }) => observeLearnerAuth((state) => {
        if (disposed) return
        if (state.status === 'authenticated') {
          activateSession(state.session)
        } else {
          deactivateSession(state.status)
        }
      }))
      .then((nextUnsubscribe) => {
        if (disposed) nextUnsubscribe()
        else unsubscribe = nextUnsubscribe
      })
      .catch((error) => {
        if (disposed) return
        console.warn('[L2E LAB] Learner authentication could not start.', error)
        deactivateSession('error')
      })

    return () => {
      disposed = true
      unsubscribe?.()
    }
  }, [activateSession, deactivateSession])

  useEffect(() => {
    const session = authSessionRef.current
    if (!session || authStatus !== 'authenticated') return
    try {
      window.localStorage.setItem(accountStorageKey(session.uid), JSON.stringify(snapshot))
    } catch {
      // The authenticated cloud copy remains available when storage is blocked.
    }
  }, [authStatus, snapshot])

  const queueCloudSync = useCallback((force = false) => {
    const session = authSessionRef.current
    if (!session || authStatusRef.current !== 'authenticated') return Promise.resolve()
    const generation = profileGenerationRef.current
    const current = latestSnapshotRef.current
    const payload = {
      displayName: session.username,
      dailyProgress: {
        python: [...current.dailyProgress.python],
        react: [...current.dailyProgress.react],
        javascript: [...current.dailyProgress.javascript],
      },
      finishedProjectIds: [...current.finishedProjectIds],
    }
    const fingerprint = `${session.uid}:${JSON.stringify(payload)}`
    if (!force && fingerprint === lastCloudFingerprintRef.current) return Promise.resolve()
    if (fingerprint !== syncRetryFingerprintRef.current) {
      clearCloudSyncRetry()
      syncRetryFingerprintRef.current = fingerprint
    }
    lastCloudFingerprintRef.current = fingerprint
    if (navigator.onLine) setSyncStatus('syncing')
    else setSyncStatus('offline')

    const queuedSync = cloudSyncChainRef.current
      .catch(() => undefined)
      .then(async () => {
        try {
          const { syncLearnerProgress } = await import('../lib/firebase')
          const synced = await syncLearnerProgress(payload)
          if (
            generation !== profileGenerationRef.current
            || authSessionRef.current?.uid !== session.uid
          ) return
          setSnapshot((latest) => mergeHydratedProgress(latest, synced))
          if (lastCloudFingerprintRef.current !== fingerprint) return
          clearCloudSyncRetry()
          lastSyncErrorRef.current = ''
          setSyncStatus('synced')
        } catch (error) {
          const isLatestPayload = lastCloudFingerprintRef.current === fingerprint
          if (isLatestPayload) lastCloudFingerprintRef.current = ''
          if (
            generation !== profileGenerationRef.current
            || authSessionRef.current?.uid !== session.uid
          ) return
          if (!isLatestPayload) return
          const offline = !navigator.onLine
          setSyncStatus(offline ? 'offline' : 'error')
          if (!offline) scheduleCloudSyncRetry()
          const message = cloudSyncErrorMessage(error, offline)
          if (lastSyncErrorRef.current !== message) {
            lastSyncErrorRef.current = message
            notify(message, offline ? 'info' : 'warning')
          }
          console.warn('[L2E LAB] Learner progress is waiting to sync.', error)
        }
      })
    cloudSyncChainRef.current = queuedSync
    return queuedSync
  }, [clearCloudSyncRetry, notify, scheduleCloudSyncRetry])

  useEffect(() => {
    if (authStatus !== 'authenticated') return
    void queueCloudSync()
  }, [
    authStatus,
    snapshot.dailyProgress,
    snapshot.finishedProjectIds,
    queueCloudSync,
  ])

  useEffect(() => {
    if (syncRetryRevision === 0 || authStatus !== 'authenticated') return
    void queueCloudSync(true)
  }, [authStatus, queueCloudSync, syncRetryRevision])

  useEffect(() => {
    if (!authSession || authStatus !== 'authenticated') return
    const generation = profileGenerationRef.current
    let disposed = false
    let unsubscribe: (() => void) | undefined

    void import('../lib/firebase')
      .then(({ subscribeToOwnLearnerProgress }) => subscribeToOwnLearnerProgress(
        (remote: LearnerProgressSnapshot | null) => {
          if (
            disposed
            || generation !== profileGenerationRef.current
            || authSessionRef.current?.uid !== authSession.uid
          ) return
          if (!remote) {
            subscriptionInitializedRef.current = true
            return
          }

          const fingerprint = JSON.stringify({
            dailyProgress: remote.dailyProgress,
            finishedProjectIds: remote.finishedProjectIds,
          })
          if (fingerprint === lastRealtimeFingerprintRef.current) return
          lastRealtimeFingerprintRef.current = fingerprint

          const additions = remoteAdditionCount(latestSnapshotRef.current, remote)
          const hadInitialSnapshot = subscriptionInitializedRef.current
          subscriptionInitializedRef.current = true
          setSnapshot((latest) => mergeHydratedProgress(latest, remote))

          if (hadInitialSnapshot && additions > 0) {
            notify(
              additions === 1
                ? 'Progress updated in real time from another signed-in device.'
                : `${additions} progress updates arrived from another signed-in device.`,
              'info',
            )
          }
        },
        (error) => {
          if (disposed || generation !== profileGenerationRef.current) return
          setSyncStatus(navigator.onLine ? 'error' : 'offline')
          const message = cloudSyncErrorMessage(error, !navigator.onLine)
          if (lastSyncErrorRef.current !== message) {
            lastSyncErrorRef.current = message
            notify(message, 'warning')
          }
          console.warn('[L2E LAB] Live progress listener paused.', error)
        },
      ))
      .then((nextUnsubscribe) => {
        if (disposed) nextUnsubscribe()
        else unsubscribe = nextUnsubscribe
      })
      .catch((error) => {
        if (disposed || generation !== profileGenerationRef.current) return
        setSyncStatus(navigator.onLine ? 'error' : 'offline')
        console.warn('[L2E LAB] Live progress listener could not start.', error)
      })

    return () => {
      disposed = true
      unsubscribe?.()
    }
  }, [authSession, authStatus, notify])

  useEffect(() => {
    const handleOffline = () => {
      if (authSessionRef.current) setSyncStatus('offline')
    }
    const handleOnline = () => {
      if (!authSessionRef.current) return
      lastSyncErrorRef.current = ''
      void queueCloudSync(true)
    }
    const handleFocus = () => {
      if (!authSessionRef.current || syncStatusRef.current !== 'error') return
      lastSyncErrorRef.current = ''
      void queueCloudSync(true)
    }
    window.addEventListener('offline', handleOffline)
    window.addEventListener('online', handleOnline)
    window.addEventListener('focus', handleFocus)
    return () => {
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('focus', handleFocus)
    }
  }, [queueCloudSync])

  useEffect(() => () => clearCloudSyncRetry(), [clearCloudSyncRetry])

  const signUp = useCallback(async (username: string, password: string) => {
    const { signUpLearner } = await import('../lib/firebase')
    const session = await signUpLearner(username, password)
    activateSession(session)
    await waitForCloudSync(queueCloudSync(true))
    return session.username
  }, [activateSession, queueCloudSync])

  const signIn = useCallback(async (username: string, password: string) => {
    const { signInLearner } = await import('../lib/firebase')
    const session = await signInLearner(username, password)
    activateSession(session)
    await waitForCloudSync(queueCloudSync(true))
    return session.username
  }, [activateSession, queueCloudSync])

  const signOut = useCallback(async () => {
    try {
      if (navigator.onLine && authSessionRef.current) {
        await waitForCloudSync(queueCloudSync(true))
      }
      const { signOutLearner } = await import('../lib/firebase')
      await signOutLearner()
      deactivateSession('signed-out')
      notify('Signed out of L2E LAB.', 'info')
    } catch (error) {
      notify('L2E LAB could not sign out yet. Please try again.', 'error')
      console.warn('[L2E LAB] Learner sign-out failed.', error)
    }
  }, [deactivateSession, notify, queueCloudSync])

  const markProjectFinished = useCallback((projectId: string) => {
    if (!projectId) return
    setSnapshot((current) => current.finishedProjectIds.includes(projectId)
      ? current
      : { ...current, finishedProjectIds: [...current.finishedProjectIds, projectId] })
  }, [])

  const isProjectFinished = useCallback(
    (projectId: string) => snapshot.finishedProjectIds.includes(projectId),
    [snapshot.finishedProjectIds],
  )

  const finishChallenge = useCallback((track: LearningTrack, day: number) => {
    if (!Number.isInteger(day) || day < 1 || day > 100) return
    setSnapshot((current) => {
      const completedDays = current.dailyProgress[track]
      if (completedDays.includes(day)) return current
      return {
        ...current,
        dailyProgress: {
          ...current.dailyProgress,
          [track]: [...completedDays, day].sort((left, right) => left - right),
        },
      }
    })
  }, [])

  const isChallengeFinished = useCallback(
    (track: LearningTrack, day: number) => snapshot.dailyProgress[track].includes(day),
    [snapshot.dailyProgress],
  )

  const submitProject = useCallback((input: ProjectSubmissionInput): ShowcaseItem => {
    const accountName = authSessionRef.current?.username || snapshot.displayName || 'Guest Builder'
    const author = (input.author?.trim() || accountName).slice(0, 40)
    const item: ShowcaseItem = {
      id: newSubmissionId(),
      projectId: input.project.id,
      projectSlug: input.project.slug,
      projectTitle: input.project.title,
      track: input.project.track,
      author,
      authorInitials: initialsFor(author),
      title: input.title?.trim().slice(0, 80) || `${author}'s ${input.project.title}`,
      description: input.description?.trim().slice(0, 240) || `My take on ${input.project.title}, built in L2E LAB.`,
      files: input.files.map((file) => ({ ...file })),
      submittedAt: new Date().toISOString(),
      likes: 0,
      preview: {
        accent: input.preview?.accent || input.project.theme.accent,
        eyebrow: input.preview?.eyebrow || `${input.project.track.toUpperCase()} BUILD`,
        headline: input.preview?.headline || input.title?.trim().slice(0, 80) || input.project.title,
        body: input.preview?.body || input.description?.trim().slice(0, 160) || input.project.summary,
      },
      source: 'local',
    }

    setSnapshot((current) => ({
      ...current,
      submissions: [item, ...current.submissions],
    }))
    return item
  }, [snapshot.displayName])

  const toggleLike = useCallback((showcaseId: string) => {
    setSnapshot((current) => ({
      ...current,
      likedShowcaseIds: current.likedShowcaseIds.includes(showcaseId)
        ? current.likedShowcaseIds.filter((id) => id !== showcaseId)
        : [...current.likedShowcaseIds, showcaseId],
    }))
  }, [])

  const isLiked = useCallback(
    (showcaseId: string) => snapshot.likedShowcaseIds.includes(showcaseId),
    [snapshot.likedShowcaseIds],
  )

  const showcaseItems = useMemo(() => {
    const items = [...snapshot.submissions, ...seedShowcaseItems]
    return items.map((item) => ({
      ...item,
      likes: item.likes + (snapshot.likedShowcaseIds.includes(item.id) ? 1 : 0),
    }))
  }, [snapshot.submissions, snapshot.likedShowcaseIds])

  const value = useMemo<PublicProgressContextValue>(() => ({
    ...snapshot,
    authStatus,
    authSession,
    isAuthenticated: authStatus === 'authenticated' && Boolean(authSession),
    syncStatus,
    showcaseItems,
    signUp,
    signIn,
    signOut,
    markProjectFinished,
    isProjectFinished,
    finishChallenge,
    isChallengeFinished,
    submitProject,
    toggleLike,
    isLiked,
  }), [
    snapshot,
    authStatus,
    authSession,
    syncStatus,
    showcaseItems,
    signUp,
    signIn,
    signOut,
    markProjectFinished,
    isProjectFinished,
    finishChallenge,
    isChallengeFinished,
    submitProject,
    toggleLike,
    isLiked,
  ])

  const requestedGate = authGateForPath(location.pathname, location.search)
  const gateRoute = authStatus === 'authenticated' ? null : requestedGate

  return (
    <PublicProgressContext.Provider value={value}>
      {gateRoute && authStatus === 'checking' ? (
        <div className="username-gate" role="status" aria-live="polite">
          <div className="username-gate__dialog">
            <div className="username-gate__auth-check"><LoaderCircle className="spin" size={22} /><strong>Checking your L2E LAB session…</strong></div>
          </div>
        </div>
      ) : gateRoute ? (
        <UsernameGate
          key={`${location.pathname}${location.search}`}
          destinationLabel={gateRoute.destinationLabel}
          initialMode={gateRoute.initialMode}
          onSignUp={signUp}
          onSignIn={signIn}
          onCancel={() => navigate(gateRoute.cancelTo, { replace: true })}
        />
      ) : children}
    </PublicProgressContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function usePublicProgress(): PublicProgressContextValue {
  const value = useContext(PublicProgressContext)
  if (!value) throw new Error('usePublicProgress must be used inside PublicProgressProvider')
  return value
}
