import { useMemo, useState } from 'react'
import { useStore } from '../store'
import { capitalAtMonthEnd, summarizeInvestor } from '../lib/calc'
import {
  currentMonthKey,
  dateLabel,
  initials,
  money,
  monthLabel,
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
  const {
    db,
    addContribution,
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

  if (!investor || !summary) {
    return (
      <div className="card">
        <p>لم يتم العثور على المستثمر.</p>
        <button className="btn" onClick={() => go({ name: 'investors' })}>
          العودة إلى القائمة
        </button>
      </div>
    )
  }

  function saveCapital() {
    const amount = Number(capForm.amount)
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
    const amount = Number(profitForm.amount)
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
              المستثمرون
            </button>
          </div>
          <div className="person">
            <div className="avatar" style={{ width: 52, height: 52, fontSize: 18 }}>
              {initials(investor.name)}
            </div>
            <div>
              <h1>{investor.name}</h1>
              <p>
                منضم منذ {dateLabel(investor.joinDate)}
                {investor.phone && ` • ${investor.phone}`}
                {!investor.active && ' • حساب غير نشط'}
              </p>
            </div>
          </div>
        </div>
        <div className="head-actions">
          <button className="btn" onClick={() => setCapOpen(true)}>
            <IconWallet className="btn-icon" />
            حركة رأس مال
          </button>
          <button className="btn" onClick={() => setProfitOpen(true)}>
            <IconPlus className="btn-icon" />
            تسجيل ربح شهر
          </button>
          <button
            className="btn btn-gold"
            onClick={() => go({ name: 'reports', investorId: id })}
          >
            <IconDoc className="btn-icon" />
            إصدار تقرير
          </button>
        </div>
      </div>

      <div className="grid grid-4" style={{ marginBottom: 22 }}>
        <Stat
          label="رأس المال الحالي"
          value={money(summary.currentCapital, sym)}
          foot={`إجمالي المودع ${money(summary.totalDeposited, sym)}`}
          icon={<IconWallet size={16} />}
          gold
        />
        <Stat
          label="إجمالي الأرباح"
          value={money(summary.totalProfit, sym)}
          foot={`على مدى ${summary.activeMonths} شهر`}
          icon={<IconTrend size={16} />}
        />
        <Stat
          label="العائد التراكمي"
          value={percent(summary.lifetimeReturnPct)}
          foot={`متوسط شهري ${percent(summary.avgMonthlyPct)}`}
          icon={<IconPercent size={16} />}
        />
        <Stat
          label="أرباح مستحقة"
          value={money(summary.unpaidProfit, sym)}
          foot={`المصروف ${money(summary.paidProfit, sym)}`}
          icon={<IconClock size={16} />}
        />
      </div>

      {investor.notes && (
        <div className="card" style={{ marginBottom: 22 }}>
          <div className="card-title">ملاحظات</div>
          <p className="muted" style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
            {investor.notes}
          </p>
        </div>
      )}

      {/* ─────────── الأرباح الشهرية ─────────── */}
      <div className="card" style={{ marginBottom: 22 }}>
        <div className="row">
          <div>
            <div className="card-title">سجل الأرباح الشهرية</div>
            <div className="card-sub">النسبة تُحتسب على رأس المال في نهاية كل شهر</div>
          </div>
          <span className="spacer" />
          <button className="btn btn-sm" onClick={() => setProfitOpen(true)}>
            <IconPlus className="btn-icon" />
            إضافة
          </button>
        </div>

        {myProfits.length === 0 ? (
          <p className="muted">لم يتم تسجيل أي أرباح لهذا المستثمر بعد.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>الشهر</th>
                  <th className="num">رأس المال</th>
                  <th className="num">الربح</th>
                  <th className="num">النسبة</th>
                  <th>الحالة</th>
                  <th>ملاحظة</th>
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
                      <td className="num gold">{money(p.amount, sym)}</td>
                      <td className="num pos">{percent(pct)}</td>
                      <td>
                        <button
                          className={p.paid ? 'badge badge-success' : 'badge badge-warn'}
                          style={{ cursor: 'pointer', border: '1px solid' }}
                          onClick={() => setProfitPaid(p.id, !p.paid)}
                          title="اضغط لتغيير حالة الصرف"
                        >
                          {p.paid ? (
                            <>
                              <IconCheck size={13} /> مصروف
                            </>
                          ) : (
                            'مستحق'
                          )}
                        </button>
                      </td>
                      <td className="muted">{p.note || '—'}</td>
                      <td>
                        <button
                          className="icon-btn"
                          title="حذف القيد"
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
                  <td>الإجمالي</td>
                  <td className="num">—</td>
                  <td className="num">{money(summary.totalProfit, sym)}</td>
                  <td className="num">{percent(summary.lifetimeReturnPct)}</td>
                  <td colSpan={3}>
                    المصروف {money(summary.paidProfit, sym)} • المستحق{' '}
                    {money(summary.unpaidProfit, sym)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* ─────────── حركات رأس المال ─────────── */}
      <div className="card">
        <div className="row">
          <div>
            <div className="card-title">حركات رأس المال</div>
            <div className="card-sub">الإيداعات الاستثمارية والسحوبات</div>
          </div>
          <span className="spacer" />
          <button className="btn btn-sm" onClick={() => setCapOpen(true)}>
            <IconPlus className="btn-icon" />
            إضافة
          </button>
        </div>

        {mine.length === 0 ? (
          <p className="muted">لا توجد حركات مسجّلة — أضف مبلغ الاستثمار الأول.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>التاريخ</th>
                  <th>النوع</th>
                  <th className="num">المبلغ</th>
                  <th>ملاحظة</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {mine.map((c) => (
                  <tr key={c.id}>
                    <td>{dateLabel(c.date)}</td>
                    <td>
                      <span
                        className={c.type === 'deposit' ? 'badge badge-gold' : 'badge badge-muted'}
                      >
                        {c.type === 'deposit' ? 'إيداع استثماري' : 'سحب من رأس المال'}
                      </span>
                    </td>
                    <td className={c.type === 'deposit' ? 'num pos' : 'num neg'}>
                      {c.type === 'deposit' ? '+' : '−'} {money(c.amount, sym)}
                    </td>
                    <td className="muted">{c.note || '—'}</td>
                    <td>
                      <button
                        className="icon-btn"
                        title="حذف الحركة"
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
                  <td colSpan={2}>رأس المال القائم</td>
                  <td className="num">{money(summary.currentCapital, sym)}</td>
                  <td colSpan={2}>
                    مودع {money(summary.totalDeposited, sym)} • مسحوب{' '}
                    {money(summary.totalWithdrawn, sym)}
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
          title="حركة رأس مال"
          onClose={() => setCapOpen(false)}
          footer={
            <>
              <button className="btn btn-gold" onClick={saveCapital}>
                حفظ الحركة
              </button>
              <button className="btn" onClick={() => setCapOpen(false)}>
                إلغاء
              </button>
            </>
          }
        >
          <div className="grid grid-2">
            <Field label="نوع الحركة">
              <select
                value={capForm.type}
                onChange={(e) =>
                  setCapForm({ ...capForm, type: e.target.value as 'deposit' | 'withdrawal' })
                }
              >
                <option value="deposit">إيداع استثماري (زيادة رأس المال)</option>
                <option value="withdrawal">سحب من رأس المال</option>
              </select>
            </Field>
            <Field label="التاريخ">
              <input
                type="date"
                value={capForm.date}
                onChange={(e) => setCapForm({ ...capForm, date: e.target.value })}
              />
            </Field>
            <Field label={`المبلغ (${sym})`}>
              <input
                type="number"
                min="0"
                step="0.01"
                value={capForm.amount}
                onChange={(e) => setCapForm({ ...capForm, amount: e.target.value })}
                placeholder="0.00"
                autoFocus
              />
            </Field>
            <Field label="ملاحظة">
              <input
                value={capForm.note}
                onChange={(e) => setCapForm({ ...capForm, note: e.target.value })}
                placeholder="تحويل بنكي، نقداً…"
              />
            </Field>
          </div>
        </Modal>
      )}

      {profitOpen && (
        <Modal
          title="تسجيل ربح شهري"
          onClose={() => setProfitOpen(false)}
          footer={
            <>
              <button className="btn btn-gold" onClick={saveProfit}>
                حفظ الربح
              </button>
              <button className="btn" onClick={() => setProfitOpen(false)}>
                إلغاء
              </button>
            </>
          }
        >
          <div className="grid grid-2">
            <Field label="الشهر">
              <input
                type="month"
                value={profitForm.month}
                onChange={(e) => setProfitForm({ ...profitForm, month: e.target.value })}
              />
            </Field>
            <Field
              label={`مبلغ الربح (${sym})`}
              hint={(() => {
                const cap = capitalAtMonthEnd(contribsOfInvestor, profitForm.month)
                const amt = Number(profitForm.amount)
                if (cap <= 0) return 'لا يوجد رأس مال مسجّل حتى نهاية هذا الشهر'
                if (!Number.isFinite(amt) || amt === 0)
                  return `رأس المال في هذا الشهر: ${money(cap, sym)}`
                return `النسبة = ${percent((amt / cap) * 100)} من ${money(cap, sym)}`
              })()}
            >
              <input
                type="number"
                step="0.01"
                value={profitForm.amount}
                onChange={(e) => setProfitForm({ ...profitForm, amount: e.target.value })}
                placeholder="0.00"
                autoFocus
              />
            </Field>
          </div>

          <div style={{ marginTop: 14 }}>
            <Field label="ملاحظة">
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
            تم صرف الربح للمستثمر
          </label>

          <p className="hint" style={{ marginTop: 12 }}>
            إذا كان هناك ربح مسجّل مسبقاً لنفس الشهر فسيتم استبداله.
          </p>
        </Modal>
      )}
    </>
  )
}
