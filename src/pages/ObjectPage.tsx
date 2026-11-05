import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { fetchExecutors } from '../api/profiles'
import { fetchObject } from '../api/objects'
import { fetchTasksByObject } from '../api/tasks'
import { useAuth } from '../auth/useAuth'
import { CreateTaskModal } from '../components/CreateTaskModal'
import { EmptyState, ErrorPanel, PageHeader, PageLoader } from '../components/StatePanels'
import { StatusCounters, StatusFilter } from '../components/StatusBadge'
import { TaskRow } from '../components/TaskRow'
import { toErrorMessage } from '../lib/errors'
import { isTasker } from '../lib/statuses'
import { sortTasks, summarizeTasks } from '../lib/summaries'
import type { ProfileSummary, ProjectObject, TaskStatus, TaskWithRelations } from '../types'

export function ObjectPage() {
  const { objectId } = useParams<{ objectId: string }>()
  const { profile } = useAuth()
  const [object, setObject] = useState<ProjectObject | null>(null)
  const [tasks, setTasks] = useState<TaskWithRelations[]>([])
  const [executors, setExecutors] = useState<ProfileSummary[]>([])
  const [loadState, setLoadState] = useState<{ key: string | null; error: string | null }>({
    key: null,
    error: null,
  })
  const [reloadKey, setReloadKey] = useState(0)
  const [showCreate, setShowCreate] = useState(false)
  const [filter, setFilter] = useState<TaskStatus | 'all'>('all')

  const tasker = isTasker(profile)

  useEffect(() => {
    if (!objectId) {
      return
    }

    let active = true

    const load = async () => {
      try {
        const [nextObject, nextTasks] = await Promise.all([
          fetchObject(objectId),
          fetchTasksByObject(objectId),
        ])

        const nextExecutors = tasker ? await fetchExecutors() : []

        if (!active) {
          return
        }

        setObject(nextObject)
        setTasks(nextTasks)
        setExecutors(nextExecutors)
        setLoadState({ key: objectId, error: null })
      } catch (loadError) {
        if (!active) {
          return
        }

        setLoadState({ key: objectId, error: toErrorMessage(loadError) })
      }
    }

    void load()

    return () => {
      active = false
    }
  }, [objectId, tasker, reloadKey])

  const loading = loadState.key !== objectId
  const error = loadState.error

  const summary = useMemo(() => summarizeTasks(tasks), [tasks])

  const visibleTasks = useMemo(() => {
    const filtered = filter === 'all' ? tasks : tasks.filter((task) => task.status === filter)
    return sortTasks(filtered)
  }, [tasks, filter])

  const reload = () => {
    setLoadState({ key: null, error: null })
    setReloadKey((key) => key + 1)
  }

  return (
    <div className="page-inner">
      <PageHeader
        title={object?.name ?? 'Объект'}
        backLink={<Link to="/objects">← Все объекты</Link>}
        subtitle={
          <>
            <span>{object?.address ?? 'Адрес не указан'}</span>
            {!loading && object ? (
              <span className="page-subtitle-row">
                <StatusCounters summary={summary} />
              </span>
            ) : null}
          </>
        }
        actions={
          tasker ? (
            <button type="button" className="btn btn-primary" onClick={() => setShowCreate(true)}>
              Новая задача
            </button>
          ) : null
        }
      />

      {error ? (
        <ErrorPanel message={error} onRetry={reload} />
      ) : loading ? (
        <PageLoader />
      ) : !object ? (
        <EmptyState
          title="Объект не найден"
          description="Возможно, он был удалён или у вас нет к нему доступа."
        />
      ) : (
        <>
          <StatusFilter summary={summary} value={filter} onChange={setFilter} />

          {visibleTasks.length === 0 ? (
            <EmptyState
              title={filter === 'all' ? 'Задач пока нет' : 'Задач с таким статусом нет'}
              description={
                tasker && filter === 'all'
                  ? 'Создайте первую задачу по этому объекту.'
                  : undefined
              }
            />
          ) : (
            <div className="task-list">
              {visibleTasks.map((task) => (
                <TaskRow task={task} key={task.id} />
              ))}
            </div>
          )}
        </>
      )}

      {showCreate && object && profile ? (
        <CreateTaskModal
          objectId={object.id}
          objectName={object.name}
          authorId={profile.id}
          executors={executors}
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false)
            reload()
          }}
        />
      ) : null}
    </div>
  )
}
