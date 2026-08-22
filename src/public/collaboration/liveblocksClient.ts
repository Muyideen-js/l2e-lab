import { createClient, type BaseUserMeta } from '@liveblocks/client'
import { getLearnerIdToken } from '../../lib/firebase'

export type PairUserInfo = {
  name: string
  color: string
}

export type PairUserMeta = BaseUserMeta & {
  info: PairUserInfo
}

let pairClient: ReturnType<typeof createClient<PairUserMeta>> | null = null

export function getPairClient() {
  pairClient ??= createClient<PairUserMeta>({
    authEndpoint: async (room) => {
      const idToken = await getLearnerIdToken()
      const response = await fetch('/api/liveblocks-auth', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${idToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ room }),
      })

      const body = await response.json().catch(() => ({
        error: 'The collaboration server returned an invalid response.',
        reason: 'INVALID_RESPONSE',
      })) as { token?: string; error?: string }

      if (!response.ok) {
        throw new Error(body.error || 'L2E LAB could not open this pair-programming room.')
      }
      if (!body.token) throw new Error('The collaboration server did not return a room token.')
      return { token: body.token }
    },
    throttle: 50,
  })

  return pairClient
}
