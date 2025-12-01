import { Routes, Route, Navigate } from 'react-router-dom'
import MeterSection from './features/meter'
import InputContainer from './features/input/InputContainer'
import CableOverlay from './features/input/components/CableOverlay'
import { RouteSync } from './features/meter/RouteSync'
import { DetectionProvider } from './features/meter/DetectionProvider'

const App = () => {
  return (
    <DetectionProvider>
      <RouteSync />
      <main>
        <section className="stack">
          <div className="title-group">
            <h1 className="title">Sarcasm Detector™</h1>
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
      </main>
    </DetectionProvider>
  )
}

export default App
