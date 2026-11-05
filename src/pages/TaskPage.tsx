import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  changeTaskStatus,
  deleteTask,
  fetchTask,
  fetchTaskHistory,
} from '../api/tasks'
import { fetchExecutors } from '../api/profiles'
import { useAuth } from '../auth/useAuth'
import { EditTaskModal } from '../components/EditTaskModal'
import { Modal } from '../components/Modal'
import { EmptyState, ErrorPanel, PageHeader, PageLoader } from '../components/StatePanels'
import { StatusActionDialog } from '../components/StatusActionDialog'
import { StatusBadge } from '../components/StatusBadge'
import { TaskHistoryList } from '../components/TaskHistoryList'
import { toErrorMessage } from '../lib/errors'
import { displayName, formatDateTime } from '../lib/format'
import {
  canChangeAssignee,
  canDeleteTask,
  getTaskActions,
  isTasker,
  taskActionClass,
} from '../lib/statuses'
import type { TaskAction } from '../lib/statuses'
import type {
  ProfileSummary,
  TaskHistoryEntry,
  TaskWithRelations,
} from '../types'

export function TaskPage() {
  const { taskId } = useParams<{ taskId: string }>()
  const { profile } = useAuth()
  const navigate = useNavigate()

  const [task, setTask] = useState<TaskWithRelations | null>(null)
  const [history, setHistory] = useState<TaskHistoryEntry[]>([])
  const [executors, setExecutors] = useState<ProfileSummary[]>([])
  const [loadState, setLoadState] = useState<{ key: string | null; error: string | null }>({
    key: null,
    error: null,
  })
  const [reloadKey, setReloadKey] = useState(0)

  const [pendingAction, setPendingAction] = useState<TaskAction | null>(null)
  const [actionBusy, setActionBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const tasker = isTasker(profile)

  useEffect(() => {
    if (!taskId) {
      return
    }

    let active = true

    const load = async () => {
      try {
        const [nextTask, nextHistory, nextExecutors] = await Promise.all([
          fetchTask(taskId),
          fetchTaskHistory(taskId),
          tasker ? fetchExecutors() : Promise.resolve<ProfileSummary[]>([]),
        ])

        if (!active) {
          return
        }

        setTask(nextTask)
        setHistory(nextHistory)
        setExecutors(nextExecutors)
        setLoadState({ key: taskId, error: null })
      } catch (loadError) {
        if (!active) {
          return
        }

        setLoadState({ key: taskId, error: toErrorMessage(loadError) })
      }
    }

    void load()

    return () => {
      active = false
    }
  }, [taskId, tasker, reloadKey])

  const loading = loadState.key !== taskId
  const error = loadState.error

  const reload = () => {
    setLoadState({ key: null, error: null })
    setReloadKey((key) => key + 1)
  }

  const actions = useMemo(() => (task ? getTaskActions(task, profile) : []), [task, profile])

  const reworkComment = useMemo(() => {
    const reworkEntries = history.filter(
      (entry) => entry.from_status === 'on_review' && entry.to_status === 'rework',
    )
    const lastEntry = reworkEntries[reworkEntries.length - 1]
    return lastEntry?.comment ?? null
  }, [history])

  const handleAction = async (comment: string | null) => {
    if (!task || !pendingAction) {
      return
    }

    setActionBusy(true)
    setActionError(null)

    try {
      await changeTaskStatus(task.id, pendingAction.to, comment)
      setPendingAction(null)
      reload()
    } catch (actionFailure) {
      setActionError(toErrorMessage(actionFailure))
    } finally {
      setActionBusy(false)
    }
  }

  const handleDelete = async () => {
    if (!task) {
      return
    }

    setDeleteBusy(true)
    setDeleteError(null)

    try {
      await deleteTask(task.id)
      navigate(`/objects/${task.object_id}`, { replace: true })
    } catch (deleteFailure) {
      setDeleteError(toErrorMessage(deleteFailure))
      setDeleteBusy(false)
    }
  }

  if (error) {
    return (
      <div className="page-inner">
        <PageHeader title="Задача" backLink={<Link to="/objects">← Все объекты</Link>} />
        <ErrorPanel message={error} onRetry={reload} />
      </div>
    )
  }

  if (loading) {
    return (
      <div className="page-inner">
        <PageLoader label="Загружаем задачу…" />
      </div>
    )
  }

  if (!task) {
    return (
      <div className="page-inner">
        <PageHeader title="Задача" backLink={<Link to="/objects">← Все объекты</Link>} />
        <EmptyState
          title="Задача не найдена"
          description="Возможно, она была удалена или у вас нет к ней доступа."
        />
      </div>
    )
  }

  return (
    <div className="page-inner">
      <PageHeader
        title={task.title}
        backLink={
          <Link to={`/objects/${task.object_id}`}>
            ← {task.object?.name ?? 'Вернуться к объекту'}
          </Link>
        }
        subtitle={<StatusBadge status={task.status} />}
        actions={
          tasker ? (
            <>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setEditing(true)}
              >
                Изменить
              </button>
              <button
                type="button"
                className="btn btn-ghost danger-text"
                disabled={!canDeleteTask(task, profile)}
                title={
                  canDeleteTask(task, profile)
                    ? 'Удалить задачу'
                    : 'Удалять можно только задачи в статусе «Новая»'
                }
                onClick={() => {
                  setDeleteError(null)
                  setConfirmDelete(true)
                }}
              >
                Удалить
              </button>
            </>
          ) : null
        }
      />

      {reworkComment && task.status === 'rework' ? (
        <div className="alert alert-warning" role="status">
          <div>
            <strong>Задача возвращена на доработку</strong>
            <p>{reworkComment}</p>
          </div>
        </div>
      ) : null}

      <div className="detail-grid">
        <section className="card">
          <h2 className="card-title">Описание</h2>
          {task.description ? (
            <p className="description">{task.description}</p>
          ) : (
            <p className="muted">Описание не заполнено.</p>
          )}

          <dl className="meta">
            <div className="meta-row">
              <dt>Объект</dt>
              <dd>
                <Link to={`/objects/${task.object_id}`}>{task.object?.name ?? '—'}</Link>
              </dd>
            </div>
            <div className="meta-row">
              <dt>Исполнитель</dt>
              <dd>{displayName(task.assignee)}</dd>
            </div>
            <div className="meta-row">
              <dt>Постановщик</dt>
              <dd>{displayName(task.author)}</dd>
            </div>
            <div className="meta-row">
              <dt>Создана</dt>
              <dd>{formatDateTime(task.created_at)}</dd>
            </div>
            <div className="meta-row">
              <dt>Обновлена</dt>
              <dd>{formatDateTime(task.updated_at)}</dd>
            </div>
            <div className="meta-row">
              <dt>Смена исполнителя</dt>
              <dd className={canChangeAssignee(task) ? '' : 'muted'}>
                {canChangeAssignee(task) ? 'Доступна' : 'Заблокирована текущим статусом'}
              </dd>
            </div>
          </dl>

          {actions.length > 0 ? (
            <div className="task-actions">
              {actions.map((action) => (
                <button
                  type="button"
                  key={action.to}
                  className={taskActionClass(action)}
                  onClick={() => {
                    setActionError(null)
                    setPendingAction(action)
                  }}
                >
                  {action.label}
                </button>
              ))}
            </div>
          ) : null}
        </section>

        <section className="card">
          <h2 className="card-title">История статусов</h2>
          <TaskHistoryList entries={history} />
        </section>
      </div>

      {pendingAction ? (
        <StatusActionDialog
          action={pendingAction}
          busy={actionBusy}
          error={actionError}
          onSubmit={handleAction}
          onClose={() => {
            setPendingAction(null)
            setActionError(null)
          }}
        />
      ) : null}

      {editing ? (
        <EditTaskModal
          task={task}
          executors={executors}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false)
            reload()
          }}
        />
      ) : null}

      {confirmDelete ? (
        <Modal
          title="Удалить задачу?"
          onClose={() => setConfirmDelete(false)}
          footer={
            <div className="modal-foot-inline">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setConfirmDelete(false)}
                disabled={deleteBusy}
              >
                Отмена
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleDelete}
                disabled={deleteBusy}
              >
                {deleteBusy ? 'Удаляем…' : 'Удалить'}
              </button>
            </div>
          }
        >
          <p>
            Задача <strong>{task.title}</strong> будет удалена вместе с историей статусов.
          </p>
          {deleteError ? (
            <p className="form-error" role="alert">
              {deleteError}
            </p>
          ) : null}
        </Modal>
      ) : null}
    </div>
  )
}
