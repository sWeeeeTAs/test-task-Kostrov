import { useState } from 'react'
import type { FormEvent } from 'react'
import { createTask } from '../api/tasks'
import { toErrorMessage } from '../lib/errors'
import type { ProfileSummary, Task } from '../types'
import { Modal } from './Modal'

interface CreateTaskModalProps {
  objectId: string
  objectName: string
  authorId: string
  executors: ProfileSummary[]
  onClose: () => void
  onCreated: (task: Task) => void
}

export function CreateTaskModal({
  objectId,
  objectName,
  authorId,
  executors,
  onClose,
  onCreated,
}: CreateTaskModalProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [assigneeId, setAssigneeId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

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
      const task = await createTask(
        objectId,
        {
          title: trimmedTitle,
          description: description.trim() === '' ? null : description.trim(),
          assigneeId: assigneeId === '' ? null : assigneeId,
        },
        authorId,
      )

      onCreated(task)
    } catch (submitError) {
      setError(toErrorMessage(submitError))
      setSubmitting(false)
    }
  }

  return (
    <Modal title="Новая задача" onClose={onClose} size="wide">
      <form className="form" onSubmit={handleSubmit}>
        <p className="muted">
          Объект: <strong>{objectName}</strong>
        </p>

        <label className="field">
          <span className="field-label">Название</span>
          <input
            className="input"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Замерить проёмы на 3 этаже"
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
            placeholder="Что нужно сделать, детали, сроки"
            rows={5}
            maxLength={5000}
          />
        </label>

        <label className="field">
          <span className="field-label">Исполнитель</span>
          <select
            className="select"
            value={assigneeId}
            onChange={(event) => setAssigneeId(event.target.value)}
          >
            <option value="">Не назначен</option>
            {executors.map((executor) => (
              <option key={executor.id} value={executor.id}>
                {executor.full_name?.trim() || executor.email}
              </option>
            ))}
          </select>
          {executors.length === 0 ? (
            <span className="field-hint">
              Нет пользователей с ролью «Исполнитель». Добавьте их в Supabase.
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
            {submitting ? 'Создаём…' : 'Создать задачу'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
