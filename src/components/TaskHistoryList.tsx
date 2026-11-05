import { STATUS_LABELS } from '../lib/statuses'
import { displayName, formatDateTime } from '../lib/format'
import type { TaskHistoryEntry } from '../types'

export function TaskHistoryList({ entries }: { entries: TaskHistoryEntry[] }) {
  if (entries.length === 0) {
    return <p className="muted">История пока пуста.</p>
  }

  return (
    <ol className="history">
      {entries.map((entry) => (
        <li className="history-item" key={entry.id}>
          <div className="history-head">
            <span className="history-change">
              {entry.from_status ? STATUS_LABELS[entry.from_status] : 'Создание'}
              <span className="arrow">→</span>
              {STATUS_LABELS[entry.to_status]}
            </span>
            <time className="muted" dateTime={entry.created_at}>
              {formatDateTime(entry.created_at)}
            </time>
          </div>
          <div className="history-author">{displayName(entry.actor)}</div>
          {entry.comment ? <p className="history-comment">{entry.comment}</p> : null}
        </li>
      ))}
    </ol>
  )
}
