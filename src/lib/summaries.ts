import type { ObjectTaskSummary, Task, TaskStatus } from '../types'

export function summarizeTasks(tasks: Array<{ status: TaskStatus }>): ObjectTaskSummary {
  const summary: ObjectTaskSummary = {
    total: tasks.length,
    byStatus: {
      new: 0,
      in_progress: 0,
      on_review: 0,
      rework: 0,
      accepted: 0,
    },
  }

  for (const task of tasks) {
    summary.byStatus[task.status] += 1
  }

  return summary
}

export function sortTasks<T extends Task>(tasks: T[]): T[] {
  const rank: Record<TaskStatus, number> = {
    rework: 0,
    new: 1,
    in_progress: 2,
    on_review: 3,
    accepted: 4,
  }

  return [...tasks].sort((left, right) => {
    const rankDiff = rank[left.status] - rank[right.status]

    if (rankDiff !== 0) {
      return rankDiff
    }

    return new Date(right.created_at).getTime() - new Date(left.created_at).getTime()
  })
}
