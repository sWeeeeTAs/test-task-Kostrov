import { useEffect, useMemo, useState } from 'react'
import { fetchMyTasks } from '../api/tasks'
import { useAuth } from '../auth/useAuth'
import { EmptyState, ErrorPanel, PageHeader, PageLoader } from '../components/StatePanels'
import { StatusFilter } from '../components/StatusBadge'
import { TaskRow } from '../components/TaskRow'
import { toErrorMessage } from '../lib/errors'
import { sortTasks, summarizeTasks } from '../lib/summaries'
import type { TaskStatus, TaskWithRelations } from '../types'

export function MyTasksPage() {
  const { profile } = useAuth()
  const [tasks, setTasks] = useState<TaskWithRelations[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [filter, setFilter] = useState<TaskStatus | 'all'>('all')

  const userId = profile?.id ?? null

  useEffect(() => {
    if (!userId) {
      return
    }

    let active = true

    fetchMyTasks(userId)
      .then((nextTasks) => {
        if (!active) {
          return
        }

        setTasks(nextTasks)
        setError(null)
      })
      .catch((loadError: unknown) => {
        if (active) {
          setError(toErrorMessage(loadError))
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false)
        }
      })

    return () => {
      active = false
    }
  }, [userId, reloadKey])

  const reload = () => {
    setLoading(true)
    setError(null)
    setReloadKey((key) => key + 1)
  }

  const summary = useMemo(() => summarizeTasks(tasks), [tasks])

  const groups = useMemo(() => {
    const filtered = filter === 'all' ? tasks : tasks.filter((task) => task.status === filter)
    const byObject = new Map<string, TaskWithRelations[]>()

    for (const task of sortTasks(filtered)) {
      const bucket = byObject.get(task.object_id) ?? []
      bucket.push(task)
      byObject.set(task.object_id, bucket)
    }

    return [...byObject.entries()]
  }, [tasks, filter])

  return (
    <div className="page-inner">
      <PageHeader
        title="Мои задачи"
        subtitle={loading ? 'Загрузка…' : `Назначено: ${summary.total}`}
      />

      {error ? (
        <ErrorPanel message={error} onRetry={reload} />
      ) : loading ? (
        <PageLoader />
      ) : tasks.length === 0 ? (
        <EmptyState
          title="Задач нет"
          description="Как только постановщик назначит на вас задачу, она появится здесь."
        />
      ) : (
        <>
          <StatusFilter summary={summary} value={filter} onChange={setFilter} />

          {groups.length === 0 ? (
            <EmptyState title="Задач с таким статусом нет" />
          ) : (
            <div className="stack">
              {groups.map(([objectId, groupTasks]) => (
                <section className="card" key={objectId}>
                  <h2 className="card-title">{groupTasks[0].object?.name ?? 'Без объекта'}</h2>
                  <div className="task-list">
                    {groupTasks.map((task) => (
                      <TaskRow task={task} key={task.id} />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
