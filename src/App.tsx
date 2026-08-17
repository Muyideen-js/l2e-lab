import { lazy, Suspense, type ReactNode } from 'react'
import { Navigate, Route, Routes, useParams, useLocation } from 'react-router-dom'
import { LoaderCircle } from 'lucide-react'
import { ErrorBoundary } from './components/ErrorBoundary'
import { ToastProvider } from './context/ToastContext'
import { PublicProgressProvider } from './public/PublicProgressContext'
import { PublicLayout, PublicToolLayout } from './public/PublicLayout'
import { getProjectBySlug } from './public/data'

const PublicHomePage = lazy(() =>
  import('./pages/public/PublicHomePage').then((module) => ({ default: module.PublicHomePage }))
)
const PublicProjectsPage = lazy(() =>
  import('./pages/public/PublicProjectsPage').then((module) => ({ default: module.PublicProjectsPage }))
)
const PublicProjectDetailPage = lazy(() =>
  import('./pages/public/PublicProjectDetailPage').then((module) => ({ default: module.PublicProjectDetailPage }))
)
const CommunityPage = lazy(() =>
  import('./pages/public/CommunityPage').then((module) => ({ default: module.CommunityPage }))
)
const CommunityDetailPage = lazy(() =>
  import('./pages/public/CommunityDetailPage').then((module) => ({ default: module.CommunityDetailPage }))
)
const MyLearningPage = lazy(() =>
  import('./pages/public/MyLearningPage').then((module) => ({ default: module.MyLearningPage }))
)
const AchievementsPage = lazy(() =>
  import('./pages/public/AchievementsPage').then((module) => ({ default: module.AchievementsPage }))
)

const PlaygroundPage = lazy(() => import('./pages/public/PlaygroundPage').then((module) => ({ default: module.PlaygroundPage })))
const ProjectBuildPage = lazy(() => import('./pages/public/ProjectBuildPage').then((module) => ({ default: module.ProjectBuildPage })))
const DailyChallengesPage = lazy(() => import('./pages/public/DailyChallengesPage').then((module) => ({ default: module.DailyChallengesPage })))
const DailyChallengeWorkspacePage = lazy(() => import('./pages/public/DailyChallengeWorkspacePage').then((module) => ({ default: module.DailyChallengeWorkspacePage })))

function RouteLoader({ message = 'Loading…' }: { message?: string }) {
	return (
		<div className="route-loader" role="status">
	  		<LoaderCircle className="spin" size={22} />
			<span>{message}</span>
		</div>
  )
}

function LazyRoute({ children, fallbackMessage }: { children: ReactNode; fallbackMessage?: string }) {
  return <Suspense fallback={<RouteLoader message={fallbackMessage} />}>{children}</Suspense>
}

function PythonProjectBuildRoute() {
  const { slug = '' } = useParams()
  const project = getProjectBySlug(slug)

  if (!project) return <Navigate to="/projects" replace />
  if (project.track !== 'python') return <Navigate to={`/projects/${project.slug}`} replace />

  return <LazyRoute fallbackMessage="Opening project workspace…"><ProjectBuildPage /></LazyRoute>
}

function DailyChallengeWorkspaceRoute() {
  const { track, day } = useParams()

  // Only Python track is active
  if (track !== 'python') return <Navigate to="/daily" replace />

  const dayNumber = Number(day)
  if (!Number.isInteger(dayNumber) || dayNumber < 1 || dayNumber > 100) {
    return <Navigate to="/daily/python" replace />
  }

  return (
    <LazyRoute fallbackMessage="Opening your challenge…">
      <DailyChallengeWorkspacePage />
    </LazyRoute>
  )
}

function AppRoutes() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route index element={<LazyRoute><PublicHomePage /></LazyRoute>} />
        <Route path="/projects" element={<LazyRoute><PublicProjectsPage /></LazyRoute>} />
        <Route path="/projects/:slug" element={<LazyRoute><PublicProjectDetailPage /></LazyRoute>} />
        <Route path="/daily" element={<LazyRoute><DailyChallengesPage /></LazyRoute>} />
        <Route path="/daily/:track" element={<LazyRoute><DailyChallengesPage /></LazyRoute>} />
        <Route path="/community" element={<LazyRoute><CommunityPage /></LazyRoute>} />
        <Route path="/community/:id" element={<LazyRoute><CommunityDetailPage /></LazyRoute>} />
        <Route path="/my-learning" element={<LazyRoute><MyLearningPage /></LazyRoute>} />
        <Route path="/achievements" element={<LazyRoute><AchievementsPage /></LazyRoute>} />
      </Route>

      <Route element={<PublicToolLayout />}>
        <Route path="/playground" element={<LazyRoute><PlaygroundPage /></LazyRoute>} />
        <Route path="/projects/:slug/build" element={<PythonProjectBuildRoute />} />
        <Route path="/daily/:track/:day" element={<DailyChallengeWorkspaceRoute />} />
      </Route>

      <Route path="/lab" element={<Navigate to="/" replace />} />
      <Route path="/lab/*" element={<Navigate to="/" replace />} />
      <Route path="/login" element={<Navigate to="/" replace />} />
      <Route path="/app" element={<Navigate to="/" replace />} />
      <Route path="/app/*" element={<Navigate to="/" replace />} />
      <Route path="/admin" element={<Navigate to="/" replace />} />
      <Route path="/admin/*" element={<Navigate to="/" replace />} />
      <Route path="/workspace" element={<Navigate to="/" replace />} />
      <Route path="/workspace/*" element={<Navigate to="/" replace />} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  const location = useLocation()

  return (
    <ToastProvider>
      <PublicProgressProvider>
      	<ErrorBoundary key={location.pathname}>
          <AppRoutes />
	</ErrorBoundary>
      </PublicProgressProvider>
    </ToastProvider>
  )
}
