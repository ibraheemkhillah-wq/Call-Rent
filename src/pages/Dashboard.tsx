import { useMemo } from 'react'
import { useStore } from '../store'
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
            <h1>لوحة المعلومات</h1>
            <p>نظرة شاملة على المحفظة الاستثمارية</p>
          </div>
        </div>
        <div className="card">
          <Empty
            icon={<IconUsers size={26} />}
            title="لنبدأ بإضافة أول مستثمر"
            text="أضف المستثمرين ومبالغ استثماراتهم، ثم سجّل الأرباح الشهرية، وسيتولى النظام إعداد التقارير."
            action={
              <button className="btn btn-gold" onClick={() => go({ name: 'investors' })}>
                <IconPlus className="btn-icon" />
                إضافة مستثمر
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
          <h1>لوحة المعلومات</h1>
          <p>نظرة شاملة على المحفظة الاستثمارية</p>
        </div>
        <div className="head-actions">
          <button className="btn" onClick={() => go({ name: 'profits' })}>
            تسجيل أرباح الشهر
          </button>
          <button className="btn btn-gold" onClick={() => go({ name: 'reports' })}>
            إصدار تقرير
          </button>
        </div>
      </div>

      <div className="grid grid-4" style={{ marginBottom: 22 }}>
        <Stat
          label="إجمالي رأس المال"
          value={money(stats.totalCapital, sym)}
          foot={`موزّع على ${count(stats.activeCount)} مستثمر نشط`}
          icon={<IconWallet size={16} />}
          gold
        />
        <Stat
          label="إجمالي الأرباح الموزّعة"
          value={money(stats.totalProfitAllTime, sym)}
          foot="منذ بداية النشاط"
          icon={<IconTrend size={16} />}
        />
        <Stat
          label="متوسط العائد التراكمي"
          value={percent(stats.avgReturnPct)}
          foot="الأرباح ÷ رأس المال"
          icon={<IconPercent size={16} />}
        />
        <Stat
          label="أرباح مستحقة غير مصروفة"
          value={money(stats.unpaidProfit, sym)}
          foot="بانتظار الصرف"
          icon={<IconClock size={16} />}
        />
      </div>

      <div className="grid grid-2" style={{ marginBottom: 22 }}>
        <div className="card">
          <div className="card-title">الأرباح الشهرية</div>
          <div className="card-sub">إجمالي ما وُزّع على المستثمرين — آخر 12 شهراً</div>
          {stats.monthlySeries.length === 0 ? (
            <p className="muted">لم يتم تسجيل أي أرباح بعد.</p>
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
          <div className="card-title">توزيع رأس المال</div>
          <div className="card-sub">حصة كل مستثمر من إجمالي المحفظة</div>
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
                    <span className="num gold">{percent(share, 1)}</span>
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
        <div className="card-title">المستثمرون</div>
        <div className="card-sub">ملخص أداء كل مستثمر حتى تاريخه</div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>المستثمر</th>
                <th className="num">رأس المال</th>
                <th className="num">إجمالي الأرباح</th>
                <th className="num">العائد التراكمي</th>
                <th className="num">متوسط شهري</th>
                <th className="num">مستحق</th>
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
                          {s.activeMonths} شهر مسجّل
                          {!s.investor.active && ' • غير نشط'}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="num">{money(s.currentCapital, sym)}</td>
                  <td className="num gold">{money(s.totalProfit, sym)}</td>
                  <td className="num pos">{percent(s.lifetimeReturnPct)}</td>
                  <td className="num">{percent(s.avgMonthlyPct)}</td>
                  <td className="num">
                    {s.unpaidProfit > 0 ? (
                      <span className="badge badge-warn">{money(s.unpaidProfit, sym)}</span>
                    ) : (
                      <span className="badge badge-success">مسدّد</span>
                    )}
                  </td>
                  <td>
                    <button
                      className="btn btn-sm"
                      onClick={() => go({ name: 'investor', id: s.investor.id })}
                    >
                      التفاصيل
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
