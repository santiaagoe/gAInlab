import type { Session } from '../engine/types'
import { relativeDay } from '../format'

/** One saved session in a list; tapping it opens the editor. */
export function HistoryRow({ session, onOpen }: { session: Session; onOpen: (s: Session) => void }) {
  const sets = session.exercises.reduce((n, e) => n + e.sets.length, 0)
  return (
    <button className="history-btn" onClick={() => onOpen(session)}>
      <span>{session.dayName}</span>
      <span className="meta">
        {relativeDay(session.date)}, {sets === 1 ? '1 serie' : `${sets} series`}
      </span>
    </button>
  )
}
