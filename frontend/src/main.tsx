import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { WhichInputProvider } from './features/meter/WhichInputProvider.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <WhichInputProvider>
        <App />
      </WhichInputProvider>
    </BrowserRouter>
  </StrictMode>,
)
