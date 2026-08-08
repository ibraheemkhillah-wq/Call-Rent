import { useMemo, useState } from 'react'
import { useStore } from '../store'
import { useT } from '../i18n'
import { capitalAtMonthEnd, summarizeInvestor, trancheBreakdown } from '../lib/calc'
import {
  currentMonthKey,
  dateLabel,
  initials,
  money,
  monthLabel,
  parseAmount,
  percent,
  todayIso,
} from '../lib/format'
import { Field, Modal, Stat } from '../components/ui'
import {
  IconBack,
  IconCheck,
  IconClock,
  IconDoc,
  IconPercent,
  IconPlus,
  IconTrash,
  IconTrend,
  IconWallet,
} from '../components/Icons'
import type { Route } from '../App'

export function InvestorDetail({ id, go }: { id: string; go: (r: Route) => void }) {
  const t = useT()
  const u = t.ui
  const dc = t.doc
  const {
    db,
    addContribution,
    updateContribution,
    deleteContribution,
    upsertProfit,
    deleteProfit,
    setProfitPaid,
  } = useStore()
  const sym = db.settings.currencySymbol || '$'

  const investor = db.investors.find((i) => i.id === id)

  const [capOpen, setCapOpen] = useState(false)
  const [capForm, setCapForm] = useState({
    date: todayIso(),
    amount: '',
    type: 'deposit' as 'deposit' | 'withdrawal',
    note: '',
  })

  const [profitOpen, setProfitOpen] = useState(false)
  const [profitForm, setProfitForm] = useState({
    month: currentMonthKey(),
    amount: '',
    note: '',
    paid: false,
  })

  const mine = useMemo(
    () =>
      db.contributions
        .filter((c) => c.investorId === id)
        .sort((a, b) => b.date.localeCompare(a.date)),
    [db.contributions, id],
  )

  const myProfits = useMemo(
    () =>
      db.profits
        .filter((p) => p.investorId === id)
        .sort((a, b) => b.month.localeCompare(a.month)),
    [db.profits, id],
  )

  const summary = useMemo(
    () => (investor ? summarizeInvestor(investor, db.contributions, db.profits) : null),
    [investor, db.contributions, db.profits],
  )

  /** نصيب كل دفعة استثمارية من الأرباح — يظهر حين تتعدّد الدفعات */
  const tranches = useMemo(
    () => (investor ? trancheBreakdown(investor, db.contributions, db.profits) : []),
    [investor, db.contributions, db.profits],
  )

  if (!investor || !summary) {
    return (
      <div className="card">
        <p>{u.detNotFound}</p>
        <button className="btn" onClick={() => go({ name: 'investors' })}>
          {u.detBackToList}
        </button>
      </div>
    )
  }

  function saveCapital() {
    const amount = parseAmount(capForm.amount)
    if (!Number.isFinite(amount) || amount <= 0) return
    addContribution({
      investorId: id,
      date: capForm.date,
      amount,
      type: capForm.type,
      note: capForm.note,
    })
    setCapForm({ date: todayIso(), amount: '', type: 'deposit', note: '' })
    setCapOpen(false)
  }

  function saveProfit() {
    const amount = parseAmount(profitForm.amount)
    if (!Number.isFinite(amount)) return
    upsertProfit({
      investorId: id,
      month: profitForm.month,
      amount,
      paid: profitForm.paid,
      paidDate: profitForm.paid ? todayIso() : '',
      note: profitForm.note,
    })
    setProfitForm({ month: currentMonthKey(), amount: '', note: '', paid: false })
    setProfitOpen(false)
  }

  const contribsOfInvestor = db.contributions.filter((c) => c.investorId === id)

  return (
    <>
      <div className="page-head">
        <div>
          <div className="row" style={{ marginBottom: 8 }}>
            <button className="btn btn-sm" onClick={() => go({ name: 'investors' })}>
              <IconBack className="btn-icon" />
              {t.investors.title}
            </button>
          </div>
          <div className="person">
            <div className="avatar" style={{ width: 52, height: 52, fontSize: 18 }}>
              {initials(investor.name)}
            </div>
            <div>
              <h1>{investor.name}</h1>
              <p>
                {u.detJoinedSince(dateLabel(investor.joinDate))}
                {investor.phone && ` • ${investor.phone}`}
                {!investor.active && u.detInactiveSuffix}
              </p>
            </div>
          </div>
        </div>
        <div className="head-actions">
          <button className="btn" onClick={() => setCapOpen(true)}>
            <IconWallet className="btn-icon" />
            {u.detMovementTitle}
          </button>
          <button className="btn" onClick={() => setProfitOpen(true)}>
            <IconPlus className="btn-icon" />
            {u.detProfitTitle}
          </button>
          <button
            className="btn btn-primary"
            onClick={() => go({ name: 'reports', investorId: id })}
          >
            <IconDoc className="btn-icon" />
            {u.dashIssueReport}
          </button>
        </div>
      </div>

      <div className="grid grid-4" style={{ marginBottom: 22 }}>
        <Stat
          label={t.investor.currentCapital}
          value={money(summary.currentCapital, sym)}
          foot={u.detTotalDeposited(money(summary.totalDeposited, sym))}
          icon={<IconWallet size={16} />}
          highlight
        />
        <Stat
          label={t.investor.lifetimeProfit}
          value={money(summary.totalProfit, sym)}
          foot={u.detOverMonths(summary.activeMonths)}
          icon={<IconTrend size={16} />}
        />
        <Stat
          label={t.investor.lifetimeReturn}
          value={percent(summary.lifetimeReturnPct)}
          foot={u.detAvgMonthly(percent(summary.avgMonthlyPct))}
          icon={<IconPercent size={16} />}
        />
        <Stat
          label={u.detUnpaidStat}
          value={money(summary.unpaidProfit, sym)}
          foot={
            /* المُعاد استثماره خرج من المستحق، فيُذكر هنا كي لا يبدو ناقصاً */
            summary.reinvestedProfit > 0
              ? `${u.detPaidOut(money(summary.paidProfit, sym))} • ${t.invest.reinvestedStat}: ${money(summary.reinvestedProfit, sym)}`
              : u.detPaidOut(money(summary.paidProfit, sym))
          }
          icon={<IconClock size={16} />}
        />
      </div>

      {investor.notes && (
        <div className="card" style={{ marginBottom: 22 }}>
          <div className="card-title">{t.investors.notes}</div>
          <p className="muted" style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
            {investor.notes}
          </p>
        </div>
      )}

      {/* ─────────── الأرباح الشهرية ─────────── */}
      <div className="card" style={{ marginBottom: 22 }}>
        <div className="row">
          <div>
            <div className="card-title">{u.detProfitLog}</div>
            <div className="card-sub">{u.detProfitLogSub}</div>
          </div>
          <span className="spacer" />
          <button className="btn btn-sm" onClick={() => setProfitOpen(true)}>
            <IconPlus className="btn-icon" />
            {u.detAdd}
          </button>
        </div>

        {myProfits.length === 0 ? (
          <p className="muted">{u.detNoProfits}</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t.profits.month}</th>
                  <th className="num">{t.profits.capital}</th>
                  <th className="num">{t.profits.profit}</th>
                  <th className="num">{t.profits.pct}</th>
                  <th>{t.investors.status}</th>
                  <th>{t.investor.note}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {myProfits.map((p) => {
                  const cap = capitalAtMonthEnd(contribsOfInvestor, p.month)
                  const pct = cap > 0 ? (p.amount / cap) * 100 : 0
                  return (
                    <tr key={p.id}>
                      <td>{monthLabel(p.month)}</td>
                      <td className="num">{money(cap, sym)}</td>
                      <td className="num accent">{money(p.amount, sym)}</td>
                      <td className="num pos">{percent(pct)}</td>
                      <td>
                        <button
                          className={p.paid ? 'badge badge-success' : 'badge badge-warn'}
                          style={{ cursor: 'pointer', border: '1px solid' }}
                          onClick={() => setProfitPaid(p.id, !p.paid)}
                          title={t.profits.markPaid}
                        >
                          {p.paid ? (
                            <>
                              <IconCheck size={13} /> {t.investor.paid}
                            </>
                          ) : (
                            t.investor.due
                          )}
                        </button>
                      </td>
                      <td className="muted">{p.note || '—'}</td>
                      <td>
                        <button
                          className="icon-btn"
                          title={u.detDeleteEntry}
                          onClick={() => deleteProfit(p.id)}
                        >
                          <IconTrash />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td>{u.detTotal}</td>
                  <td className="num">—</td>
                  <td className="num">{money(summary.totalProfit, sym)}</td>
                  <td className="num">{percent(summary.lifetimeReturnPct)}</td>
                  <td colSpan={3}>
                    {u.detPaidDue(
                      money(summary.paidProfit, sym),
                      money(summary.unpaidProfit, sym),
                    )}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* ─────────── تفصيل الدفعات ─────────── */}
      {tranches.length > 1 && (
        <div className="card">
          <div>
            <div className="card-title">{dc.tranchesTitle}</div>
            <div className="card-sub">{dc.tranchesSub}</div>
          </div>

          {/*
           * ستة أعمدة لا تتّسع في عرض الجوال، والربح والعائد هما المقصود من
           * الجدول فلا يجوز أن يختفيا خلف تمرير أفقي. تحت 780px يتحوّل كل صف
           * إلى بطاقة مستقلة، وعناوين الأعمدة تُنقَل إلى كل خانة عبر data-label.
           */}
          <div className="table-wrap">
            <table className="tranche-table">
              <thead>
                <tr>
                  <th>{dc.trancheDate}</th>
                  <th className="num">{dc.trancheAmount}</th>
                  <th className="num">{dc.trancheRemaining}</th>
                  <th className="num">{dc.trancheProfit}</th>
                  <th className="num">{dc.trancheReturn}</th>
                  <th className="num">{dc.trancheMonths}</th>
                </tr>
              </thead>
              <tbody>
                {tranches.map((tr) => (
                  <tr key={tr.id} className="tranche-row">
                    <td className="tranche-head" data-label={dc.trancheDate}>
                      {dateLabel(tr.date)}
                    </td>
                    <td className="num" data-label={dc.trancheAmount}>
                      {money(tr.amount, sym)}
                    </td>
                    <td className="num" data-label={dc.trancheRemaining}>
                      {money(tr.remaining, sym)}
                    </td>
                    <td className="num accent" data-label={dc.trancheProfit}>
                      {money(tr.profit, sym)}
                    </td>
                    <td className="num pos" data-label={dc.trancheReturn}>
                      {percent(tr.returnPct)}
                    </td>
                    <td className="num" data-label={dc.trancheMonths}>
                      {dc.trancheMonthsCount(tr.months)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="hint" style={{ marginTop: 10 }}>
            {dc.tranchesNote}
          </p>
        </div>
      )}

      {/* ─────────── حركات رأس المال ─────────── */}
      <div className="card">
        <div className="row">
          <div>
            <div className="card-title">{t.investor.movements}</div>
            <div className="card-sub">{u.detMovementsSub}</div>
          </div>
          <span className="spacer" />
          <button className="btn btn-sm" onClick={() => setCapOpen(true)}>
            <IconPlus className="btn-icon" />
            {u.detAdd}
          </button>
        </div>

        {mine.length === 0 ? (
          <p className="muted">{u.detNoMovements}</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t.investor.date}</th>
                  <th>{u.detColType}</th>
                  <th className="num">{t.investor.amount}</th>
                  <th>{t.invest.colSource}</th>
                  <th>{t.investor.note}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {mine.map((c) => (
                  <tr key={c.id}>
                    <td>{dateLabel(c.date)}</td>
                    <td>
                      <span
                        className={c.type === 'deposit' ? 'badge badge-accent' : 'badge badge-muted'}
                      >
                        {c.type === 'deposit' ? t.investor.deposit : t.investor.withdrawal}
                      </span>
                    </td>
                    <td className={c.type === 'deposit' ? 'num pos' : 'num neg'}>
                      {c.type === 'deposit' ? '+' : '−'} {money(c.amount, sym)}
                    </td>
                    <td>
                      {c.type === 'deposit' ? (
                        /* المصدر يُبدَّل بعد التسجيل: النقر يقلبه بين الحالتين */
                        <button
                          className={
                            c.source === 'profit' ? 'src-tag is-profit' : 'src-tag'
                          }
                          title={t.invest.sourceLabel}
                          onClick={() =>
                            updateContribution(c.id, {
                              source: c.source === 'profit' ? 'new' : 'profit',
                            })
                          }
                        >
                          {c.source === 'profit'
                            ? t.invest.badgeProfit
                            : t.invest.badgeNew}
                        </button>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td className="muted">{c.note || '—'}</td>
                    <td>
                      <button
                        className="icon-btn"
                        title={u.detDeleteMovement}
                        onClick={() => deleteContribution(c.id)}
                      >
                        <IconTrash />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={2}>{u.detOutstanding}</td>
                  <td className="num">{money(summary.currentCapital, sym)}</td>
                  <td colSpan={2}>
                    {u.detDepositedWithdrawn(
                      money(summary.totalDeposited, sym),
                      money(summary.totalWithdrawn, sym),
                    )}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* ─────────── النوافذ ─────────── */}
      {capOpen && (
        <Modal
          title={u.detMovementTitle}
          onClose={() => setCapOpen(false)}
          footer={
            <>
              <button className="btn btn-primary" onClick={saveCapital}>
                {u.detSaveMovement}
              </button>
              <button className="btn" onClick={() => setCapOpen(false)}>
                {t.common.cancel}
              </button>
            </>
          }
        >
          <div className="grid grid-2">
            <Field label={t.investor.kind}>
              <select
                value={capForm.type}
                onChange={(e) =>
                  setCapForm({ ...capForm, type: e.target.value as 'deposit' | 'withdrawal' })
                }
              >
                <option value="deposit">{u.detDepositLong}</option>
                <option value="withdrawal">{t.investor.withdrawal}</option>
              </select>
            </Field>
            <Field label={t.investor.date}>
              <input
                type="date"
                value={capForm.date}
                onChange={(e) => setCapForm({ ...capForm, date: e.target.value })}
              />
            </Field>
            <Field label={u.detAmountOf(sym)}>
              <input
                type="text"
                inputMode="decimal"
                value={capForm.amount}
                onChange={(e) => setCapForm({ ...capForm, amount: e.target.value })}
                placeholder="0.00"
                autoFocus
              />
            </Field>
            <Field label={t.investor.note}>
              <input
                value={capForm.note}
                onChange={(e) => setCapForm({ ...capForm, note: e.target.value })}
                placeholder={u.detNotePlaceholder}
              />
            </Field>
          </div>
        </Modal>
      )}

      {profitOpen && (
        <Modal
          title={u.detProfitTitle}
          onClose={() => setProfitOpen(false)}
          footer={
            <>
              <button className="btn btn-primary" onClick={saveProfit}>
                {u.detSaveProfit}
              </button>
              <button className="btn" onClick={() => setProfitOpen(false)}>
                {t.common.cancel}
              </button>
            </>
          }
        >
          <div className="grid grid-2">
            <Field label={t.profits.month}>
              <input
                type="month"
                value={profitForm.month}
                onChange={(e) => setProfitForm({ ...profitForm, month: e.target.value })}
              />
            </Field>
            <Field
              label={u.detProfitAmountOf(sym)}
              hint={(() => {
                const cap = capitalAtMonthEnd(contribsOfInvestor, profitForm.month)
                const amt = parseAmount(profitForm.amount)
                if (cap <= 0) return u.detNoCapitalMonth
                if (!Number.isFinite(amt) || amt === 0)
                  return u.detCapitalThisMonth(money(cap, sym))
                return u.detRateOf(percent((amt / cap) * 100), money(cap, sym))
              })()}
            >
              <input
                type="text"
                inputMode="decimal"
                value={profitForm.amount}
                onChange={(e) => setProfitForm({ ...profitForm, amount: e.target.value })}
                placeholder="0.00"
                autoFocus
              />
            </Field>
          </div>

          <div style={{ marginTop: 14 }}>
            <Field label={t.investor.note}>
              <input
                value={profitForm.note}
                onChange={(e) => setProfitForm({ ...profitForm, note: e.target.value })}
              />
            </Field>
          </div>

          <label className="checkline" style={{ marginTop: 14 }}>
            <input
              type="checkbox"
              checked={profitForm.paid}
              onChange={(e) => setProfitForm({ ...profitForm, paid: e.target.checked })}
            />
            {u.detProfitPaidToInvestor}
          </label>

          <p className="hint" style={{ marginTop: 12 }}>
            {u.detReplaceNote}
          </p>
        </Modal>
      )}
    </>
  )
}
