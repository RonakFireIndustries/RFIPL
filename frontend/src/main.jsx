import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { InteractionProvider } from '@/components/ui/interactions'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <InteractionProvider>
      <App />
    </InteractionProvider>
  </StrictMode>,
)