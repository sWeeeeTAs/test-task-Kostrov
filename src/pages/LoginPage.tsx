import { useState } from 'react'
import type { FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { PageLoader } from '../components/StatePanels'
import { toErrorMessage } from '../lib/errors'
import { isSupabaseConfigured } from '../lib/supabase'

export function LoginPage() {
  const { session, loading, signIn } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (loading) {
    return (
      <div className="auth-page">
        <PageLoader />
      </div>
    )
  }

  if (session) {
    return <Navigate to="/" replace />
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      await signIn(email, password)
      navigate('/', { replace: true })
    } catch (submitError) {
      setError(toErrorMessage(submitError))
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <span className="brand-mark" aria-hidden="true">
            С
          </span>
          <div>
            <h1>СтройCRM</h1>
            <p className="muted">Объекты и задачи строительной компании</p>
          </div>
        </div>

        {!isSupabaseConfigured ? (
          <p className="alert alert-warning" role="alert">
            Не заданы <code>VITE_SUPABASE_URL</code> и <code>VITE_SUPABASE_ANON_KEY</code>. Создайте
            файл <code>.env.local</code> по образцу <code>.env.example</code> и перезапустите
            dev-сервер.
          </p>
        ) : null}

        <form className="form" onSubmit={handleSubmit}>
          <label className="field">
            <span className="field-label">Email</span>
            <input
              className="input"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              placeholder="you@company.ru"
              required
              autoFocus
            />
          </label>

          <label className="field">
            <span className="field-label">Пароль</span>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              placeholder="••••••••"
              required
            />
          </label>

          {error ? (
            <p className="form-error" role="alert">
              {error}
            </p>
          ) : null}

          <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
            {submitting ? 'Входим…' : 'Войти'}
          </button>
        </form>

        <p className="auth-hint muted">
          Самостоятельная регистрация отключена. Учётные записи создаёт администратор в Supabase.
        </p>
      </div>
    </div>
  )
}
