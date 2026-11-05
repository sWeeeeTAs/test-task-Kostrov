import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './auth/useAuth'
import { Layout } from './components/Layout'
import { ErrorPanel, PageLoader } from './components/StatePanels'
import { LoginPage } from './pages/LoginPage'
import { MyTasksPage } from './pages/MyTasksPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { ObjectPage } from './pages/ObjectPage'
import { ObjectsPage } from './pages/ObjectsPage'
import { TaskPage } from './pages/TaskPage'

function RequireAuth() {
  const { session, profile, loading, profileError } = useAuth()

  if (loading) {
    return (
      <div className="centered-page">
        <PageLoader label="Проверяем сессию…" />
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/login" replace />
  }

  if (profileError) {
    return (
      <div className="centered-page">
        <ErrorPanel message={profileError} />
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="centered-page">
        <PageLoader label="Загружаем профиль…" />
      </div>
    )
  }

  return <Layout profile={profile} />
}

function HomeRedirect() {
  const { profile } = useAuth()
  return <Navigate to={profile?.role === 'tasker' ? '/objects' : '/my-tasks'} replace />
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<RequireAuth />}>
        <Route index element={<HomeRedirect />} />
        <Route path="objects" element={<ObjectsPage />} />
        <Route path="objects/:objectId" element={<ObjectPage />} />
        <Route path="tasks/:taskId" element={<TaskPage />} />
        <Route path="my-tasks" element={<MyTasksPage />} />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}

export default App
