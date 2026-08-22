import type { Timestamp } from 'firebase/firestore'
import { getFirebaseClient } from './client'
import {
  getCurrentLearnerSession,
  normalizeLearnerUsername,
  LearnerAuthError,
  toLearnerAuthError,
  type LearnerAuthSession,
  type LearnerAuthUnsubscribe,
} from './learnerAuth'

export const LEARNERS_COLLECTION = 'learners'
export const LEARNER_SCHEMA_VERSION = 1 as const

export type LearnerTrack = 'python' | 'react' | 'javascript'

export interface LearnerDailyProgress {
  python: number[]
  react: number[]
  javascript: number[]
}

export interface LearnerDocument {
  uid: string
  displayName: string
  displayNameLower: string
  schemaVersion: typeof LEARNER_SCHEMA_VERSION
  firstSeenAt: Timestamp
  lastSeenAt: Timestamp
  dailyProgress: LearnerDailyProgress
  finishedProjectIds: string[]
}

export interface LearnerSyncInput {
  displayName: string
  dailyProgress?: Partial<Record<LearnerTrack, readonly number[]>>
  finishedProjectIds?: readonly string[]
}

export interface HydratedLearnerProgress {
  displayName: string
  dailyProgress: LearnerDailyProgress
  finishedProjectIds: string[]
}

export interface LearnerSyncResult extends HydratedLearnerProgress {
  session: LearnerAuthSession
  created: boolean
}

export interface LearnerProgressSnapshot extends HydratedLearnerProgress {
  uid: string
  firstSeenAt: Date | null
  lastSeenAt: Date | null
}

function cleanDisplayName(value: string): string {
  const displayName = value.trim().replace(/\s+/g, ' ').slice(0, 40)
  if (!displayName) {
    throw new LearnerAuthError('invalid-username', 'Enter your username before syncing progress.')
  }
  return displayName
}

function cleanDays(value: unknown): number[] {
  if (!Array.isArray(value)) return []
  return [...new Set(value.filter(
    (day): day is number => typeof day === 'number' && Number.isInteger(day) && day >= 1 && day <= 100,
  ))].sort((left, right) => left - right)
}

function cleanProjectIds(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return [...new Set(value
    .filter((id): id is string => typeof id === 'string')
    .map((id) => id.trim().slice(0, 120))
    .filter(Boolean))]
    .slice(0, 100)
    .sort()
}

function cleanDailyProgress(value: unknown): LearnerDailyProgress {
  const progress = value && typeof value === 'object'
    ? value as Partial<Record<LearnerTrack, unknown>>
    : {}
  return {
    python: cleanDays(progress.python),
    react: cleanDays(progress.react),
    javascript: cleanDays(progress.javascript),
  }
}

function mergeProgress(
  remote: LearnerDailyProgress,
  local?: LearnerSyncInput['dailyProgress'],
): LearnerDailyProgress {
  return {
    python: cleanDays([...remote.python, ...(local?.python ?? [])]),
    react: cleanDays([...remote.react, ...(local?.react ?? [])]),
    javascript: cleanDays([...remote.javascript, ...(local?.javascript ?? [])]),
  }
}

/**
 * Creates or updates the current learner and returns the union of local and
 * remote completion. The public app remains local-first; callers may use the
 * returned union for hydration without making the learner wait for the network.
 */
