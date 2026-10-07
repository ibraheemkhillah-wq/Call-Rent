import { useEffect, useMemo, useState } from 'react'
import { useStore } from '../store'
import { useT } from '../i18n'
import { capitalAtMonthEnd } from '../lib/calc'
import { amountInput, currentMonthKey, money, monthLabel, parseAmount, percent } from '../lib/format'
import { Empty, Field } from '../components/ui'
import { IconCheck, IconChart, IconUsers } from '../components/Icons'
import type { Route } from '../App'

/** صيغة التوزيع الجماعي: مبلغ إجمالي يُقسَّم، أو نسبة تُطبَّق على الجميع */
type Mode = 'amount' | 'pct'

export function Profits({ go }: { go: (r: Route) => void }) {
  const t = useT()
  const u = t.ui
  const { db, bulkUpsertProfits, setProfitPaid } = useStore()
  const sym = db.settings.currencySymbol || '$'

  const [month, setMonth] = useState(currentMonthKey())

  /*
   * خانتان مكتوبتان لكل مستثمر: مبلغه ونسبته.
   *
   * لا زرَّ يبدّل معنى خانةٍ واحدة — فالمبدّل يُخفي أحد الرقمين ويجعل
   * الآخر ملتبساً: أهذا مبلغ أم نسبة؟ هنا كلاهما ظاهر ومكتوب، ومن
   * كتب في إحداهما حُسبت له الأخرى في الحال. وأيّهما كتب المستخدم
   * بنفسه هو المحفوظ صورةً، فيعود إليه الشهر كما تركه.
   */
  const [amountDraft, setAmountDraft] = useState<Record<string, string>>({})
  const [pctDraft, setPctDraft] = useState<Record<string, string>>({})
  /** أيّ الخانتين كتبها المستخدم آخراً — تُحفظ معها صورة الإدخال */
  const [source, setSource] = useState<Record<string, Mode>>({})

  /** أداة التوزيع الجماعي — يستعملها من شاء، ويتركها من شاء */
  const [poolMode, setPoolMode] = useState<Mode>('amount')
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

  /** النسبة المكافئة لمبلغ من رأس مالٍ ما، نصّاً جاهزاً للخانة */
  const pctText = (amount: number, capital: number) =>
    capital > 0 ? amountInput((amount / capital) * 100) : ''

  /** المبلغ المكافئ لنسبة من رأس مالٍ ما */
  const amountText = (pct: number, capital: number) => amountInput((capital * pct) / 100)

  /**
   * تحميل المحفوظ عند فتح الشهر.
   *
   * المحفوظ مبلغ دائماً، ومعه النسبة إن كان أُدخل نسبةً. فتُملأ الخانتان
   * معاً، ويُعلَم أيّهما كان الأصل كي يبقى الشهر كما تُرك.
   */
  useEffect(() => {
    const nextAmount: Record<string, string> = {}
    const nextPct: Record<string, string> = {}
    const nextSource: Record<string, Mode> = {}

    for (const r of rows) {
      const id = r.investor.id
      const entry = r.existing
      if (!entry) {
        nextAmount[id] = ''
        nextPct[id] = ''
        nextSource[id] = 'amount'
        continue
      }

      const pct = entry.entryPct
      // النسبة المحفوظة تُعتمد ما دامت لا تزال تُعطي المبلغ المحفوظ نفسه
      const byPct =
        typeof pct === 'number' &&
        Number.isFinite(pct) &&
        Math.abs((r.capital * pct) / 100 - entry.amount) < 0.005

      nextAmount[id] = amountInput(entry.amount)
      nextPct[id] = byPct ? amountInput(pct as number) : pctText(entry.amount, r.capital)
      nextSource[id] = byPct ? 'pct' : 'amount'
    }

    setAmountDraft(nextAmount)
    setPctDraft(nextPct)
    setSource(nextSource)
    setSaved(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, db.investors.length])

  /** المبلغ المقروء من خانة المبلغ، و null إن تُركت فارغة */
  function amountOf(investorId: string): number | null {
    const text = (amountDraft[investorId] ?? '').trim()
    if (text === '') return null
    const raw = parseAmount(text)
    return Number.isFinite(raw) ? raw : null
  }

  const totalDraft = rows.reduce((s, r) => s + (amountOf(r.investor.id) ?? 0), 0)

  /** كتابة في خانة المبلغ: تُحسب النسبة منها */
  function writeAmount(id: string, text: string, capital: number) {
    const raw = parseAmount(text)
    setAmountDraft({ ...amountDraft, [id]: text })
    setPctDraft({
      ...pctDraft,
      [id]: text.trim() === '' || !Number.isFinite(raw) ? '' : pctText(raw, capital),
    })
    setSource({ ...source, [id]: 'amount' })
    setSaved(false)
  }

  /** كتابة في خانة النسبة: يُحسب المبلغ منها */
  function writePct(id: string, text: string, capital: number) {
    const raw = parseAmount(text)
    setPctDraft({ ...pctDraft, [id]: text })
    setAmountDraft({
      ...amountDraft,
      [id]: text.trim() === '' || !Number.isFinite(raw) ? '' : amountText(raw, capital),
    })
    setSource({ ...source, [id]: 'pct' })
    setSaved(false)
  }

  /**
   * التوزيع الجماعي — أداةٌ لمن أراد رقماً واحداً للجميع.
   *
   * تملأ الخانتين لكل مستثمر، ثم يبقى لكل صفٍّ أن يُعدَّل بعدها على
   * حدة: من أراد توحيد النسبة وحّدها بضغطة، ومن أراد تفريقها كتب في
   * صفٍّ ما شاء. القرار للمستخدم في الحالين.
   */
  function distribute() {
    const value = parseAmount(poolValue)
    if (!Number.isFinite(value)) return

    const nextAmount: Record<string, string> = { ...amountDraft }
    const nextPct: Record<string, string> = { ...pctDraft }
    const nextSource: Record<string, Mode> = { ...source }

    if (poolMode === 'pct') {
      // نسبة واحدة للجميع، ويُحسب لكلٍّ مبلغه من رأس ماله
      for (const r of rows) {
        nextPct[r.investor.id] = amountInput(value)
        nextAmount[r.investor.id] = amountText(value, r.capital)
        nextSource[r.investor.id] = 'pct'
      }
    } else {
      if (totalCapital <= 0) return

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

      const exact = rows.map((r) => (r.capital / totalCapital) * cents)
      const share = exact.map((x) => Math.floor(x))
      const byFraction = exact
        .map((x, i) => ({ i, frac: x - Math.floor(x) }))
        .sort((a, b) => b.frac - a.frac)

      let rest = cents - share.reduce((s, x) => s + x, 0)
      for (let k = 0; k < byFraction.length && rest > 0; k++, rest--) share[byFraction[k].i] += 1

      rows.forEach((r, i) => {
        const amount = (sign * share[i]) / 100
        nextAmount[r.investor.id] = amountInput(amount)
        nextPct[r.investor.id] = pctText(amount, r.capital)
        nextSource[r.investor.id] = 'amount'
      })
    }

    setAmountDraft(nextAmount)
    setPctDraft(nextPct)
    setSource(nextSource)
    setSaved(false)
  }

  function save() {
    const payload = rows.map((r) => {
      const id = r.investor.id
      const amount = amountOf(id)
      const pct = parseAmount(pctDraft[id] ?? '')
      const byPct = amount !== null && source[id] === 'pct' && Number.isFinite(pct)
      return {
        investorId: id,
        amount,
        // تُحفظ النسبة مع المبلغ إن كانت هي المكتوبة، ليعود الحقل كما كُتب
        entryPct: byPct ? pct : undefined,
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
          label={poolMode === 'pct' ? u.profDistributePctLabel : u.profDistributeLabel(sym)}
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
          <table className="stack-table">
            <thead>
              <tr>
                <th>{t.profits.investor}</th>
                <th className="num">{t.profits.capital}</th>
                <th className="num">{u.profColShare}</th>
                <th className="num" style={{ width: 170 }}>
                  {u.profColEntry}
                </th>
                <th className="num" style={{ width: 150 }}>
                  {t.profits.pct}
                </th>
                <th>{u.profColPayout}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const id = r.investor.id
                const amt = amountOf(id)
                const share = totalCapital > 0 ? (r.capital / totalCapital) * 100 : 0
                const negative = amt !== null && amt < 0
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

                    {/* المبلغ والنسبة خانتان مكتوبتان، وكلٌّ تحسب الأخرى */}
                    <td className="cell-amount" data-label={u.profColEntry}>
                      <div className={negative ? 'num-input is-neg' : 'num-input'}>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={amountDraft[id] ?? ''}
                          onChange={(e) => writeAmount(id, e.target.value, r.capital)}
                          placeholder="0.00"
                          aria-label={u.profColEntry}
                        />
                        <span className="num-unit">{sym}</span>
                      </div>
                    </td>
                    <td className="cell-pct" data-label={t.profits.pct}>
                      <div className={negative ? 'num-input is-neg' : 'num-input'}>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={pctDraft[id] ?? ''}
                          onChange={(e) => writePct(id, e.target.value, r.capital)}
                          placeholder="0.00"
                          disabled={r.capital <= 0}
                          aria-label={t.profits.pct}
                        />
                        <span className="num-unit">%</span>
                      </div>
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
