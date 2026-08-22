import type { LearningTrack, StarterFile } from '../types'

// These keys are kept only for the guarded migration from the former
// local-profile experience. New drafts always live under a learner UID.
export const PROJECT_DRAFTS_KEY = 'l2e-public-project-drafts-v1'
export const DAILY_DRAFTS_KEY = 'l2e-public-daily-drafts-v2'

const PROJECT_DRAFTS_PREFIX = 'l2e-public-project-drafts-v2:'
const DAILY_DRAFTS_PREFIX = 'l2e-public-daily-drafts-v3:'
const PLAYGROUND_DRAFT_PREFIX = 'l2e-public-playground-draft-v1:'
const DRAFT_MIGRATION_PREFIX = 'l2e-public-drafts-migrated-v1:'
const LEGACY_PROGRESS_KEY = 'l2e-lab-public-progress-v1'

export interface LearnerDraftOwner {
  uid: string
  username: string
}

export type SavedDraft = { files: StarterFile[]; updatedAt: string }
export type SavedPlaygroundDraft = { code: string; updatedAt: string }

type DraftKind = 'project' | 'daily'

function readDrafts(key: string): Record<string, SavedDraft> {
  if (typeof window === 'undefined') return {}
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) ?? '{}') as Record<string, SavedDraft>
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function legacyIdentityKey(value: string): string {
  return value
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[._-]+/g, '-')
}

function scopedDraftKey(kind: DraftKind, owner: LearnerDraftOwner): string {
  const prefix = kind === 'project' ? PROJECT_DRAFTS_PREFIX : DAILY_DRAFTS_PREFIX
  return `${prefix}${owner.uid}`
}

function legacyDraftKey(kind: DraftKind): string {
  return kind === 'project' ? PROJECT_DRAFTS_KEY : DAILY_DRAFTS_KEY
}

function migrateLegacyDrafts(kind: DraftKind, owner: LearnerDraftOwner, accountKey: string) {
  if (typeof window === 'undefined') return

  const migrationKey = `${DRAFT_MIGRATION_PREFIX}${kind}:${owner.uid}`
  try {
    if (window.localStorage.getItem(migrationKey) === 'true') return

    const legacyProgressRaw = window.localStorage.getItem(LEGACY_PROGRESS_KEY)
    const legacyProgress = legacyProgressRaw
      ? JSON.parse(legacyProgressRaw) as { displayName?: unknown }
      : null
    const legacyName = typeof legacyProgress?.displayName === 'string'
      ? legacyProgress.displayName
      : ''

    if (legacyIdentityKey(legacyName) === owner.username) {
      const legacyDraftsRaw = window.localStorage.getItem(legacyDraftKey(kind))
      if (legacyDraftsRaw) {
        // Parsing first prevents corrupt legacy data from replacing a clean
        // account store. Keep the old key for rollback compatibility.
        const legacyDrafts = JSON.parse(legacyDraftsRaw) as unknown
        if (legacyDrafts && typeof legacyDrafts === 'object' && !Array.isArray(legacyDrafts)) {
          window.localStorage.setItem(accountKey, JSON.stringify(legacyDrafts))
        }
      }
    }

    window.localStorage.setItem(migrationKey, 'true')
  } catch {
    // Blocked storage or corrupt legacy data simply starts this account clean.
  }
}

function readAccountDrafts(kind: DraftKind, owner: LearnerDraftOwner | null): Record<string, SavedDraft> {
  if (!owner || typeof window === 'undefined') return {}
  const key = scopedDraftKey(kind, owner)
  try {
    if (window.localStorage.getItem(key) === null) migrateLegacyDrafts(kind, owner, key)
  } catch {
    return {}
  }
  return readDrafts(key)
}

function writeDraft(kind: DraftKind, owner: LearnerDraftOwner, id: string, files: StarterFile[]) {
  const key = scopedDraftKey(kind, owner)
  const drafts = readAccountDrafts(kind, owner)
  drafts[id] = { files, updatedAt: new Date().toISOString() }
  window.localStorage.setItem(key, JSON.stringify(drafts))
}

function removeDraft(kind: DraftKind, owner: LearnerDraftOwner, id: string) {
  const key = scopedDraftKey(kind, owner)
  const drafts = readAccountDrafts(kind, owner)
  delete drafts[id]
  window.localStorage.setItem(key, JSON.stringify(drafts))
}

export function getProjectDraft(owner: LearnerDraftOwner | null, projectId: string) {
  return readAccountDrafts('project', owner)[projectId]
}

export function saveProjectDraft(owner: LearnerDraftOwner, projectId: string, files: StarterFile[]) {
  writeDraft('project', owner, projectId, files)
}

export function clearProjectDraft(owner: LearnerDraftOwner, projectId: string) {
  removeDraft('project', owner, projectId)
}

export function hasProjectDraft(owner: LearnerDraftOwner | null, projectId: string) {
  return Boolean(getProjectDraft(owner, projectId)?.files.length)
}

function dailyDraftId(track: LearningTrack, day: number) {
  return `${track}:${day}`
}

export function getDailyDraft(owner: LearnerDraftOwner | null, track: LearningTrack, day: number) {
  return readAccountDrafts('daily', owner)[dailyDraftId(track, day)]
}

export function saveDailyDraft(owner: LearnerDraftOwner, track: LearningTrack, day: number, files: StarterFile[]) {
  writeDraft('daily', owner, dailyDraftId(track, day), files)
}

export function clearDailyDraft(owner: LearnerDraftOwner, track: LearningTrack, day: number) {
  removeDraft('daily', owner, dailyDraftId(track, day))
}

export function hasDailyDraft(owner: LearnerDraftOwner | null, track: LearningTrack, day: number) {
  return Boolean(getDailyDraft(owner, track, day)?.files.length)
}

function playgroundDraftKey(owner: LearnerDraftOwner): string {
  return `${PLAYGROUND_DRAFT_PREFIX}${owner.uid}`
}

export function getPlaygroundDraft(owner: LearnerDraftOwner | null): SavedPlaygroundDraft | undefined {
  if (!owner || typeof window === 'undefined') return undefined
  try {
    const parsed = JSON.parse(window.localStorage.getItem(playgroundDraftKey(owner)) ?? 'null') as Partial<SavedPlaygroundDraft> | null
    if (!parsed || typeof parsed.code !== 'string' || typeof parsed.updatedAt !== 'string') return undefined
    return { code: parsed.code, updatedAt: parsed.updatedAt }
  } catch {
    return undefined
  }
}

export function savePlaygroundDraft(owner: LearnerDraftOwner, code: string) {
  const draft: SavedPlaygroundDraft = { code, updatedAt: new Date().toISOString() }
  window.localStorage.setItem(playgroundDraftKey(owner), JSON.stringify(draft))
}

export function clearPlaygroundDraft(owner: LearnerDraftOwner) {
  window.localStorage.removeItem(playgroundDraftKey(owner))
}
