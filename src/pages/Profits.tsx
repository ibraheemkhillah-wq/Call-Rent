import { useEffect, useMemo, useState } from 'react'
import { useStore } from '../store'
import { useT } from '../i18n'
import { capitalAtMonthEnd } from '../lib/calc'
import { amountInput, currentMonthKey, money, monthLabel, parseAmount, percent } from '../lib/format'
import { Empty, Field } from '../components/ui'
import { IconCheck, IconChart, IconUndo, IconUsers } from '../components/Icons'
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
  /**
   * من خرج عن النسبة الموحّدة.
   *
   * لا معنى لنسبةٍ موحّدة إن كانت تمحو ما خصّصه المستخدم لمستثمرٍ بعينه.
   * فمن كُتب له رقمٌ بيده صار «خاصاً»، ولا تمسّه النسبة الموحّدة بعدها
   * إلا بطلبٍ صريح. وهكذا يجتمع الأمران: واحدة للجميع، وخاصة لمن يستحق.
   */
  const [custom, setCustom] = useState<Record<string, boolean>>({})
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

  /**
   * تحميل المحفوظ عند فتح الشهر.
   *
   * المحفوظ مبلغ دائماً، ومعه صورة الإدخال إن كانت نسبةً. تُعاد النسبة
   * كما كُتبت ما دامت لا تزال تُعطي المبلغ المحفوظ نفسه؛ وإلا عُرض
   * المبلغ، فالمعروض لا يخالف المحفوظ في الحالين.
   */
  useEffect(() => {
    const nextDraft: Record<string, string> = {}
    const nextUnits: Record<string, Unit> = {}
    for (const r of rows) {
      const saved = r.existing
      if (!saved) {
        nextDraft[r.investor.id] = ''
        nextUnits[r.investor.id] = 'amount'
        continue
      }
      const pct = saved.entryPct
      const asPct =
        typeof pct === 'number' &&
        Number.isFinite(pct) &&
        Math.abs((r.capital * pct) / 100 - saved.amount) < 0.005
      nextDraft[r.investor.id] = amountInput(asPct ? (pct as number) : saved.amount)
      nextUnits[r.investor.id] = asPct ? 'pct' : 'amount'
    }
    /*
     * النسبة الموحّدة تُستنتج ولا تُخزَّن: هي النسبة التي يتشارك فيها
     * أكثر من مستثمر. ومن خالفها فله نسبة خاصة، فيعود الشهر المحفوظ
     * كما تُرك: الموحّدة في خانتها، والخاصّة موسومةً عند أصحابها.
     */
    const pctOf = (id: string) =>
      nextUnits[id] === 'pct' && nextDraft[id] !== '' ? nextDraft[id] : null

    const tally = new Map<string, number>()
    for (const r of rows) {
      const v = pctOf(r.investor.id)
      if (v !== null) tally.set(v, (tally.get(v) ?? 0) + 1)
    }
    let shared = ''
    let most = 1
    for (const [v, n] of tally) {
      if (n > most) { shared = v; most = n }
    }

    const nextCustom: Record<string, boolean> = {}
    for (const r of rows) {
      const v = pctOf(r.investor.id)
      // الفارغ يتبع الموحّدة، والمكتوب بخلافها خاصٌّ بصاحبه
      nextCustom[r.investor.id] = nextDraft[r.investor.id] !== '' && v !== shared
    }

    setDraft(nextDraft)
    setUnits(nextUnits)
    setCustom(nextCustom)
    if (shared) {
      setPoolMode('pct')
      setPoolValue(shared)
    }
    setSaved(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, db.investors.length])

  /**
   * المبلغ الفعلي لصفٍّ ما، و null إن تُرك الحقل فارغاً.
   *
   * الصفر قيمة لا فراغ: شهرٌ بلا أرباح واقعة تُسجَّل، وخسارةٌ تُسجَّل
   * بالسالب. وما يُحفظ دائماً مبلغ؛ النسبة صيغة إدخال تُحلّ إلى مبلغ
   * بحسب رأس مال صاحبها، فيبقى مصدر الأرقام واحداً مهما اختلفت الكتابة.
   */
  function amountOf(investorId: string, capital: number): number | null {
    const text = (draft[investorId] ?? '').trim()
    if (text === '') return null
    const raw = parseAmount(text)
    if (!Number.isFinite(raw)) return null
    return units[investorId] === 'pct' ? (capital * raw) / 100 : raw
  }

  const totalDraft = rows.reduce((s, r) => s + (amountOf(r.investor.id, r.capital) ?? 0), 0)

  function toggleUnit(investorId: string, capital: number) {
    const from = units[investorId] ?? 'amount'
    const to: Unit = from === 'amount' ? 'pct' : 'amount'
    const raw = parseAmount(draft[investorId] ?? '')

    // القيمة تُحوَّل لا تُمسح: من كتب مبلغاً ثم بدّل يرى نسبته المكافئة
    let next = draft[investorId] ?? ''
    if (Number.isFinite(raw) && raw !== 0 && capital > 0) {
      next =
        to === 'pct' ? amountInput((raw / capital) * 100) : amountInput((capital * raw) / 100)
    }

    setUnits({ ...units, [investorId]: to })
    setDraft({ ...draft, [investorId]: next })
    setCustom({ ...custom, [investorId]: true })
    setSaved(false)
  }

  /** يُعيد صفاً إلى النسبة الموحّدة — ويأخذها فوراً إن كانت مكتوبة */
  function unsetCustom(investorId: string) {
    setCustom({ ...custom, [investorId]: false })
    const value = parseAmount(poolValue)
    if (poolMode === 'pct' && poolValue !== '' && Number.isFinite(value)) {
      setDraft({ ...draft, [investorId]: amountInput(value) })
      setUnits({ ...units, [investorId]: 'pct' })
    }
    setSaved(false)
  }

  /** من ستشمله النسبة الموحّدة: الجميع، أو من لم يُخصَّص له شيء */
  const customIds = rows.filter((r) => custom[r.investor.id]).map((r) => r.investor.id)
  const customCount = customIds.length

  /**
   * تطبيق الموحّدة.
   *
   * `all` تعني أن المستخدم طلبها صراحةً على الجميع، فتُلغى الخصوصيات.
   * وبدونها لا تُمسّ النسب الخاصة، ويُقسَّم المبلغ على الباقين وحدهم.
   */
  function distribute(all = false) {
    const value = parseAmount(poolValue)
    if (!Number.isFinite(value)) return

    const targets = all ? rows : rows.filter((r) => !custom[r.investor.id])
    if (targets.length === 0) return

    const nextDraft: Record<string, string> = { ...draft }
    const nextUnits: Record<string, Unit> = { ...units }

    if (poolMode === 'pct') {
      // نسبة واحدة للجميع — تبقى نسبةً في الحقول لتُقرأ وتُعدَّل كما هي
      for (const r of targets) {
        nextDraft[r.investor.id] = amountInput(value)
        nextUnits[r.investor.id] = 'pct'
      }
    } else {
      // المبلغ يُقسَّم على من ستشملهم القسمة وحدهم، بنسبة رؤوس أموالهم
      const base = targets.reduce((s, r) => s + r.capital, 0)
      if (base <= 0) return

      /*
       * التوزيع بالقروش لا بالكسور: تُقرَّب كل حصة إلى قرشين ليُقرأ
       * الرقم، ثم يُعطى الباقي لأصحاب أكبر كسرٍ مهدور. فيساوي مجموع
       * الحصص المبلغَ الموزَّع بالضبط، ولا يظهر فرق قرشٍ في السطر الأخير.
       *
       * ويُوزَّع المقدار المطلق ثم تُعاد الإشارة، فتُقسَّم الخسارة على
       * الحصص كما يُقسَّم الربح تماماً.
       */
      const signed = Math.round(value * 100)
      const sign = signed < 0 ? -1 : 1
      const cents = Math.abs(signed)

      const exact = targets.map((r) => (r.capital / base) * cents)
      const share = exact.map((x) => Math.floor(x))
      const byFraction = exact
        .map((x, i) => ({ i, frac: x - Math.floor(x) }))
        .sort((a, b) => b.frac - a.frac)

      let rest = cents - share.reduce((s, x) => s + x, 0)
      for (let k = 0; k < byFraction.length && rest > 0; k++, rest--) share[byFraction[k].i] += 1

      targets.forEach((r, i) => {
        nextDraft[r.investor.id] = amountInput((sign * share[i]) / 100)
        nextUnits[r.investor.id] = 'amount'
      })
    }

    setDraft(nextDraft)
    setUnits(nextUnits)
    // ما شملته الموحّدة لم يعد خاصاً
    if (all) setCustom({})
    setSaved(false)
  }

  function save() {
    const payload = rows.map((r) => {
      const amount = amountOf(r.investor.id, r.capital)
      const raw = parseAmount(draft[r.investor.id] ?? '')
      const asPct = amount !== null && units[r.investor.id] === 'pct' && Number.isFinite(raw)
      return {
        investorId: r.investor.id,
        amount,
        // تُحفظ صورة الإدخال مع المبلغ ليعود الحقل كما كُتب
        entryPct: asPct ? raw : undefined,
      }
    })
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

        <button className="btn" onClick={() => distribute()} disabled={!poolValue}>
          <IconChart className="btn-icon" />
          {poolMode === 'pct' ? u.profDistributePct : t.profits.distribute}
        </button>
      </div>

      {/* من خرج عن الموحّدة يُقال صراحةً، ويبقى تجاوزه بيد المستخدم */}
      {customCount > 0 && (
        <div className="shared-note no-print">
          <span className="shared-dot" />
          <span>{u.profCustomNote(customCount)}</span>
          <button
            className="btn btn-sm"
            onClick={() => distribute(true)}
            disabled={!poolValue}
          >
            {u.profApplyAll}
          </button>
        </div>
      )}

      <div className="card">
        <div className="card-title">{u.profTableTitle(monthLabel(month))}</div>
        <div className="card-sub">
          {u.profTableSub(money(totalCapital, sym), money(totalDraft, sym))}
        </div>

        <div className="table-wrap">
          <table className="stack-table">
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
                const pct = amt !== null && r.capital > 0 ? (amt / r.capital) * 100 : 0
                const share = totalCapital > 0 ? (r.capital / totalCapital) * 100 : 0
                return (
                  <tr key={id} className="profit-row">
                    <td className="stack-head" data-label={t.profits.investor}>
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
                            setCustom({ ...custom, [id]: true })
                            setSaved(false)
                          }}
                          placeholder="0.00"
                        />
                        <button
                          className={unit === 'pct' ? 'unit-btn is-pct' : 'unit-btn'}
                          title={u.profUnitTitle}
                          aria-label={u.profUnitTitle}
                          onClick={() => toggleUnit(id, r.capital)}
                        >
                          {unit === 'pct' ? '%' : sym}
                        </button>
                      </div>
                      {unit === 'pct' && amt !== null && (
                        <div className="unit-resolved num">
                          {u.profOfCapital(money(amt, sym))}
                        </div>
                      )}
                      {custom[id] && (
                        <button
                          className="custom-tag"
                          onClick={() => unsetCustom(id)}
                          title={u.profCustomReset}
                        >
                          {u.profCustomBadge}
                          <IconUndo size={13} />
                        </button>
                      )}
                    </td>
                    <td
                      className={amt !== null && amt < 0 ? 'num neg' : 'num pos'}
                      data-label={t.profits.pct}
                    >
                      {amt !== null ? percent(pct) : '—'}
                    </td>
                    <td data-label={u.profColPayout}>
                      {/*
                        الصرف لا يُسأل عنه إلا في شهرٍ رَبِح: الشهر الصفر
                        لا يُصرف، والخسارة لا تُصرف — فتُذكر حالها ولا
                        يُعرض زرٌّ لا معنى لضغطه.
                      */}
                      {!r.existing ? (
                        <span className="badge badge-muted">{u.profUnsaved}</span>
                      ) : r.existing.amount > 0 ? (
                        <button
                          className={r.existing.paid ? 'badge badge-success' : 'badge badge-warn'}
                          style={{ cursor: 'pointer', border: '1px solid' }}
                          onClick={() => setProfitPaid(r.existing!.id, !r.existing!.paid)}
                        >
                          {r.existing.paid ? t.investor.paid : t.investor.due}
                        </button>
                      ) : r.existing.amount < 0 ? (
                        <span className="badge badge-danger">{u.profLoss}</span>
                      ) : (
                        <span className="badge badge-muted">{u.profZero}</span>
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
