import type { ObjectTaskSummary, TaskStatus } from '../types'
import { STATUS_LABELS, STATUS_ORDER } from '../lib/statuses'

export function StatusBadge({ status }: { status: TaskStatus }) {
  return <span className={`badge badge-${status}`}>{STATUS_LABELS[status]}</span>
}

export function StatusCounters({ summary }: { summary: ObjectTaskSummary }) {
  const items = STATUS_ORDER.filter((status) => summary.byStatus[status] > 0)

  if (items.length === 0) {
    return <span className="muted">Задач нет</span>
  }

  return (
    <span className="status-counters">
      {items.map((status) => (
        <span className={`counter counter-${status}`} key={status}>
          {STATUS_LABELS[status]}: {summary.byStatus[status]}
        </span>
      ))}
    </span>
  )
}

interface StatusFilterProps {
  summary: ObjectTaskSummary
  value: TaskStatus | 'all'
  onChange: (value: TaskStatus | 'all') => void
}

export function StatusFilter({ summary, value, onChange }: StatusFilterProps) {
  return (
    <div className="chip-row" role="group" aria-label="Фильтр по статусу">
      <button
        type="button"
        className={value === 'all' ? 'chip chip-active' : 'chip'}
        onClick={() => onChange('all')}
      >
        Все ({summary.total})
      </button>
      {STATUS_ORDER.map((status) => (
        <button
          type="button"
          key={status}
          className={value === status ? 'chip chip-active' : 'chip'}
          onClick={() => onChange(status)}
        >
          {STATUS_LABELS[status]} ({summary.byStatus[status]})
        </button>
      ))}
    </div>
  )
}
