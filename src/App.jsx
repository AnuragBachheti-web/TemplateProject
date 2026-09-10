import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ACTION_STORIES_ROUTES } from '@/constants/actionStoriesRoutes'
import Shell from '@/features/action-stories/components/Shell'
import ActionStoriesHome from '@/features/action-stories/pages/ActionStoriesHome'
import StagePage from '@/features/action-stories/pages/StagePage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* This scaffold has no other top-level surface yet — once merged into the real app,
            this whole route (and this redirect) is replaced by wherever Action Stories is
            registered in routeConfig.jsx (see INTEGRATION.md). */}
        <Route path="/" element={<Navigate to={ACTION_STORIES_ROUTES.index} replace />} />
        <Route path={ACTION_STORIES_ROUTES.index} element={<Shell />}>
          <Route index element={<ActionStoriesHome />} />
          <Route path=":code/:stageKey" element={<StagePage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
