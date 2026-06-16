import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import MainPage from './pages/MainPage'
import AdminPage from './pages/AdminPage'
import AdminScenarioPage from './pages/AdminScenarioPage'
import ScenarioLibraryPage from './pages/ScenarioLibraryPage'
import TokenMonitoringPage from './pages/TokenMonitoringPage'
import UserProfilePage from './pages/UserProfilePage'
import ApprenantPage from './pages/ApprenantPage'
import HomePage from './pages/HomePage'
import DocumentsPage from './pages/DocumentsPage'
import { APP_ROUTES, PRIVATE_ROUTE_SEGMENTS } from './routes/paths'

function App() {
  const { user, loading } = useAuth()
  const defaultProtectedRoute = user?.role === 'apprenant' ? APP_ROUTES.apprenant : APP_ROUTES.dashboard
  const isLearnerUser = user?.role === 'apprenant'

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-gray-200 border-t-[#e63641]" />
      </div>
    )
  }

  return (
    <Routes>
      {/* Page d'accueil publique */}
      <Route
        path={APP_ROUTES.home}
        element={<HomePage />}
      />

      {/* Routes publiques */}
      <Route
        path={APP_ROUTES.login}
        element={user ? <Navigate to={defaultProtectedRoute} replace /> : <LoginPage />}
      />
      <Route
        path={APP_ROUTES.register}
        element={user ? <Navigate to={defaultProtectedRoute} replace /> : <RegisterPage />}
      />

      {/* Routes protegees */}
      <Route
        path={APP_ROUTES.root}
        element={user ? <Layout /> : <Navigate to={APP_ROUTES.home} replace />}
      >
        <Route index element={<Navigate to={defaultProtectedRoute} replace />} />
        <Route
          path={PRIVATE_ROUTE_SEGMENTS.dashboard}
          element={isLearnerUser ? <Navigate to={APP_ROUTES.apprenant} replace /> : <MainPage />}
        />
        <Route
          path={PRIVATE_ROUTE_SEGMENTS.apprenant}
          element={user?.role === 'apprenant' ? <ApprenantPage /> : <Navigate to={APP_ROUTES.dashboard} replace />}
        />
        <Route
          path={PRIVATE_ROUTE_SEGMENTS.documents}
          element={isLearnerUser ? <Navigate to={APP_ROUTES.apprenant} replace /> : <DocumentsPage />}
        />
        <Route path={PRIVATE_ROUTE_SEGMENTS.profile} element={<UserProfilePage />} />
        <Route
          path={PRIVATE_ROUTE_SEGMENTS.admin}
          element={isLearnerUser ? <Navigate to={APP_ROUTES.apprenant} replace /> : <AdminPage />}
        />
        <Route
          path={PRIVATE_ROUTE_SEGMENTS.adminScenario}
          element={isLearnerUser ? <Navigate to={APP_ROUTES.apprenant} replace /> : <AdminScenarioPage />}
        />
        <Route
          path={PRIVATE_ROUTE_SEGMENTS.scenarioLibrary}
          element={isLearnerUser ? <Navigate to={APP_ROUTES.apprenant} replace /> : <ScenarioLibraryPage />}
        />
        <Route
          path={PRIVATE_ROUTE_SEGMENTS.tokenMonitoring}
          element={isLearnerUser ? <Navigate to={APP_ROUTES.apprenant} replace /> : <TokenMonitoringPage />}
        />
      </Route>

      {/* Route par defaut */}
      <Route path="*" element={<Navigate to={user ? defaultProtectedRoute : APP_ROUTES.home} replace />} />
    </Routes>
  )
}

export default App
