import { useState } from 'react'
import type { FormEvent } from 'react'
import { updateTask } from '../api/tasks'
import { toErrorMessage } from '../lib/errors'
import { canChangeAssignee } from '../lib/statuses'
import type { ProfileSummary, TaskWithRelations } from '../types'
import { Modal } from './Modal'

interface EditTaskModalProps {
  task: TaskWithRelations
  executors: ProfileSummary[]
  onClose: () => void
  onSaved: () => void
}

export function EditTaskModal({ task, executors, onClose, onSaved }: EditTaskModalProps) {
  const [title, setTitle] = useState(task.title)
  const [description, setDescription] = useState(task.description ?? '')
  const [assigneeId, setAssigneeId] = useState(task.assignee_id ?? '')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const assigneeLocked = !canChangeAssignee(task)

  const options = [...executors]
  if (task.assignee && !options.some((executor) => executor.id === task.assignee?.id)) {
    options.unshift(task.assignee)
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const trimmedTitle = title.trim()
    if (trimmedTitle === '') {
      setError('Укажите название задачи.')
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      await updateTask(task.id, {
        title: trimmedTitle,
        description: description.trim() === '' ? null : description.trim(),
        assigneeId: assigneeId === '' ? null : assigneeId,
      })

      onSaved()
    } catch (submitError) {
      setError(toErrorMessage(submitError))
      setSubmitting(false)
    }
  }

  return (
    <Modal title="Редактирование задачи" onClose={onClose} size="wide">
      <form className="form" onSubmit={handleSubmit}>
        <p className="muted">
          Объект: <strong>{task.object?.name ?? '—'}</strong>
        </p>

        <label className="field">
          <span className="field-label">Название</span>
          <input
            className="input"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={200}
            required
            autoFocus
          />
        </label>

        <label className="field">
          <span className="field-label">Описание</span>
          <textarea
            className="textarea"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={5}
            maxLength={5000}
          />
        </label>

        <label className="field">
          <span className="field-label">Исполнитель</span>
          <select
            className="select"
            value={assigneeId}
            disabled={assigneeLocked}
            onChange={(event) => setAssigneeId(event.target.value)}
          >
            <option value="">Не назначен</option>
            {options.map((executor) => (
              <option key={executor.id} value={executor.id}>
                {executor.full_name?.trim() || executor.email}
              </option>
            ))}
          </select>
          {assigneeLocked ? (
            <span className="field-hint">
              Исполнителя можно менять только в статусах «Новая» и «На доработке».
            </span>
          ) : null}
        </label>

        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}

        <div className="modal-foot-inline">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Отмена
          </button>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Сохраняем…' : 'Сохранить'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
