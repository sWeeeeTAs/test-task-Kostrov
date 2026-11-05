import { useState } from 'react'
import type { FormEvent } from 'react'
import type { TaskAction } from '../lib/statuses'
import { taskActionClass } from '../lib/statuses'
import { Modal } from './Modal'

interface StatusActionDialogProps {
  action: TaskAction
  busy: boolean
  error: string | null
  onSubmit: (comment: string | null) => void
  onClose: () => void
}

export function StatusActionDialog({
  action,
  busy,
  error,
  onSubmit,
  onClose,
}: StatusActionDialogProps) {
  const [comment, setComment] = useState('')
  const commentRequired = action.comment === 'required'

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmed = comment.trim()
    onSubmit(trimmed === '' ? null : trimmed)
  }

  return (
    <Modal title={action.dialogTitle} onClose={onClose}>
      <form className="form" onSubmit={handleSubmit}>
        <p className="muted">{action.dialogDescription}</p>

        {action.comment !== 'hidden' ? (
          <label className="field">
            <span className="field-label">
              {action.commentLabel}
              {commentRequired ? <span className="required-mark"> *</span> : null}
            </span>
            <textarea
              className="textarea"
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              placeholder={action.commentPlaceholder}
              rows={4}
              maxLength={2000}
              disabled={busy}
              autoFocus
            />
          </label>
        ) : null}

        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}

        <div className="modal-foot-inline">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>
            Отмена
          </button>
          <button
            type="submit"
            className={taskActionClass(action)}
            disabled={busy || (commentRequired && comment.trim() === '')}
          >
            {busy ? 'Сохраняем…' : action.label}
          </button>
        </div>
      </form>
    </Modal>
  )
}
