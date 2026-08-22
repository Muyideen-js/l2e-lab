import { useEffect, useMemo, useRef, useState } from 'react'
import type { editor as MonacoEditor } from 'monaco-editor'
import { getYjsProviderForRoom } from '@liveblocks/yjs'
import { MonacoBinding } from 'y-monaco'
import type { Awareness } from 'y-protocols/awareness'
import type { LearnerAuthSession } from '../../lib/firebase'
import { getPairClient, type PairUserInfo } from './liveblocksClient'

export type PairConnectionState = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'error' | 'full'

export type PairLearner = PairUserInfo & { id: string; isYou?: boolean }

type PairProgrammingOptions = {
  roomId: string | null
  editor: MonacoEditor.IStandaloneCodeEditor | null
  initialCode: string
  session: LearnerAuthSession | null
}

const PAIR_COLORS = ['#38bdf8', '#34d399', '#f59e0b', '#f472b6', '#a78bfa', '#fb7185']

function colorFor(value: string) {
  let hash = 0
  for (const character of value) hash = ((hash << 5) - hash + character.charCodeAt(0)) | 0
  return PAIR_COLORS[Math.abs(hash) % PAIR_COLORS.length]
}

function readableError(error: unknown) {
  const message = error instanceof Error ? error.message : ''
  if (message.includes('fetch') || message.includes('endpoint')) {
    return 'The live collaboration server is not available. Check the Liveblocks setup.'
  }
  return message || 'This pair-programming room could not connect.'
}

export function usePairProgramming({ roomId, editor, initialCode, session }: PairProgrammingOptions) {
  const [state, setState] = useState<PairConnectionState>(roomId ? 'connecting' : 'idle')
  const [learners, setLearners] = useState<PairLearner[]>([])
  const [error, setError] = useState('')
  const initialCodeRef = useRef(initialCode)

  useEffect(() => {
    initialCodeRef.current = initialCode
  }, [initialCode])

  useEffect(() => {
    if (!roomId || !editor || !session) {
      setState(roomId ? 'connecting' : 'idle')
      setLearners([])
      setError('')
      return
    }

    let disposed = false
    let roomFull = false
    let binding: MonacoBinding | null = null
    const client = getPairClient()
    const localInfo: PairUserInfo = { name: session.username, color: colorFor(session.uid) }
    const { room, leave } = client.enterRoom(roomId, { initialPresence: {} })
    const provider = getYjsProviderForRoom(room, undefined, true)
    const yDoc = provider.getYDoc()
    const yText = yDoc.getText('python')
    const model = editor.getModel()

    setState('connecting')
    setError('')
    provider.awareness.setLocalStateField('user', localInfo)

    const updateLearners = () => {
      const others = room.getOthers()
      if (others.length > 1) {
        roomFull = true
        setState('full')
        setError('This room already has two learners. Ask for a new invite link.')
        provider.destroy()
        leave()
        return
      }

      setLearners([
        { id: session.uid, ...localInfo, isYou: true },
        ...others.map((other) => ({
          id: other.id ?? `connection-${other.connectionId}`,
          name: other.info?.name || 'Pair learner',
          color: other.info?.color || '#94a3b8',
        })),
      ])
    }

    const bindEditor = (synced: unknown) => {
      if (disposed || synced !== true || binding || !model) return
      if (yText.length === 0 && initialCodeRef.current) {
        yText.insert(0, initialCodeRef.current)
      }
      binding = new MonacoBinding(
        yText,
        model,
        new Set([editor]),
        provider.awareness as unknown as Awareness,
      )
      setState('connected')
    }

    const unsubscribeOthers = room.subscribe('others', updateLearners)
    const unsubscribeStatus = room.subscribe('status', (status) => {
      if (disposed || roomFull) return
      if (status === 'connected') setState(provider.synced ? 'connected' : 'connecting')
      else if (status === 'reconnecting') setState('reconnecting')
      else if (status === 'disconnected') setState('reconnecting')
    })
    const unsubscribeError = room.subscribe('error', (nextError) => {
      if (disposed) return
      setState('error')
      setError(readableError(nextError))
    })

    provider.on('sync', bindEditor)
    updateLearners()
    if (provider.synced) bindEditor(true)

    return () => {
      disposed = true
      unsubscribeOthers()
      unsubscribeStatus()
      unsubscribeError()
      provider.off('sync', bindEditor)
      binding?.destroy()
      provider.destroy()
      leave()
      setLearners([])
    }
  }, [editor, roomId, session])

  return useMemo(() => ({ state, learners, error }), [error, learners, state])
}
