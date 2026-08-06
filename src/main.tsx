import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { StoreProvider } from './store'
import { ThemeProvider } from './theme/theme'
import { setupAppUpdates } from './lib/pwa'
import './fonts.css'
import './styles.css'
import './report.css'

setupAppUpdates()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <StoreProvider>
        <App />
      </StoreProvider>
    </ThemeProvider>
  </StrictMode>,
)
