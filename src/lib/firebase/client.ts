import type { FirebaseApp } from 'firebase/app'
import type { Auth } from 'firebase/auth'
import type { Firestore } from 'firebase/firestore'
import { firebaseConfig, isFirebaseConfigured } from './config'
import { FirebaseClientError, toFirebaseClientError } from './errors'

const APP_NAME = 'l2e-lab-client'

export interface FirebaseClient {
  app: FirebaseApp
  auth: Auth
  db: Firestore
}

let clientPromise: Promise<FirebaseClient> | null = null

function assertBrowser() {
  if (typeof window === 'undefined') {
    throw new FirebaseClientError(
      'not-in-browser',
      'Firebase learner tracking is available only in the browser.',
    )
  }
}

async function createFirebaseClient(): Promise<FirebaseClient> {
  assertBrowser()
  if (!isFirebaseConfigured()) {
    throw new FirebaseClientError('not-configured', 'Firebase has not been configured for L2E LAB.')
  }

  const [appSdk, authSdk, firestoreSdk] = await Promise.all([
    import('firebase/app'),
    import('firebase/auth'),
    import('firebase/firestore'),
  ])
  const app = appSdk.getApps().find((candidate) => candidate.name === APP_NAME)
    ?? appSdk.initializeApp(firebaseConfig, APP_NAME)
  const auth = authSdk.getAuth(app)

  // Learner accounts should remain signed in across reloads and browser
  // restarts until the learner explicitly signs out.
  await authSdk.setPersistence(auth, authSdk.browserLocalPersistence)

  return { app, auth, db: firestoreSdk.getFirestore(app) }
}

export async function getFirebaseClient(): Promise<FirebaseClient> {
  clientPromise ??= createFirebaseClient()
  try {
    return await clientPromise
  } catch (error) {
    clientPromise = null
    throw toFirebaseClientError(error)
  }
}
