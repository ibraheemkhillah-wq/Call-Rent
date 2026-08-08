import { useEffect, useMemo, useState } from 'react'
import { useStore } from '../store'
import { useT } from '../i18n'
import { capitalAtMonthEnd } from '../lib/calc'
import { currentMonthKey, money, monthLabel, parseAmount, percent } from '../lib/format'
import { Empty, Field } from '../components/ui'
import { IconCheck, IconChart, IconUsers } from '../components/Icons'
import type { Route } from '../App'

/** وحدة إدخال ربح المستثمر: مبلغ بالعملة أو نسبة من رأس ماله */
type Unit = 'amount' | 'pct'

export function Profits({ go }: { go: (r: Route) => void }) {
  const t = useT()
  const u = t.ui
  const { db, bulkUpsertProfits, setProfitPaid } = useStore()
  const sym = db.settings.currencySymbol || '$'

  const [month, setMonth] = useState(currentMonthKey())
  /** القيم المُدخَلة في الشاشة قبل الحفظ — نصّاً كما كتبها المستخدم */
  const [draft, setDraft] = useState<Record<string, string>>({})
  /** وحدة كل صف على حدة، فيُدخل مستثمر بمبلغ وآخر بنسبة في الشهر نفسه */
  const [units, setUnits] = useState<Record<string, Unit>>({})
  /** التوزيع الجماعي: مبلغ إجمالي يُقسَّم، أو نسبة واحدة تُطبَّق على الجميع */
  const [poolMode, setPoolMode] = useState<Unit>('amount')
  const [poolValue, setPoolValue] = useState('')
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

  /** تحميل القيم الموجودة عند تغيير الشهر — المحفوظ دائماً مبلغ */
  useEffect(() => {
    const nextDraft: Record<string, string> = {}
    const nextUnits: Record<string, Unit> = {}
    for (const r of rows) {
      nextDraft[r.investor.id] = r.existing ? String(r.existing.amount) : ''
      nextUnits[r.investor.id] = 'amount'
    }
    setDraft(nextDraft)
    setUnits(nextUnits)
    setSaved(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, db.investors.length])

  /**
   * المبلغ الفعلي لصفٍّ ما.
   * ما يُحفظ دائماً مبلغ؛ النسبة صيغة إدخال تُحلّ إلى مبلغ بحسب رأس مال
   * صاحبها، فيبقى مصدر الأرقام واحداً مهما اختلفت طريقة الكتابة.
   */
  function amountOf(investorId: string, capital: number): number {
    const raw = parseAmount(draft[investorId] ?? '')
    if (!Number.isFinite(raw)) return 0
    return units[investorId] === 'pct' ? (capital * raw) / 100 : raw
  }

  const totalDraft = rows.reduce((s, r) => s + amountOf(r.investor.id, r.capital), 0)

  function toggleUnit(investorId: string, capital: number) {
    const from = units[investorId] ?? 'amount'
    const to: Unit = from === 'amount' ? 'pct' : 'amount'
    const raw = parseAmount(draft[investorId] ?? '')

    // القيمة تُحوَّل لا تُمسح: من كتب مبلغاً ثم بدّل يرى نسبته المكافئة
    let next = draft[investorId] ?? ''
    if (Number.isFinite(raw) && raw !== 0 && capital > 0) {
      next =
        to === 'pct'
          ? String(Number(((raw / capital) * 100).toFixed(4)))
          : ((capital * raw) / 100).toFixed(2)
    }

    setUnits({ ...units, [investorId]: to })
    setDraft({ ...draft, [investorId]: next })
    setSaved(false)
  }

  function distribute() {
    const value = parseAmount(poolValue)
    if (!Number.isFinite(value) || value <= 0) return

    const nextDraft: Record<string, string> = { ...draft }
    const nextUnits: Record<string, Unit> = { ...units }

    if (poolMode === 'pct') {
      // نسبة واحدة للجميع — تبقى نسبةً في الحقول لتُقرأ وتُعدَّل كما هي
      for (const r of rows) {
        nextDraft[r.investor.id] = r.capital > 0 ? String(value) : ''
        nextUnits[r.investor.id] = 'pct'
      }
    } else {
      if (totalCapital <= 0) return
      for (const r of rows) {
        const share = (r.capital / totalCapital) * value
        nextDraft[r.investor.id] = share > 0 ? share.toFixed(2) : ''
        nextUnits[r.investor.id] = 'amount'
      }
    }

    setDraft(nextDraft)
    setUnits(nextUnits)
    setSaved(false)
  }

  function save() {
    const payload = rows
      .filter((r) => (draft[r.investor.id] ?? '') !== '')
      .map((r) => ({
        investorId: r.investor.id,
        amount: amountOf(r.investor.id, r.capital),
      }))
    bulkUpsertProfits(month, payload)
    setSaved(true)
  }

  const saveButton = (
    <button className="btn btn-primary" onClick={save}>
      {saved ? (
        <>
          <IconCheck className="btn-icon" /> {u.profSaved}
        </>
      ) : (
        u.profSaveMonth
      )}
    </button>
  )

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
        <div className="head-actions">{saveButton}</div>
      </div>

      <div className="toolbar">
        <Field label={t.profits.month}>
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
        </Field>

        {/* التوزيع الجماعي: مبلغ يُقسَّم بالحصص، أو نسبة تُطبَّق على الجميع */}
        <div className="field">
          <label>{u.profModeLabel}</label>
          <div className="seg seg-tight">
            <button
              className={poolMode === 'amount' ? 'seg-btn is-on' : 'seg-btn'}
              onClick={() => setPoolMode('amount')}
            >
              <span className="seg-title">{u.profByAmount}</span>
            </button>
            <button
              className={poolMode === 'pct' ? 'seg-btn is-on' : 'seg-btn'}
              onClick={() => setPoolMode('pct')}
            >
              <span className="seg-title">{u.profByPct}</span>
            </button>
          </div>
        </div>

        <Field
          label={
            poolMode === 'pct' ? u.profDistributePctLabel : u.profDistributeLabel(sym)
          }
          hint={poolMode === 'pct' ? u.profDistributePctHint : u.profDistributeHint}
        >
          <input
            type="text"
            inputMode="decimal"
            value={poolValue}
            onChange={(e) => setPoolValue(e.target.value)}
            placeholder={poolMode === 'pct' ? '0.00 %' : '0.00'}
          />
        </Field>

        <button className="btn" onClick={distribute} disabled={!poolValue}>
          <IconChart className="btn-icon" />
          {poolMode === 'pct' ? u.profDistributePct : t.profits.distribute}
        </button>
      </div>

      <div className="card">
        <div className="card-title">{u.profTableTitle(monthLabel(month))}</div>
        <div className="card-sub">
          {u.profTableSub(money(totalCapital, sym), money(totalDraft, sym))}
        </div>

        <div className="table-wrap">
          <table className="profit-table">
            <thead>
              <tr>
                <th>{t.profits.investor}</th>
                <th className="num">{t.profits.capital}</th>
                <th className="num">{u.profColShare}</th>
                <th className="num" style={{ width: 210 }}>
                  {u.profColEntry}
                </th>
                <th className="num">{t.profits.pct}</th>
                <th>{u.profColPayout}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const id = r.investor.id
                const unit = units[id] ?? 'amount'
                const amt = amountOf(id, r.capital)
                const pct = r.capital > 0 ? (amt / r.capital) * 100 : 0
                const share = totalCapital > 0 ? (r.capital / totalCapital) * 100 : 0
                return (
                  <tr key={id} className="profit-row">
                    <td className="profit-head" data-label={t.profits.investor}>
                      <div className="person-name">{r.investor.name}</div>
                      {r.capital <= 0 && <div className="person-meta">{u.profNoCapital}</div>}
                    </td>
                    <td className="num" data-label={t.profits.capital}>
                      {money(r.capital, sym)}
                    </td>
                    <td className="num muted" data-label={u.profColShare}>
                      {percent(share, 1)}
                    </td>
                    <td data-label={u.profColEntry}>
                      {/* المبلغ والنسبة في حقل واحد، والزر يبدّل معناه */}
                      <div className="unit-input">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={draft[id] ?? ''}
                          onChange={(e) => {
                            setDraft({ ...draft, [id]: e.target.value })
                            setSaved(false)
                          }}
                          placeholder="0.00"
                        />
                        <button
                          className="unit-btn"
                          title={u.profUnitTitle}
                          aria-label={u.profUnitTitle}
                          onClick={() => toggleUnit(id, r.capital)}
                        >
                          {unit === 'pct' ? '%' : sym}
                        </button>
                      </div>
                      {unit === 'pct' && amt > 0 && (
                        <div className="unit-resolved num">
                          {u.profOfCapital(money(amt, sym))}
                        </div>
                      )}
                    </td>
                    <td className="num pos" data-label={t.profits.pct}>
                      {amt ? percent(pct) : '—'}
                    </td>
                    <td data-label={u.profColPayout}>
                      {r.existing ? (
                        <button
                          className={r.existing.paid ? 'badge badge-success' : 'badge badge-warn'}
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
          {saveButton}
          <span className="muted" style={{ fontSize: 13 }}>
            {u.profFootNote}
          </span>
        </div>
      </div>
    </>
  )
}
