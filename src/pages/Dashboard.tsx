import { useMemo } from 'react'
import { useStore } from '../store'
import { useT } from '../i18n'
import { portfolioStats, summarizeInvestor } from '../lib/calc'
import { count, initials, money, monthLabel, percent } from '../lib/format'
import { Empty, Stat } from '../components/ui'
import {
  IconClock,
  IconPercent,
  IconPlus,
  IconTrend,
  IconUsers,
  IconWallet,
} from '../components/Icons'
import type { Route } from '../App'

export function Dashboard({ go }: { go: (r: Route) => void }) {
  const { db } = useStore()
  const t = useT()
  const u = t.ui
  const sym = db.settings.currencySymbol || '$'

  const stats = useMemo(
    () => portfolioStats(db.investors, db.contributions, db.profits),
    [db.investors, db.contributions, db.profits],
  )

  const top = useMemo(
    () =>
      db.investors
        .map((i) => summarizeInvestor(i, db.contributions, db.profits))
        .sort((a, b) => b.currentCapital - a.currentCapital),
    [db.investors, db.contributions, db.profits],
  )

  const maxSeries = Math.max(...stats.monthlySeries.map((m) => m.profit), 1)

  if (db.investors.length === 0) {
    return (
      <>
        <div className="page-head">
          <div>
            <h1>{t.dashboard.title}</h1>
            <p>{u.dashSubtitle}</p>
          </div>
        </div>
        <div className="card">
          <Empty
            icon={<IconUsers size={26} />}
            title={u.dashEmptyTitle}
            text={u.dashEmptyText}
            action={
              <button className="btn btn-primary" onClick={() => go({ name: 'investors' })}>
                <IconPlus className="btn-icon" />
                {u.dashAddInvestor}
              </button>
            }
          />
        </div>
      </>
    )
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{t.dashboard.title}</h1>
          <p>{u.dashSubtitle}</p>
        </div>
        <div className="head-actions">
          <button className="btn" onClick={() => go({ name: 'profits' })}>
            {u.dashRecordProfits}
          </button>
          <button className="btn btn-primary" onClick={() => go({ name: 'reports' })}>
            {u.dashIssueReport}
          </button>
        </div>
      </div>

      <div className="grid grid-4" style={{ marginBottom: 22 }}>
        <Stat
          label={t.dashboard.totalCapital}
          value={money(stats.totalCapital, sym)}
          foot={u.dashDistributedTo(count(stats.activeCount))}
          icon={<IconWallet size={16} />}
          highlight
        />
        <Stat
          label={u.dashTotalProfitDistributed}
          value={money(stats.totalProfitAllTime, sym)}
          foot={u.dashSinceStart}
          icon={<IconTrend size={16} />}
        />
        <Stat
          label={u.dashAvgLifetime}
          value={percent(stats.avgReturnPct)}
          foot={u.dashAvgFoot}
          icon={<IconPercent size={16} />}
        />
        <Stat
          label={u.dashUnpaid}
          value={money(stats.unpaidProfit, sym)}
          foot={u.dashUnpaidFoot}
          icon={<IconClock size={16} />}
        />
      </div>

      <div className="grid grid-2" style={{ marginBottom: 22 }}>
        <div className="card">
          <div className="card-title">{u.dashMonthlyChart}</div>
          <div className="card-sub">{u.dashMonthlyChartSub}</div>
          {stats.monthlySeries.length === 0 ? (
            <p className="muted">{u.dashNoProfits}</p>
          ) : (
            <div className="chart">
              {stats.monthlySeries.map((m) => (
                <div className="chart-col" key={m.month}>
                  <div className="chart-value">
                    {Math.round(m.profit).toLocaleString('en-US')}
                  </div>
                  <div
                    className="chart-bar"
                    style={{ height: `${Math.max((m.profit / maxSeries) * 100, 2)}%` }}
                  />
                  <div className="chart-label">{monthLabel(m.month).split(' ')[0]}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-title">{u.dashCapitalSplit}</div>
          <div className="card-sub">{u.dashCapitalSplitSub}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {top.slice(0, 6).map((s) => {
              const share =
                stats.totalCapital > 0 ? (s.currentCapital / stats.totalCapital) * 100 : 0
              return (
                <div key={s.investor.id}>
                  <div className="row" style={{ marginBottom: 6 }}>
                    <span>{s.investor.name}</span>
                    <span className="spacer" />
                    <span className="num muted">{money(s.currentCapital, sym)}</span>
                    <span className="num accent">{percent(share, 1)}</span>
                  </div>
                  <div className="bar">
                    <span style={{ width: `${Math.min(share, 100)}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">{t.investors.title}</div>
        <div className="card-sub">{u.dashInvestorsSub}</div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{t.profits.investor}</th>
                <th className="num">{t.profits.capital}</th>
                <th className="num">{t.investor.lifetimeProfit}</th>
                <th className="num">{t.investor.lifetimeReturn}</th>
                <th className="num">{u.dashColAvgMonthly}</th>
                <th className="num">{t.investor.due}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {top.map((s) => (
                <tr key={s.investor.id}>
                  <td>
                    <div className="person">
                      <div className="avatar">{initials(s.investor.name)}</div>
                      <div>
                        <div className="person-name">{s.investor.name}</div>
                        <div className="person-meta">
                          {u.dashMonthsRecorded(s.activeMonths)}
                          {!s.investor.active && u.dashInactiveSuffix}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="num">{money(s.currentCapital, sym)}</td>
                  <td className="num accent">{money(s.totalProfit, sym)}</td>
                  <td className="num pos">{percent(s.lifetimeReturnPct)}</td>
                  <td className="num">{percent(s.avgMonthlyPct)}</td>
                  <td className="num">
                    {s.unpaidProfit > 0 ? (
                      <span className="badge badge-warn">{money(s.unpaidProfit, sym)}</span>
                    ) : (
                      <span className="badge badge-success">{u.dashSettled}</span>
                    )}
                  </td>
                  <td>
                    <button
                      className="btn btn-sm"
                      onClick={() => go({ name: 'investor', id: s.investor.id })}
                    >
                      {u.dashDetails}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
