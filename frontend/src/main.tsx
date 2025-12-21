import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.tsx'
import { WhichInputProvider } from './features/meter/context/WhichInputProvider'
import './index.css'
import './version' // Initialize version info (accessible via window.__APP_VERSION__)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <WhichInputProvider>
        <App />
      </WhichInputProvider>
    </BrowserRouter>
  </StrictMode>
)
