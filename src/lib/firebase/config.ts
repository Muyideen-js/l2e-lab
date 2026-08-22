import type { FirebaseOptions } from 'firebase/app'

/**
 * Firebase web configuration is injected at build time. Although Firebase
 * client configuration is public metadata, keeping project-specific values
 * out of source prevents automated secret alerts and accidental reuse.
 */
function envValue(name: keyof ImportMetaEnv): string | undefined {
  const value = import.meta.env[name]
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

export const firebaseConfig: FirebaseOptions = Object.freeze({
  apiKey: envValue('VITE_FIREBASE_API_KEY'),
  authDomain: envValue('VITE_FIREBASE_AUTH_DOMAIN'),
  projectId: envValue('VITE_FIREBASE_PROJECT_ID'),
  storageBucket: envValue('VITE_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: envValue('VITE_FIREBASE_MESSAGING_SENDER_ID'),
  appId: envValue('VITE_FIREBASE_APP_ID'),
  measurementId: envValue('VITE_FIREBASE_MEASUREMENT_ID'),
})

export function isFirebaseConfigured(): boolean {
  return Boolean(
    firebaseConfig.apiKey
    && firebaseConfig.authDomain
    && firebaseConfig.projectId
    && firebaseConfig.appId,
  )
}
