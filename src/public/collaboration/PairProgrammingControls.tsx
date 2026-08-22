import { Check, Copy, Link2, LoaderCircle, LogOut, Users, WifiOff } from 'lucide-react'
import type { PairConnectionState, PairLearner } from './usePairProgramming'
import './pair-programming.css'

type Props = {
  roomId: string | null
  state: PairConnectionState
  learners: PairLearner[]
  error: string
  copied: boolean
  onStart: () => void
  onCopy: () => void
  onLeave: () => void
}

function statusLabel(state: PairConnectionState, learnerCount: number) {
  if (state === 'connected') return learnerCount > 1 ? 'Coding together' : 'Waiting for partner'
  if (state === 'reconnecting') return 'Reconnecting'
  if (state === 'full') return 'Room is full'
  if (state === 'error') return 'Connection failed'
  return 'Opening room'
}

export function PairProgrammingControls({ roomId, state, learners, error, copied, onStart, onCopy, onLeave }: Props) {
  if (!roomId) {
    return <button type="button" className="pair-start" onClick={onStart}><Users size={14} /> Pair program</button>
  }

  return (
    <div className={`pair-controls pair-controls--${state}`}>
      <div className="pair-people" aria-label="Learners in this room">
        {learners.map((learner) => (
          <span key={learner.id} className="pair-avatar" style={{ '--pair-color': learner.color } as React.CSSProperties} title={`${learner.name}${learner.isYou ? ' (you)' : ''}`}>
            {learner.name.slice(0, 1).toUpperCase()}
          </span>
        ))}
        {learners.length < 2 && <span className="pair-avatar pair-avatar--empty">+</span>}
      </div>
      <span className="pair-status" title={error || undefined}>
        {state === 'connecting' || state === 'reconnecting' ? <LoaderCircle className="spin" size={13} /> : state === 'error' || state === 'full' ? <WifiOff size={13} /> : <span className="pair-live-dot" />}
        {statusLabel(state, learners.length)}
      </span>
      {state !== 'full' && <button type="button" className="pair-copy" onClick={onCopy}>{copied ? <Check size={13} /> : <Copy size={13} />}{copied ? 'Copied' : 'Invite'}</button>}
      <button type="button" className="pair-leave" onClick={onLeave} aria-label="Leave pair-programming room" title="Leave room"><LogOut size={13} /></button>
      {error && <div className="pair-error"><Link2 size={13} /> {error}</div>}
    </div>
  )
}
