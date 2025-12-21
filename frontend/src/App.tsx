import { Navigate, Route, Routes } from 'react-router-dom'
import InputContainer from './features/input/InputContainer'
import CableOverlay from './features/input/components/CableOverlay'
import MeterSection from './features/meter'
import { RouteSync } from './features/meter/RouteSync'
import FirstTimeOverlay from './features/meter/components/FirstTimeOverlay'
import { DetectionProvider } from './features/meter/context/DetectionProvider'

const App = () => {
  return (
    <DetectionProvider>
      <RouteSync />
      <main data-testid="app-main">
        <section className="stack">
          <div className="title-group">
            <h1 className="title" data-testid="app-title">
              Sarcasm Detector™
            </h1>
            <h2 className="subtitle">A signalflowsean production</h2>
          </div>
          <Routes>
            <Route path="/" element={<Navigate to="/getting-started" replace />} />
            <Route path="/:mode" element={<InputContainer />} />
            <Route path="*" element={<Navigate to="/getting-started" replace />} />
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
