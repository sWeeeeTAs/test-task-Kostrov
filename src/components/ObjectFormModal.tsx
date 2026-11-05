import { useState } from 'react'
import type { FormEvent } from 'react'
import type { ObjectInput } from '../api/objects'
import { toErrorMessage } from '../lib/errors'
import { Modal } from './Modal'

interface ObjectFormModalProps {
  title: string
  submitLabel: string
  initial?: { name: string; address: string | null }
  onSubmit: (input: ObjectInput) => Promise<void>
  onClose: () => void
}

export function ObjectFormModal({
  title,
  submitLabel,
  initial,
  onSubmit,
  onClose,
}: ObjectFormModalProps) {
  const [name, setName] = useState(initial?.name ?? '')
  const [address, setAddress] = useState(initial?.address ?? '')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const trimmedName = name.trim()
    if (trimmedName === '') {
      setError('Укажите название объекта.')
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      await onSubmit({ name: trimmedName, address: address.trim() === '' ? null : address.trim() })
    } catch (submitError) {
      setError(toErrorMessage(submitError))
      setSubmitting(false)
    }
  }

  return (
    <Modal title={title} onClose={onClose}>
      <form id="object-form" className="form" onSubmit={handleSubmit}>
        <label className="field">
          <span className="field-label">Название</span>
          <input
            className="input"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="ЖК «Северный», корпус 2"
            maxLength={200}
            required
            autoFocus
          />
        </label>

        <label className="field">
          <span className="field-label">Адрес</span>
          <input
            className="input"
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            placeholder="г. Москва, ул. Строителей, 15"
            maxLength={300}
          />
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
            {submitting ? 'Сохраняем…' : submitLabel}
          </button>
        </div>
      </form>
    </Modal>
  )
}