export async function syncLearnerProgress(input: LearnerSyncInput): Promise<LearnerSyncResult> {
  try {
    const [{ db }, session, firestoreSdk] = await Promise.all([
      getFirebaseClient(),
      getCurrentLearnerSession(),
      import('firebase/firestore'),
    ])
    if (!session) {
      throw new LearnerAuthError(
        'signed-out',
        'Sign in with your L2E LAB username and password before syncing progress.',
      )
    }

    const requestedDisplayName = cleanDisplayName(input.displayName)
    let requestedUsername: string
    try {
      requestedUsername = normalizeLearnerUsername(requestedDisplayName)
    } catch {
      throw new LearnerAuthError(
        'invalid-username',
        'The local username does not match this signed-in learner account.',
      )
    }
    if (requestedUsername !== session.username) {
      throw new LearnerAuthError(
        'invalid-username',
        'The local username does not match this signed-in learner account.',
      )
    }

    // The authenticated account is authoritative; local storage cannot rename
    // a learner document to a different identity.
    const displayName = session.displayName
    const learnerRef = firestoreSdk.doc(db, LEARNERS_COLLECTION, session.uid)

    const merged = await firestoreSdk.runTransaction(db, async (transaction) => {
      const snapshot = await transaction.get(learnerRef)
      const remote = snapshot.exists()
        ? snapshot.data() as Partial<LearnerDocument>
        : undefined
      const dailyProgress = mergeProgress(
        cleanDailyProgress(remote?.dailyProgress),
        input.dailyProgress,
      )
      const finishedProjectIds = cleanProjectIds([
        ...cleanProjectIds(remote?.finishedProjectIds),
        ...(input.finishedProjectIds ?? []),
      ])
      const timestamp = firestoreSdk.serverTimestamp()

      if (snapshot.exists()) {
        transaction.update(learnerRef, {
          uid: session.uid,
          displayName,
          displayNameLower: displayName.toLowerCase(),
          schemaVersion: LEARNER_SCHEMA_VERSION,
          lastSeenAt: timestamp,
          dailyProgress,
          finishedProjectIds,
        })
      } else {
        transaction.set(learnerRef, {
          uid: session.uid,
          displayName,
          displayNameLower: displayName.toLowerCase(),
          schemaVersion: LEARNER_SCHEMA_VERSION,
          firstSeenAt: timestamp,
          lastSeenAt: timestamp,
          dailyProgress,
          finishedProjectIds,
        })
      }

      return { dailyProgress, finishedProjectIds, created: !snapshot.exists() }
    })

    return {
      session,
      displayName,
      dailyProgress: merged.dailyProgress,
      finishedProjectIds: merged.finishedProjectIds,
      created: merged.created,
    }
  } catch (error) {
    throw toLearnerAuthError(error)
  }
}

/** Upserts a learner visit without discarding any existing cloud progress. */
export async function upsertLearner(displayName: string): Promise<LearnerSyncResult> {
  return syncLearnerProgress({ displayName })
}

function dateFromValue(value: unknown): Date | null {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value
  if (value && typeof value === 'object' && 'toDate' in value) {
    const toDate = (value as { toDate?: unknown }).toDate
    if (typeof toDate === 'function') {
      try {
        const date = toDate.call(value) as unknown
        if (date instanceof Date && Number.isFinite(date.getTime())) return date
      } catch {
        return null
      }
    }
  }
  return null
}

function progressSnapshotFromData(
  uid: string,
  data: Partial<LearnerDocument>,
  session: LearnerAuthSession,
): LearnerProgressSnapshot {
  const storedDisplayName = typeof data.displayName === 'string'
    ? data.displayName.trim().slice(0, 40)
    : ''
  return {
    uid,
    displayName: storedDisplayName || session.displayName,
    dailyProgress: cleanDailyProgress(data.dailyProgress),
    finishedProjectIds: cleanProjectIds(data.finishedProjectIds),
    firstSeenAt: dateFromValue(data.firstSeenAt),
    lastSeenAt: dateFromValue(data.lastSeenAt),
  }
}

/** Subscribes only to the signed-in learner's own Firestore progress record. */
export async function subscribeToOwnLearnerProgress(
  listener: (snapshot: LearnerProgressSnapshot | null) => void,
  onError?: (error: LearnerAuthError) => void,
): Promise<LearnerAuthUnsubscribe> {
  try {
    const [{ db }, session, firestoreSdk] = await Promise.all([
      getFirebaseClient(),
      getCurrentLearnerSession(),
      import('firebase/firestore'),
    ])
    if (!session) {
      throw new LearnerAuthError(
        'signed-out',
        'Sign in before loading learner progress.',
      )
    }

    const learnerRef = firestoreSdk.doc(db, LEARNERS_COLLECTION, session.uid)
    return firestoreSdk.onSnapshot(
      learnerRef,
      (document) => {
        listener(document.exists()
          ? progressSnapshotFromData(
            document.id,
            document.data() as Partial<LearnerDocument>,
            session,
          )
          : null)
      },
      (error) => onError?.(toLearnerAuthError(error)),
    )
  } catch (error) {
    throw toLearnerAuthError(error)
  }
}
