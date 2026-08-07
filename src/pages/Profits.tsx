import { useEffect, useMemo, useState } from 'react'
import { useStore } from '../store'
import { useT } from '../i18n'
import { capitalAtMonthEnd } from '../lib/calc'
import { currentMonthKey, money, monthLabel, percent } from '../lib/format'
import { Empty, Field } from '../components/ui'
import { IconCheck, IconChart, IconUsers } from '../components/Icons'
import type { Route } from '../App'

export function Profits({ go }: { go: (r: Route) => void }) {
  const t = useT()
  const u = t.ui
  const { db, bulkUpsertProfits, setProfitPaid } = useStore()
  const sym = db.settings.currencySymbol || '$'

  const [month, setMonth] = useState(currentMonthKey())
  /** المبالغ المُدخَلة في الشاشة قبل الحفظ */
  const [draft, setDraft] = useState<Record<string, string>>({})
  /** مبلغ يُوزَّع تلقائياً حسب حصة كل مستثمر — أداة مساعدة اختيارية */
  const [poolAmount, setPoolAmount] = useState('')
  const [saved, setSaved] = useState(false)

  const active = useMemo(() => db.investors.filter((i) => i.active), [db.investors])

  const rows = useMemo(
    () =>
      active.map((inv) => {
        const contribs = db.contributions.filter((c) => c.investorId === inv.id)
        const capital = capitalAtMonthEnd(contribs, month)
        const existing = db.profits.find((p) => p.investorId === inv.id && p.month === month)
        return { investor: inv, capital, existing }
      }),
    [active, db.contributions, db.profits, month],
  )

  const totalCapital = rows.reduce((s, r) => s + r.capital, 0)

  /** تحميل القيم الموجودة عند تغيير الشهر */
  useEffect(() => {
    const next: Record<string, string> = {}
    for (const r of rows) {
      next[r.investor.id] = r.existing ? String(r.existing.amount) : ''
    }
    setDraft(next)
    setSaved(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, db.investors.length])

  const totalDraft = rows.reduce((s, r) => s + (Number(draft[r.investor.id]) || 0), 0)

  function distribute() {
    const pool = Number(poolAmount)
    if (!Number.isFinite(pool) || pool <= 0 || totalCapital <= 0) return
    const next: Record<string, string> = { ...draft }
    for (const r of rows) {
      const share = (r.capital / totalCapital) * pool
      next[r.investor.id] = share > 0 ? share.toFixed(2) : ''
    }
    setDraft(next)
    setSaved(false)
  }

  function save() {
    const payload = rows
      .filter((r) => draft[r.investor.id] !== '' && draft[r.investor.id] !== undefined)
      .map((r) => ({ investorId: r.investor.id, amount: Number(draft[r.investor.id]) || 0 }))
    bulkUpsertProfits(month, payload)
    setSaved(true)
  }

  if (active.length === 0) {
    return (
      <>
        <div className="page-head">
          <div>
            <h1>{t.profits.title}</h1>
            <p>{u.profSubtitle}</p>
          </div>
        </div>
        <div className="card">
          <Empty
            icon={<IconUsers size={26} />}
            title={u.profNoActive}
            text={u.profNoActiveText}
            action={
              <button className="btn btn-primary" onClick={() => go({ name: 'investors' })}>
                {t.investors.add}
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
          <h1>{t.profits.title}</h1>
          <p>{u.profSubtitleMonth(monthLabel(month))}</p>
        </div>
        <div className="head-actions">
          <button className="btn btn-primary" onClick={save}>
            {saved ? (
              <>
                <IconCheck className="btn-icon" /> {u.profSaved}
              </>
            ) : (
              u.profSaveMonth
            )}
          </button>
        </div>
      </div>

      <div className="toolbar">
        <Field label={t.profits.month}>
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
        </Field>
        <Field
          label={u.profDistributeLabel(sym)}
          hint={u.profDistributeHint}
        >
          <input
            type="number"
            step="0.01"
            min="0"
            value={poolAmount}
            onChange={(e) => setPoolAmount(e.target.value)}
            placeholder="0.00"
          />
        </Field>
        <button className="btn" onClick={distribute} disabled={!poolAmount}>
          <IconChart className="btn-icon" />
          {t.profits.distribute}
        </button>
      </div>

      <div className="card">
        <div className="card-title">{u.profTableTitle(monthLabel(month))}</div>
        <div className="card-sub">
          {u.profTableSub(money(totalCapital, sym), money(totalDraft, sym))}
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{t.profits.investor}</th>
                <th className="num">{t.profits.capital}</th>
                <th className="num">{u.profColShare}</th>
                <th className="num" style={{ width: 170 }}>
                  {u.profColMonthProfit(sym)}
                </th>
                <th className="num">{t.profits.pct}</th>
                <th>{u.profColPayout}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const amt = Number(draft[r.investor.id]) || 0
                const pct = r.capital > 0 ? (amt / r.capital) * 100 : 0
                const share = totalCapital > 0 ? (r.capital / totalCapital) * 100 : 0
                return (
                  <tr key={r.investor.id}>
                    <td>
                      <div className="person-name">{r.investor.name}</div>
                      {r.capital <= 0 && (
                        <div className="person-meta">{u.profNoCapital}</div>
                      )}
                    </td>
                    <td className="num">{money(r.capital, sym)}</td>
                    <td className="num muted">{percent(share, 1)}</td>
                    <td>
                      <input
                        type="number"
                        step="0.01"
                        value={draft[r.investor.id] ?? ''}
                        onChange={(e) => {
                          setDraft({ ...draft, [r.investor.id]: e.target.value })
                          setSaved(false)
                        }}
                        placeholder="0.00"
                      />
                    </td>
                    <td className="num pos">{amt ? percent(pct) : '—'}</td>
                    <td>
                      {r.existing ? (
                        <button
                          className={
                            r.existing.paid ? 'badge badge-success' : 'badge badge-warn'
                          }
                          style={{ cursor: 'pointer', border: '1px solid' }}
                          onClick={() => setProfitPaid(r.existing!.id, !r.existing!.paid)}
                        >
                          {r.existing.paid ? t.investor.paid : t.investor.due}
                        </button>
                      ) : (
                        <span className="badge badge-muted">{u.profUnsaved}</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr>
                <td>{t.profits.totalRow}</td>
                <td className="num">{money(totalCapital, sym)}</td>
                <td className="num">100%</td>
                <td className="num">{money(totalDraft, sym)}</td>
                <td className="num">
                  {percent(totalCapital > 0 ? (totalDraft / totalCapital) * 100 : 0)}
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="row" style={{ marginTop: 18 }}>
          <button className="btn btn-primary" onClick={save}>
            {saved ? (
              <>
                <IconCheck className="btn-icon" /> {u.profSaved}
              </>
            ) : (
              u.profSaveMonth
            )}
          </button>
          <span className="muted" style={{ fontSize: 13 }}>
            {u.profFootNote}
          </span>
        </div>
      </div>
    </>
  )
}
