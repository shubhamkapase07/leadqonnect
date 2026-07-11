import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { initErrorMonitoring } from './lib/logger'

// Capture uncaught errors + unhandled rejections and ship them to the central sink.
initErrorMonitoring()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
