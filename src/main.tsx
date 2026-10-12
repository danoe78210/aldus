import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { installWindowResizeGuard } from './utils/windowResizeGuard'

// Correctif « window jitter » : gèle transitions & animations pendant le
// redimensionnement de la fenêtre (voir la section dédiée de `src/index.css`).
installWindowResizeGuard()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
