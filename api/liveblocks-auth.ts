import { Liveblocks } from '@liveblocks/node'

type ApiRequest = {
  method?: string
  body?: { room?: unknown }
  headers: { authorization?: string | string[] }
}

type ApiResponse = {
  setHeader: (name: string, value: string) => void
  status: (statusCode: number) => ApiResponse
  json: (body: unknown) => unknown
  send: (body: string) => unknown
}

const ROOM_LIFETIME_MS = 24 * 60 * 60 * 1000
const ROOM_PATTERN = /^l2e-pair-python-(\d{1,3})-([a-z0-9]+)-[a-z0-9]{10}$/
const INTERNAL_EMAIL_PATTERN = /^l2e-([a-z0-9](?:[a-z0-9-]*[a-z0-9])?)@learners\.l2e-lab\.invalid$/
const COLORS = ['#38bdf8', '#34d399', '#f59e0b', '#f472b6', '#a78bfa', '#fb7185']

type FirebaseAccount = {
  localId?: string
  email?: string
  displayName?: string
}

function colorFor(value: string) {
  let hash = 0
  for (const character of value) hash = ((hash << 5) - hash + character.charCodeAt(0)) | 0
  return COLORS[Math.abs(hash) % COLORS.length]
}

function roomCreatedAt(room: string): number | null {
  const match = room.match(ROOM_PATTERN)
  if (!match) return null
  const day = Number(match[1])
  const timestamp = Number.parseInt(match[2], 36)
  if (!Number.isInteger(day) || day < 1 || day > 100 || !Number.isFinite(timestamp)) return null
  return timestamp
}

async function verifyFirebaseToken(idToken: string, apiKey: string): Promise<FirebaseAccount | null> {
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
  })
  if (!response.ok) return null
  const payload = await response.json() as { users?: FirebaseAccount[] }
  return payload.users?.[0] ?? null
}

export default async function handler(request: ApiRequest, response: ApiResponse) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST')
    return response.status(405).json({ error: 'Use POST to authorize a collaboration room.' })
  }

  const secret = process.env.LIVEBLOCKS_SECRET_KEY
  const firebaseApiKey = process.env.VITE_FIREBASE_API_KEY
  if (!secret || !firebaseApiKey) {
    return response.status(503).json({ error: 'Pair programming has not been configured on this deployment yet.' })
  }

  const room = typeof request.body?.room === 'string' ? request.body.room : ''
  const createdAt = roomCreatedAt(room)
  const roomAge = createdAt === null ? Number.POSITIVE_INFINITY : Date.now() - createdAt
  if (createdAt === null || roomAge < -60_000 || roomAge > ROOM_LIFETIME_MS) {
    return response.status(403).json({ error: 'This invite link is invalid or has expired. Ask for a new one.' })
  }

  const authorizationHeader = request.headers.authorization
  const authorization = Array.isArray(authorizationHeader) ? authorizationHeader[0] : authorizationHeader
  const idToken = authorization?.startsWith('Bearer ') ? authorization.slice(7) : ''
  if (!idToken) return response.status(401).json({ error: 'Sign in to L2E LAB before joining this room.' })

  try {
    const account = await verifyFirebaseToken(idToken, firebaseApiKey)
    const username = account?.email?.match(INTERNAL_EMAIL_PATTERN)?.[1]
    if (!account?.localId || !username) {
      return response.status(401).json({ error: 'This is not a valid L2E LAB learner account.' })
    }

    const liveblocks = new Liveblocks({ secret })
    const session = liveblocks.prepareSession(account.localId, {
      userInfo: {
        name: account.displayName?.trim().slice(0, 40) || username,
        color: colorFor(account.localId),
      },
    })
    session.allow(room, ['*:write'])
    const authResponse = await session.authorize()
    response.status(authResponse.status)
    response.setHeader('Content-Type', 'application/json')
    return response.send(authResponse.body)
  } catch (error) {
    console.error('[L2E LAB] Liveblocks authorization failed.', error)
    return response.status(503).json({ error: 'The collaboration service is temporarily unavailable.' })
  }
}
