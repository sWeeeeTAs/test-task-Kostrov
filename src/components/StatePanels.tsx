import type { ReactNode } from 'react'

export function PageLoader({ label = 'Загрузка…' }: { label?: string }) {
  return (
    <div className="state-panel">
      <span className="spinner" aria-hidden="true" />
      <p>{label}</p>
    </div>
  )
}

export function ErrorPanel({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="alert alert-error" role="alert">
      <div>
        <strong>Не удалось загрузить данные</strong>
        <p>{message}</p>
      </div>
      {onRetry ? (
        <button type="button" className="btn btn-secondary btn-sm" onClick={onRetry}>
          Повторить
        </button>
      ) : null}
    </div>
  )
}

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="empty-state">
      <p className="empty-title">{title}</p>
      {description ? <p className="muted">{description}</p> : null}
    </div>
  )
}

export function PageHeader({
  title,
  subtitle,
  actions,
  backLink,
}: {
  title: string
  subtitle?: ReactNode
  actions?: ReactNode
  backLink?: ReactNode
}) {
  return (
    <div className="page-head">
      <div>
        {backLink ? <div className="back-link">{backLink}</div> : null}
        <h1>{title}</h1>
        {subtitle ? <div className="page-subtitle">{subtitle}</div> : null}
      </div>
      {actions ? <div className="page-actions">{actions}</div> : null}
    </div>
  )
}
