import { Navigate, Route, Routes } from 'react-router-dom'
import { MEDIA_QUERIES } from './breakpoints'
import InputContainer from './features/input/InputContainer'
import CableOverlay from './features/input/components/CableOverlay'
import MoonshinePreloadStatus from './features/input/components/MoonshinePreloadStatus'
import { useMediaQuery } from './features/input/hooks'
import MeterSection from './features/meter'
import { RouteSync } from './features/meter/RouteSync'
import FirstTimeOverlay from './features/meter/components/FirstTimeOverlay'
import { DetectionProvider } from './features/meter/context/DetectionProvider'

/**
 * Conditional root route component.
 * On desktop: redirects to /getting-started
 * On mobile/tablet: renders InputContainer directly (routing is disabled)
 */
const RootRoute = () => {
  const isMobileOrTablet = useMediaQuery(MEDIA_QUERIES.isMobileOrTablet)

  // On mobile/tablet, render InputContainer directly (RouteSync handles keeping route at /)
  // On desktop, redirect to /getting-started
  if (isMobileOrTablet) {
    return <InputContainer />
  }

  return <Navigate to="/getting-started" replace />
}

/**
 * Catch-all route component for invalid paths.
 * On desktop: redirects to /getting-started
 * On mobile/tablet: redirects to / (routing is disabled, RouteSync will keep it at /)
 */
const CatchAllRoute = () => {
  const isMobileOrTablet = useMediaQuery(MEDIA_QUERIES.isMobileOrTablet)

  // On mobile/tablet, redirect to root (RouteSync will keep it there)
  // On desktop, redirect to /getting-started
  if (isMobileOrTablet) {
    return <Navigate to="/" replace />
  }

  return <Navigate to="/getting-started" replace />
}

const App = () => {
  return (
    <DetectionProvider>
      <RouteSync />
      {/* App-level Moonshine preload - starts download immediately for browsers that need it */}
      <MoonshinePreloadStatus />
      <main data-testid="app-main">
        <section className="stack">
          <div className="title-group">
            <h1 className="title" data-testid="app-title">
              Sarcasm Detector™
            </h1>
            <h2 className="subtitle">A signalflowsean production</h2>
          </div>
          <Routes>
            <Route path="/" element={<RootRoute />} />
            <Route path="/:mode" element={<InputContainer />} />
            <Route path="*" element={<CatchAllRoute />} />
          </Routes>
        </section>
        <MeterSection />
        <CableOverlay />
        <FirstTimeOverlay />
      </main>
    </DetectionProvider>
  )
}

export default App
