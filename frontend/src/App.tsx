import { Routes, Route, Navigate } from 'react-router-dom'
import MeterSection from './features/meter'
import InputContainer from './features/input/InputContainer'
import CableOverlay from './features/input/components/CableOverlay'
import { RouteSync } from './features/meter/RouteSync'

const App = () => {
  return (
    <>
      <RouteSync />
      <main>
        <section className="stack">
          <h1 className="title">Sarcasm Detector™</h1>
          <Routes>
            <Route path="/" element={<Navigate to="/getting-started" replace />} />
            <Route path="/getting-started" element={<InputContainer />} />
            <Route path="*" element={<Navigate to="/getting-started" replace />} />
          </Routes>
        </section>
        <MeterSection />
        <CableOverlay />
      </main>
    </>
  )
}

export default App
