import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ACTION_STORIES_ROUTES } from '@/constants/actionStoriesRoutes'
import { ToastProvider } from '@/features/action-stories/ui/Toast'
import Shell from '@/features/action-stories/components/Shell'
import ActionStoriesHome from '@/features/action-stories/pages/ActionStoriesHome'
import StagePage from '@/features/action-stories/pages/StagePage'
import StageRedirect from '@/features/action-stories/pages/StageRedirect'

export default function App() {
  return (
    // ToastProvider mounts once, above every route — any component below it can call
    // useToast().notify(...) without a separate provider per page. When this feature moves into
    // apps/realifyai (INTEGRATION.md), either reuse that app's own toast provider if one already
    // exists at its root, or keep mounting this one at the same top level.
    <ToastProvider>
      <BrowserRouter>
        <Routes>
          {/* This scaffold has no other top-level surface yet — once merged into the real app,
              this whole route (and this redirect) is replaced by wherever Action Stories is
              registered in routeConfig.jsx (see INTEGRATION.md). */}
          <Route path="/" element={<Navigate to={ACTION_STORIES_ROUTES.index} replace />} />
          <Route path={ACTION_STORIES_ROUTES.index} element={<Shell />}>
            <Route index element={<ActionStoriesHome />} />
            {/* The canonical route carries the proposal id; the two-segment shape below it resolves
                that id once and redirects (C4), so every screen that renders is addressed
                explicitly and nothing renders from a (storyCode, stageKey) guess. */}
            <Route path=":storyCode/:stageKey/:proposalId" element={<StagePage />} />
            <Route path=":storyCode/:stageKey" element={<StageRedirect />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  )
}
