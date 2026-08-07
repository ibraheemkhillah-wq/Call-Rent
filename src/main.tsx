import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { StoreProvider } from './store'
import { ThemeProvider } from './theme/theme'
import { LangProvider } from './i18n'
import { setupAppUpdates } from './lib/pwa'
import { setupHomeScreenIdentity } from './lib/homescreen'
import './fonts.css'
import './styles.css'
import './report.css'

setupAppUpdates()
setupHomeScreenIdentity()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LangProvider>
      <ThemeProvider>
        <StoreProvider>
          <App />
        </StoreProvider>
      </ThemeProvider>
    </LangProvider>
  </StrictMode>,
)

/*
 * رسالة الإقلاع في index.html تُزال بعد نجاح أول رسم فعلي.
 * لو أخفق الإقلاع بقيت ظاهرة تحمل سبب الإخفاق، بدل شاشة بيضاء صامتة.
 */
requestAnimationFrame(() => {
  requestAnimationFrame(() => {
    if (document.querySelector('#root')?.childElementCount) {
      document.getElementById('boot')?.remove()
    }
  })
})
