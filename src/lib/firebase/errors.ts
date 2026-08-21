import { FirebaseError } from 'firebase/app'

export type FirebaseClientErrorCode =
  | 'not-in-browser'
  | 'not-configured'
  | 'permission-denied'
  | 'network-error'
  | 'service-unavailable'
  | 'invalid-display-name'
  | 'unknown'

export class FirebaseClientError extends Error {
  readonly code: FirebaseClientErrorCode
  readonly retryable: boolean
  readonly cause?: unknown

  constructor(
    code: FirebaseClientErrorCode,
    message: string,
    options?: { cause?: unknown; retryable?: boolean },
  ) {
    super(message)
    this.name = 'FirebaseClientError'
    this.code = code
    this.retryable = options?.retryable ?? false
    this.cause = options?.cause
  }
}

export function toFirebaseClientError(error: unknown): FirebaseClientError {
  if (error instanceof FirebaseClientError) return error

  if (error instanceof FirebaseError) {
    if (error.code === 'permission-denied' || error.code === 'firestore/permission-denied') {
      return new FirebaseClientError(
        'permission-denied',
        'Firebase refused this learner update.',
        { cause: error },
      )
    }
    if (
      error.code === 'auth/network-request-failed'
      || error.code === 'firestore/unavailable'
      || error.code === 'unavailable'
    ) {
      return new FirebaseClientError(
        'network-error',
        'L2E LAB could not reach Firebase. Local progress is still available.',
        { cause: error, retryable: true },
      )
    }
    if (error.code === 'firestore/failed-precondition') {
      return new FirebaseClientError(
        'service-unavailable',
        'Firebase is not ready to save learner progress yet.',
        { cause: error, retryable: true },
      )
    }
  }

  return new FirebaseClientError(
    'unknown',
    'L2E LAB could not sync this learner right now.',
    { cause: error, retryable: true },
  )
}
