import { lazy, Suspense, type ReactNode } from 'react'
import { Navigate, Outlet, Route, Routes, useParams } from 'react-router-dom'
import { LoaderCircle } from 'lucide-react'
import { ErrorBoundary } from './components/ErrorBoundary'
import { ToastProvider } from './context/ToastContext'
import { PublicProgressProvider } from './public/PublicProgressContext'
import { PublicLayout, PublicToolLayout } from './public/PublicLayout'
import { getProjectBySlug } from './public/data'
import { PublicHomePage } from './pages/public/PublicHomePage'
import { PublicProjectsPage } from './pages/public/PublicProjectsPage'
import { PublicProjectDetailPage } from './pages/public/PublicProjectDetailPage'
import { CommunityPage } from './pages/public/CommunityPage'
import { CommunityDetailPage } from './pages/public/CommunityDetailPage'
import { MyLearningPage } from './pages/public/MyLearningPage'

const PlaygroundPage = lazy(() => import('./pages/public/PlaygroundPage').then((module) => ({ default: module.PlaygroundPage })))
const ProjectBuildPage = lazy(() => import('./pages/public/ProjectBuildPage').then((module) => ({ default: module.ProjectBuildPage })))
const DailyChallengesPage = lazy(() => import('./pages/public/DailyChallengesPage').then((module) => ({ default: module.DailyChallengesPage })))
const DailyChallengeWorkspacePage = lazy(() => import('./pages/public/DailyChallengeWorkspacePage').then((module) => ({ default: module.DailyChallengeWorkspacePage })))

function RouteLoader() {
  return <div className="route-loader" role="status"><LoaderCircle className="spin" size={22} /><span>Opening your workspace…</span></div>
}

function LazyRoute({ children }: { children: ReactNode }) {
  return <Suspense fallback={<RouteLoader />}>{children}</Suspense>
}

function PythonProjectBuildRoute() {
  const { slug = '' } = useParams()
  const project = getProjectBySlug(slug)

  if (!project) return <Navigate to="/projects" replace />
  if (project.track !== 'python') return <Navigate to={`/projects/${project.slug}`} replace />

  return <LazyRoute><ProjectBuildPage /></LazyRoute>
}

function PublicExperience() {
  return (
    <PublicProgressProvider>
      <Outlet />
    </PublicProgressProvider>
  )
}

function AppRoutes() {
  return (
    <Routes>
      <Route element={<PublicExperience />}>
        <Route element={<PublicLayout />}>
          <Route index element={<PublicHomePage />} />
          <Route path="/projects" element={<PublicProjectsPage />} />
          <Route path="/projects/:slug" element={<PublicProjectDetailPage />} />
          <Route path="/daily" element={<LazyRoute><DailyChallengesPage /></LazyRoute>} />
          <Route path="/daily/:track" element={<LazyRoute><DailyChallengesPage /></LazyRoute>} />
          <Route path="/community" element={<CommunityPage />} />
          <Route path="/community/:id" element={<CommunityDetailPage />} />
          <Route path="/my-learning" element={<MyLearningPage />} />
          <Route path="/auth" element={<Navigate to="/my-learning" replace />} />
        </Route>

        <Route element={<PublicToolLayout />}>
          <Route path="/playground" element={<LazyRoute><PlaygroundPage /></LazyRoute>} />
          <Route path="/projects/:slug/build" element={<PythonProjectBuildRoute />} />
          <Route path="/daily/:track/:day" element={<LazyRoute><DailyChallengeWorkspacePage /></LazyRoute>} />
        </Route>

        <Route path="/lab" element={<Navigate to="/" replace />} />
        <Route path="/lab/*" element={<Navigate to="/" replace />} />
        <Route path="/login" element={<Navigate to="/" replace />} />
        <Route path="/app" element={<Navigate to="/" replace />} />
        <Route path="/app/*" element={<Navigate to="/" replace />} />
        <Route path="/workspace" element={<Navigate to="/" replace />} />
        <Route path="/workspace/*" element={<Navigate to="/" replace />} />
      </Route>

      <Route path="/achievements" element={<Navigate to="/my-learning" replace />} />
      <Route path="/admin" element={<Navigate to="/" replace />} />
      <Route path="/admin/*" element={<Navigate to="/" replace />} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <ToastProvider>
      <ErrorBoundary>
        <AppRoutes />
      </ErrorBoundary>
    </ToastProvider>
  )
}
