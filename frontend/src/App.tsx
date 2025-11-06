import MeterSection from './features/meter'
import AudioRecorder from './features/input/AudioRecorder'

const App = () => {
  return (
    <main>
      <section className="primary-spacing">
        {/* <h1>Sarcasm Detector</h1> */}
        <AudioRecorder />
      </section>
      <MeterSection />
    </main>
  )
}

export default App
