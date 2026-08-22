export { firebaseConfig, isFirebaseConfigured } from './config'
export {
  getFirebaseClient,
  type FirebaseClient,
} from './client'
export {
  LearnerAuthError,
  getCurrentLearnerSession,
  getLearnerIdToken,
  normalizeLearnerUsername,
  observeLearnerAuth,
  signInLearner,
  signOutLearner,
  signUpLearner,
  toLearnerAuthError,
  type LearnerAuthErrorCode,
  type LearnerAuthSession,
  type LearnerAuthState,
  type LearnerAuthUnsubscribe,
} from './learnerAuth'
export {
  FirebaseClientError,
  toFirebaseClientError,
  type FirebaseClientErrorCode,
} from './errors'
export {
  LEARNERS_COLLECTION,
  LEARNER_SCHEMA_VERSION,
  subscribeToOwnLearnerProgress,
  syncLearnerProgress,
  upsertLearner,
  type HydratedLearnerProgress,
  type LearnerDailyProgress,
  type LearnerDocument,
  type LearnerProgressSnapshot,
  type LearnerSyncInput,
  type LearnerSyncResult,
  type LearnerTrack,
} from './learners'
