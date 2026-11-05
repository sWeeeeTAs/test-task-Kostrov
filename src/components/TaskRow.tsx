import { Link } from 'react-router-dom'
import { displayName, formatDateTime } from '../lib/format'
import type { TaskWithRelations } from '../types'
import { StatusBadge } from './StatusBadge'

interface TaskRowProps {
  task: TaskWithRelations
  showObject?: boolean
}

export function TaskRow({ task, showObject = false }: TaskRowProps) {
  return (
    <Link to={`/tasks/${task.id}`} className="task-row">
      <div className="task-row-main">
        <span className="task-row-title">{task.title}</span>
        <span className="task-row-meta">
          {showObject && task.object ? (
            <>
              <span>{task.object.name}</span>
              <span className="dot">·</span>
            </>
          ) : null}
          <span>Исполнитель: {displayName(task.assignee)}</span>
          <span className="dot">·</span>
          <span>от {formatDateTime(task.created_at)}</span>
        </span>
      </div>
      <StatusBadge status={task.status} />
    </Link>
  )
}
