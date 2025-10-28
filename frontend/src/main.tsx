import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { WhichInputProvider } from './features/meter/WhichInputProvider.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <WhichInputProvider>
      <App />
    </WhichInputProvider>
  </StrictMode>,
)
