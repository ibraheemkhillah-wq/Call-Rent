import { useState } from 'react'
import { useStore } from './store'
import { LogoMark, Wordmark } from './components/ui'
import {
  IconChart,
  IconDashboard,
  IconDoc,
  IconSettings,
  IconUsers,
} from './components/Icons'
import { initials } from './lib/format'
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

const NAV: { key: Route['name']; label: string; icon: typeof IconDashboard }[] = [
  { key: 'dashboard', label: 'لوحة المعلومات', icon: IconDashboard },
  { key: 'investors', label: 'المستثمرون', icon: IconUsers },
  { key: 'profits', label: 'الأرباح الشهرية', icon: IconChart },
  { key: 'reports', label: 'التقارير', icon: IconDoc },
  { key: 'settings', label: 'الإعدادات', icon: IconSettings },
]

export default function App() {
  const { db } = useStore()
  const [route, setRoute] = useState<Route>({ name: 'dashboard' })
  const s = db.settings
  const company = s.companyNameAr || s.companyName || 'شركتي'

  const isActive = (key: Route['name']) =>
    route.name === key || (key === 'investors' && route.name === 'investor')

  return (
    <div className="app">
      <aside className="sidebar no-print">
        <div className="brand">
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
          <div className="brand-text">
            <span>{s.tagline || 'إدارة المستثمرين والعوائد'}</span>
          </div>
        </div>

        <nav className="nav">
          <div className="nav-label">القائمة الرئيسية</div>
          {NAV.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              className={isActive(key) ? 'active' : ''}
              onClick={() => setRoute({ name: key } as Route)}
            >
              <Icon className="nav-icon" />
              {label}
            </button>
          ))}
        </nav>

        <div className="sidebar-foot">
          <div>
            {db.investors.length} مستثمر • {db.profits.length} قيد ربح
          </div>
          <div>البيانات محفوظة على هذا الجهاز</div>
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
