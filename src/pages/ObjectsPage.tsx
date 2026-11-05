import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  createObject,
  deleteObject,
  emptyTaskSummary,
  fetchObjects,
  fetchTaskSummaries,
  updateObject,
} from '../api/objects'
import type { ObjectInput } from '../api/objects'
import { useAuth } from '../auth/useAuth'
import { Modal } from '../components/Modal'
import { ObjectFormModal } from '../components/ObjectFormModal'
import { EmptyState, ErrorPanel, PageHeader, PageLoader } from '../components/StatePanels'
import { StatusCounters } from '../components/StatusBadge'
import { toErrorMessage } from '../lib/errors'
import { pluralTasks } from '../lib/format'
import { isTasker } from '../lib/statuses'
import type { ObjectTaskSummary, ProjectObject } from '../types'

export function ObjectsPage() {
  const { profile } = useAuth()
  const [objects, setObjects] = useState<ProjectObject[]>([])
  const [summaries, setSummaries] = useState<Record<string, ObjectTaskSummary>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [showCreate, setShowCreate] = useState(false)
  const [editing, setEditing] = useState<ProjectObject | null>(null)
  const [deleting, setDeleting] = useState<ProjectObject | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleteBusy, setDeleteBusy] = useState(false)

  useEffect(() => {
    let active = true

    Promise.all([fetchObjects(), fetchTaskSummaries()])
      .then(([nextObjects, nextSummaries]) => {
        if (!active) {
          return
        }

        setObjects(nextObjects)
        setSummaries(nextSummaries)
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
  }, [reloadKey])

  const reload = () => {
    setLoading(true)
    setError(null)
    setReloadKey((key) => key + 1)
  }

  const canManage = isTasker(profile)

  const handleCreate = async (input: ObjectInput) => {
    if (!profile) {
      return
    }

    await createObject(input, profile.id)
    setShowCreate(false)
    setReloadKey((key) => key + 1)
  }

  const handleUpdate = async (input: ObjectInput) => {
    if (!editing) {
      return
    }

    await updateObject(editing.id, input)
    setEditing(null)
    setReloadKey((key) => key + 1)
  }

  const handleDelete = async () => {
    if (!deleting) {
      return
    }

    setDeleteBusy(true)
    setDeleteError(null)

    try {
      await deleteObject(deleting.id)
      setDeleting(null)
      setReloadKey((key) => key + 1)
    } catch (deleteFailure) {
      setDeleteError(toErrorMessage(deleteFailure))
    } finally {
      setDeleteBusy(false)
    }
  }

  return (
    <div className="page-inner">
      <PageHeader
        title="Объекты"
        subtitle={loading ? 'Загрузка…' : `Всего объектов: ${objects.length}`}
        actions={
          canManage ? (
            <button type="button" className="btn btn-primary" onClick={() => setShowCreate(true)}>
              Новый объект
            </button>
          ) : null
        }
      />

      {error ? (
        <ErrorPanel message={error} onRetry={reload} />
      ) : loading ? (
        <PageLoader />
      ) : objects.length === 0 ? (
        <EmptyState
          title="Объектов пока нет"
          description={
            canManage
              ? 'Создайте первый объект и добавьте в него задачи.'
              : 'Вам пока не назначено ни одной задачи.'
          }
        />
      ) : (
        <div className="object-grid">
          {objects.map((object) => {
            const summary = summaries[object.id] ?? emptyTaskSummary()
            const deleteBlocked = summary.total > 0

            return (
              <article className="object-card" key={object.id}>
                <div>
                  <Link to={`/objects/${object.id}`} className="object-card-title">
                    {object.name}
                  </Link>
                  <p className="muted object-card-address">
                    {object.address ?? 'Адрес не указан'}
                  </p>
                </div>

                <div className="object-card-foot">
                  <span className="muted">{pluralTasks(summary.total)}</span>
                  <StatusCounters summary={summary} />
                </div>

                {canManage ? (
                  <div className="object-card-actions">
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => setEditing(object)}
                    >
                      Изменить
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm danger-text"
                      disabled={deleteBlocked}
                      title={
                        deleteBlocked
                          ? 'Нельзя удалить объект, пока в нём есть задачи'
                          : 'Удалить объект'
                      }
                      onClick={() => {
                        setDeleteError(null)
                        setDeleting(object)
                      }}
                    >
                      Удалить
                    </button>
                  </div>
                ) : null}
              </article>
            )
          })}
        </div>
      )}

      {showCreate ? (
        <ObjectFormModal
          title="Новый объект"
          submitLabel="Создать"
          onSubmit={handleCreate}
          onClose={() => setShowCreate(false)}
        />
      ) : null}

      {editing ? (
        <ObjectFormModal
          title="Редактирование объекта"
          submitLabel="Сохранить"
          initial={{ name: editing.name, address: editing.address }}
          onSubmit={handleUpdate}
          onClose={() => setEditing(null)}
        />
      ) : null}

      {deleting ? (
        <DeleteObjectModal
          object={deleting}
          busy={deleteBusy}
          error={deleteError}
          onConfirm={handleDelete}
          onClose={() => setDeleting(null)}
        />
      ) : null}
    </div>
  )
}

interface DeleteObjectModalProps {
  object: ProjectObject
  busy: boolean
  error: string | null
  onConfirm: () => void
  onClose: () => void
}

function DeleteObjectModal({ object, busy, error, onConfirm, onClose }: DeleteObjectModalProps) {
  return (
    <Modal
      title="Удалить объект?"
      onClose={onClose}
      footer={
        <div className="modal-foot-inline">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>
            Отмена
          </button>
          <button type="button" className="btn btn-danger" onClick={onConfirm} disabled={busy}>
            {busy ? 'Удаляем…' : 'Удалить'}
          </button>
        </div>
      }
    >
      <p>
        Объект <strong>{object.name}</strong> будет удалён безвозвратно.
      </p>
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
    </Modal>
  )
}
