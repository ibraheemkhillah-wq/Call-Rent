import { useState } from 'react'
import { useStore } from './store'
import { LogoMark, ThemeToggle, Wordmark } from './components/ui'
import {
  IconChart,
  IconDashboard,
  IconDoc,
  IconSettings,
  IconUsers,
} from './components/Icons'
import { initials } from './lib/format'
import { useT } from './i18n'
import { Dashboard } from './pages/Dashboard'
import { Investors } from './pages/Investors'
import { InvestorDetail } from './pages/InvestorDetail'
import { Profits } from './pages/Profits'
import { Reports } from './pages/Reports'
import { SettingsPage } from './pages/Settings'

export type Route =
  | { name: 'dashboard' }
  | { name: 'investors' }
  | { name: 'investor'; id: string }
  | { name: 'profits' }
  | { name: 'reports'; investorId?: string }
  | { name: 'settings' }

const NAV: { key: Route['name']; icon: typeof IconDashboard }[] = [
  { key: 'dashboard', icon: IconDashboard },
  { key: 'investors', icon: IconUsers },
  { key: 'profits', icon: IconChart },
  { key: 'reports', icon: IconDoc },
  { key: 'settings', icon: IconSettings },
]

export default function App() {
  const { db } = useStore()
  const t = useT()
  const [route, setRoute] = useState<Route>({ name: 'dashboard' })
  const s = db.settings
  const company = s.companyNameAr || s.companyName || t.nav.myCompany
  const navLabel: Record<Route['name'], string> = {
    dashboard: t.nav.dashboard,
    investors: t.nav.investors,
    investor: t.nav.investors,
    profits: t.nav.profits,
    reports: t.nav.reports,
    settings: t.nav.settings,
  }

  const isActive = (key: Route['name']) =>
    route.name === key || (key === 'investors' && route.name === 'investor')

  return (
    <div className="app">
      <aside className="sidebar no-print">
        <div className="brand">
          <div className="brand-row">
            {s.logoDataUrl ? (
              <div className="row" style={{ gap: 12, flexWrap: 'nowrap' }}>
                <LogoMark logoDataUrl={s.logoDataUrl} fallback={initials(company)} />
                <div className="brand-text">
                  <strong>{company}</strong>
                </div>
              </div>
            ) : (
              <Wordmark className="brand-logo" />
            )}
            <ThemeToggle />
          </div>
          <div className="brand-text">
            <span>{s.tagline || t.nav.tagline}</span>
          </div>
        </div>

        <nav className="nav">
          <div className="nav-label">{t.nav.section}</div>
          {NAV.map(({ key, icon: Icon }) => (
            <button
              key={key}
              className={isActive(key) ? 'active' : ''}
              onClick={() => setRoute({ name: key } as Route)}
            >
              <Icon className="nav-icon" />
              {navLabel[key]}
            </button>
          ))}
        </nav>

        <div className="sidebar-foot">
          <div>{t.nav.footCount(db.investors.length, db.profits.length)}</div>
          <div>{t.nav.footNote}</div>
        </div>
      </aside>

      <main className="main">
        {route.name === 'dashboard' && <Dashboard go={setRoute} />}
        {route.name === 'investors' && <Investors go={setRoute} />}
        {route.name === 'investor' && <InvestorDetail id={route.id} go={setRoute} />}
        {route.name === 'profits' && <Profits go={setRoute} />}
        {route.name === 'reports' && <Reports initialInvestorId={route.investorId} />}
        {route.name === 'settings' && <SettingsPage />}
      </main>
    </div>
  )
}
