import { useEffect, useMemo, useState } from 'react'
import { useStore } from '../store'
import { capitalAtMonthEnd } from '../lib/calc'
import { currentMonthKey, money, monthLabel, percent } from '../lib/format'
import { Empty, Field } from '../components/ui'
import { IconCheck, IconChart, IconUsers } from '../components/Icons'
import type { Route } from '../App'

export function Profits({ go }: { go: (r: Route) => void }) {
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
            <h1>الأرباح الشهرية</h1>
            <p>تسجيل أرباح جميع المستثمرين لشهر واحد دفعة واحدة</p>
          </div>
        </div>
        <div className="card">
          <Empty
            icon={<IconUsers size={26} />}
            title="لا يوجد مستثمرون نشطون"
            text="أضف مستثمرين أولاً لتتمكن من تسجيل الأرباح الشهرية."
            action={
              <button className="btn btn-gold" onClick={() => go({ name: 'investors' })}>
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
          <h1>الأرباح الشهرية</h1>
          <p>سجّل ربح كل مستثمر لشهر {monthLabel(month)} — والنسب تُحتسب تلقائياً</p>
        </div>
        <div className="head-actions">
          <button className="btn btn-gold" onClick={save}>
            {saved ? (
              <>
                <IconCheck className="btn-icon" /> تم الحفظ
              </>
            ) : (
              'حفظ أرباح الشهر'
            )}
          </button>
        </div>
      </div>

      <div className="toolbar">
        <Field label="الشهر">
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
        </Field>
        <Field
          label={`توزيع مبلغ إجمالي (${sym})`}
          hint="أداة مساعدة: توزّع المبلغ على المستثمرين بنسبة رأس مال كل واحد"
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
          وزّع تلقائياً
        </button>
      </div>

      <div className="card">
        <div className="card-title">جدول الأرباح — {monthLabel(month)}</div>
        <div className="card-sub">
          إجمالي رأس المال في هذا الشهر: {money(totalCapital, sym)} • المُدخل حالياً:{' '}
          {money(totalDraft, sym)}
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>المستثمر</th>
                <th className="num">رأس المال</th>
                <th className="num">الحصة</th>
                <th className="num" style={{ width: 170 }}>
                  ربح الشهر ({sym})
                </th>
                <th className="num">النسبة</th>
                <th>الصرف</th>
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
                        <div className="person-meta">لا يوجد رأس مال في هذا الشهر</div>
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
                          {r.existing.paid ? 'مصروف' : 'مستحق'}
                        </button>
                      ) : (
                        <span className="badge badge-muted">غير محفوظ</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr>
                <td>الإجمالي</td>
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
          <button className="btn btn-gold" onClick={save}>
            {saved ? (
              <>
                <IconCheck className="btn-icon" /> تم الحفظ
              </>
            ) : (
              'حفظ أرباح الشهر'
            )}
          </button>
          <span className="muted" style={{ fontSize: 13 }}>
            الحقول الفارغة تُتجاهل. القيم المحفوظة سابقاً لنفس الشهر سيتم تحديثها.
          </span>
        </div>
      </div>
    </>
  )
}
