import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <div className="centered-page">
      <div className="empty-state">
        <p className="empty-title">Страница не найдена</p>
        <p className="muted">Проверьте адрес или вернитесь к списку объектов.</p>
        <Link className="btn btn-primary" to="/">
          На главную
        </Link>
      </div>
    </div>
  )
}
