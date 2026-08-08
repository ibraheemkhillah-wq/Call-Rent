/**
 * محرك الحسابات المالية
 *
 * القواعد المعتمدة:
 *  • رأس المال في نهاية أي شهر = مجموع الإيداعات ناقص السحوبات حتى آخر يوم في ذلك الشهر.
 *  • نسبة الربح الشهرية = ربح الشهر ÷ رأس المال في نهاية ذلك الشهر × 100.
 *  • نسبة الربح لفترة (ربع/نصف/سنة) = مجموع أرباح الفترة ÷ متوسط رأس المال خلال أشهر الفترة × 100.
 *    (متوسط رأس المال يُحسب على الأشهر التي كان فيها رأس مال فعلي فقط، حتى لا تُخفَّض النسبة
 *     بأشهر ما قبل انضمام المستثمر.)
 */

import type {
  Contribution,
  DepositSource,
  Investor,
  MonthKey,
  PeriodType,
  ProfitEntry,
} from '../types'
import { dict } from '../i18n/current'

/* ────────────────────────── أدوات الأشهر ────────────────────────── */

export function monthKeyOf(iso: string): MonthKey {
  return iso.slice(0, 7)
}

/** آخر يوم في الشهر بصيغة YYYY-MM-DD */
export function endOfMonth(month: MonthKey): string {
  const [y, m] = month.split('-').map(Number)
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return `${month}-${String(last).padStart(2, '0')}`
}

/** قائمة الأشهر ضمن فترة محددة */
export function monthsOfPeriod(
  type: PeriodType,
  year: number,
  index: number,
): MonthKey[] {
  const make = (from: number, to: number) => {
    const out: MonthKey[] = []
    for (let m = from; m <= to; m++) out.push(`${year}-${String(m).padStart(2, '0')}`)
    return out
  }
  switch (type) {
    case 'monthly':
      return make(index, index)
    case 'quarterly':
      return make((index - 1) * 3 + 1, (index - 1) * 3 + 3)
    case 'semiannual':
      return make((index - 1) * 6 + 1, (index - 1) * 6 + 6)
    case 'annual':
      return make(1, 12)
  }
}

/** عدد الخيارات المتاحة لكل نوع فترة */
export function periodCount(type: PeriodType): number {
  return type === 'monthly' ? 12 : type === 'quarterly' ? 4 : type === 'semiannual' ? 2 : 1
}

/** اسم الفترة بالعربية — مثال: «الربع الثاني 2026» */
export function periodLabel(type: PeriodType, year: number, index: number): string {
  const p = dict().periods
  switch (type) {
    case 'monthly':
      return `${dict().months[index - 1]} ${year}`
    case 'quarterly':
      return p.quarterOf(index, year)
    case 'semiannual':
      return p.halfOf(index, year)
    case 'annual':
      return p.fiscalYear(year)
  }
}

/** أسماء أنواع الفترات باللغة الحالية — دالة لا ثابت، فاللغة تتغيّر */
export function periodNames(): Record<PeriodType, string> {
  const p = dict().periods
  return {
    monthly: p.monthly,
    quarterly: p.quarterly,
    semiannual: p.semiannual,
    annual: p.annual,
  }
}

/** معامل التحويل إلى عائد سنوي مكافئ */
export function annualizeFactor(type: PeriodType): number {
  return type === 'monthly' ? 12 : type === 'quarterly' ? 4 : type === 'semiannual' ? 2 : 1
}

/* ────────────────────────── رأس المال ────────────────────────── */

/** صافي رأس المال حتى تاريخ معيّن (شامل) */
export function capitalAsOf(contributions: Contribution[], isoDate: string): number {
  return contributions.reduce((sum, c) => {
    if (c.date > isoDate) return sum
    return sum + (c.type === 'deposit' ? c.amount : -c.amount)
  }, 0)
}

/** رأس المال في نهاية شهر معيّن */
export function capitalAtMonthEnd(contributions: Contribution[], month: MonthKey): number {
  return capitalAsOf(contributions, endOfMonth(month))
}


/**
 * مصدر إيداعٍ ما، مع استنتاجٍ لما سُجّل قبل وجود هذا الحقل.
 * أقدم إيداع للمستثمر هو استثماره الأولي، وما بعده مال جديد — فتُقرأ
 * البيانات القديمة صحيحةً بلا ترحيل ولا تعديل عليها.
 */
export function depositSource(c: Contribution, all: Contribution[]): DepositSource {
  if (c.source) return c.source
  const mine = all
    .filter((x) => x.investorId === c.investorId && x.type === 'deposit')
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))
  return mine[0]?.id === c.id ? 'initial' : 'new'
}

/* ────────────────────────── تفصيل الدفعات ────────────────────────── */

/**
 * دفعة استثمارية واحدة (إيداع) وما خصّها من الأرباح.
 *
 * لماذا التوزيع بالتناسب دقيق لا تقريبي: التطبيق يسجّل ربحاً واحداً
 * لكل مستثمر في الشهر، أي أن كل أمواله تعمل بالمعدّل نفسه في ذلك
 * الشهر — وإن اختلف المعدّل من شهر لآخر. فحصة كل دفعة من ربح الشهر
 * هي نسبتها من رأس المال القائم في ذلك الشهر، بالضبط.
 */
export interface Tranche {
  id: string
  date: string
  /** المبلغ المودَع أصلاً */
  amount: number
  /** المتبقي منه بعد السحوبات */
  remaining: number
  /** نصيبها من الأرباح */
  profit: number
  /** عائدها = ربحها ÷ مبلغها الأصلي */
  returnPct: number
  /** عدد الأشهر التي عملت فيها */
  months: number
  /** متوسط عائدها الشهري */
  avgMonthlyPct: number
  note: string
}

/**
 * يوزّع أرباح المستثمر على دفعاته الاستثمارية.
 *
 * السحوبات تُخصم من الأقدم فالأحدث (FIFO) — وهو العرف المحاسبي
 * المعتاد، ويعني أن المال الذي مكث أطول هو أول ما يخرج.
 *
 * `untilMonth` يحدّ الحساب بنهاية شهر معيّن، فلا يحتسب تقرير يوليو
 * أرباح أغسطس.
 */
export function trancheBreakdown(
  investor: Investor,
  contributions: Contribution[],
  profits: ProfitEntry[],
  untilMonth?: MonthKey,
): Tranche[] {
  const mine = contributions
    .filter((c) => c.investorId === investor.id)
    .sort((a, b) => a.date.localeCompare(b.date))

  const tranches: (Tranche & { balance: number })[] = mine
    .filter((c) => c.type === 'deposit')
    .map((c) => ({
      id: c.id,
      date: c.date,
      amount: c.amount,
      remaining: c.amount,
      profit: 0,
      returnPct: 0,
      months: 0,
      avgMonthlyPct: 0,
      note: c.note,
      balance: 0,
    }))

  if (tranches.length === 0) return []

  const myProfits = profits
    .filter((p) => p.investorId === investor.id)
    .filter((p) => !untilMonth || p.month <= untilMonth)
    .sort((a, b) => a.month.localeCompare(b.month))

  /* الأحداث بترتيبها الزمني: كل إيداع يفتح دفعة، وكل سحب يستهلك الأقدم */
  let next = 0
  const applyUntil = (isoDate: string) => {
    while (next < mine.length && mine[next].date <= isoDate) {
      const c = mine[next++]
      if (c.type === 'deposit') {
        const t = tranches.find((x) => x.id === c.id)
        if (t) t.balance = c.amount
      } else {
        let left = c.amount
        for (const t of tranches) {
          if (left <= 0) break
          const take = Math.min(t.balance, left)
          t.balance -= take
          left -= take
        }
      }
    }
  }

  for (const p of myProfits) {
    applyUntil(endOfMonth(p.month))
    const total = tranches.reduce((s, t) => s + t.balance, 0)
    if (total <= 0) continue
    for (const t of tranches) {
      if (t.balance <= 0) continue
      t.profit += p.amount * (t.balance / total)
      t.months++
    }
  }

  // تطبيق ما تبقّى من سحوبات بعد آخر شهر ربح، ليصحّ الرصيد المعروض
  applyUntil('9999-12-31')

  return tranches.map(({ balance, ...t }) => ({
    ...t,
    remaining: balance,
    returnPct: t.amount > 0 ? (t.profit / t.amount) * 100 : 0,
    avgMonthlyPct: t.months > 0 && t.amount > 0 ? (t.profit / t.amount) * 100 / t.months : 0,
  }))
}

/* ────────────────────────── ملخص المستثمر ────────────────────────── */

export interface InvestorSummary {
  investor: Investor
  /** إجمالي ما أودعه منذ البداية */
  totalDeposited: number
  /** إجمالي ما سحبه من رأس المال */
  totalWithdrawn: number
  /** رأس المال الحالي = المودع − المسحوب */
  currentCapital: number
  /** إجمالي الأرباح المسجّلة منذ البداية */
  totalProfit: number
  /** الأرباح المصروفة فعلياً */
  paidProfit: number
  /** ما أُعيد استثماره من الأرباح فصار رأس مال */
  reinvestedProfit: number
  /** الأرباح المستحقة غير المصروفة ولا المُعاد استثمارها */
  unpaidProfit: number
  /** العائد التراكمي = إجمالي الأرباح ÷ رأس المال الحالي */
  lifetimeReturnPct: number
  /** عدد الأشهر التي سُجّل فيها ربح */
  activeMonths: number
  /** متوسط النسبة الشهرية */
  avgMonthlyPct: number
  firstProfitMonth: MonthKey | null
  lastProfitMonth: MonthKey | null
}

export function summarizeInvestor(
  investor: Investor,
  contributions: Contribution[],
  profits: ProfitEntry[],
): InvestorSummary {
  const mine = contributions.filter((c) => c.investorId === investor.id)
  const myProfits = profits
    .filter((p) => p.investorId === investor.id)
    .sort((a, b) => a.month.localeCompare(b.month))

  const totalDeposited = mine
    .filter((c) => c.type === 'deposit')
    .reduce((s, c) => s + c.amount, 0)
  const totalWithdrawn = mine
    .filter((c) => c.type === 'withdrawal')
    .reduce((s, c) => s + c.amount, 0)
  const currentCapital = totalDeposited - totalWithdrawn

  const totalProfit = myProfits.reduce((s, p) => s + p.amount, 0)
  const paidProfit = myProfits.filter((p) => p.paid).reduce((s, p) => s + p.amount, 0)

  /*
   * ربح أُعيد استثماره لم يعد مستحقاً: صار رأس مال. لولا خصمه هنا لظهر
   * المبلغ مرتين — مرة في رأس المال ومرة في المستحق — فتنتفخ القيمة
   * الإجمالية بمقداره. لا يتجاوز الخصم ما تبقّى غير مصروف.
   */
  const reinvestedProfit = Math.min(
    mine
      .filter((c) => c.type === 'deposit' && c.source === 'profit')
      .reduce((s, c) => s + c.amount, 0),
    Math.max(totalProfit - paidProfit, 0),
  )

  const monthlyPcts = myProfits.map((p) => {
    const cap = capitalAtMonthEnd(mine, p.month)
    return cap > 0 ? (p.amount / cap) * 100 : 0
  })
  const avgMonthlyPct =
    monthlyPcts.length > 0 ? monthlyPcts.reduce((s, v) => s + v, 0) / monthlyPcts.length : 0

  return {
    investor,
    totalDeposited,
    totalWithdrawn,
    currentCapital,
    totalProfit,
    paidProfit,
    reinvestedProfit,
    unpaidProfit: totalProfit - paidProfit - reinvestedProfit,
    lifetimeReturnPct: currentCapital > 0 ? (totalProfit / currentCapital) * 100 : 0,
    activeMonths: myProfits.length,
    avgMonthlyPct,
    firstProfitMonth: myProfits[0]?.month ?? null,
    lastProfitMonth: myProfits[myProfits.length - 1]?.month ?? null,
  }
}

/* ────────────────────────── تقرير الفترة ────────────────────────── */

export interface MonthRow {
  month: MonthKey
  /** رأس المال في نهاية الشهر */
  capital: number
  /** ربح الشهر */
  profit: number
  /** نسبة الربح الشهرية */
  pct: number
  paid: boolean
  note: string
  /** هل يوجد قيد ربح مسجّل لهذا الشهر */
  hasEntry: boolean
}

export interface PeriodReport {
  investor: Investor
  type: PeriodType
  year: number
  index: number
  label: string
  months: MonthRow[]
  /** حركات رأس المال داخل الفترة */
  movements: Contribution[]
  /** رأس المال في بداية الفترة */
  openingCapital: number
  /** رأس المال في نهاية الفترة */
  closingCapital: number
  /** متوسط رأس المال خلال الفترة (للأشهر ذات رأس مال فعلي) */
  averageCapital: number
  /** إجمالي أرباح الفترة */
  totalProfit: number
  /** المصروف من أرباح الفترة */
  paidProfit: number
  /** المستحق غير المصروف من أرباح الفترة */
  unpaidProfit: number
  /** نسبة عائد الفترة = إجمالي الربح ÷ متوسط رأس المال */
  returnPct: number
  /** العائد السنوي المكافئ */
  annualizedPct: number
  /** أعلى شهر ربحاً */
  bestMonth: MonthRow | null
  /** ملخص المستثمر التراكمي حتى تاريخه */
  lifetime: InvestorSummary
  /** تفصيل الدفعات الاستثمارية حتى نهاية الفترة */
  tranches: Tranche[]
}

export function buildPeriodReport(
  investor: Investor,
  allContributions: Contribution[],
  allProfits: ProfitEntry[],
  type: PeriodType,
  year: number,
  index: number,
): PeriodReport {
  const mine = allContributions.filter((c) => c.investorId === investor.id)
  const monthKeys = monthsOfPeriod(type, year, index)

  const rows: MonthRow[] = monthKeys.map((month) => {
    const entry = allProfits.find((p) => p.investorId === investor.id && p.month === month)
    const capital = capitalAtMonthEnd(mine, month)
    const profit = entry?.amount ?? 0
    return {
      month,
      capital,
      profit,
      pct: capital > 0 ? (profit / capital) * 100 : 0,
      paid: entry?.paid ?? false,
      note: entry?.note ?? '',
      hasEntry: Boolean(entry),
    }
  })

  const [fy, fm] = monthKeys[0].split('-').map(Number)
  const prev = new Date(Date.UTC(fy, fm - 2, 1))
  const prevMonth = `${prev.getUTCFullYear()}-${String(prev.getUTCMonth() + 1).padStart(2, '0')}`
  const openingCapital = capitalAsOf(mine, endOfMonth(prevMonth))
  const closingCapital = rows[rows.length - 1].capital

  const capitalized = rows.filter((r) => r.capital > 0)
  const averageCapital =
    capitalized.length > 0
      ? capitalized.reduce((s, r) => s + r.capital, 0) / capitalized.length
      : 0

  const totalProfit = rows.reduce((s, r) => s + r.profit, 0)
  const paidProfit = rows.filter((r) => r.paid).reduce((s, r) => s + r.profit, 0)
  const returnPct = averageCapital > 0 ? (totalProfit / averageCapital) * 100 : 0

  const withProfit = rows.filter((r) => r.hasEntry)
  const bestMonth =
    withProfit.length > 0
      ? withProfit.reduce((best, r) => (r.profit > best.profit ? r : best))
      : null

  const movements = mine
    .filter((c) => monthKeys.includes(monthKeyOf(c.date)))
    .sort((a, b) => a.date.localeCompare(b.date))

  return {
    investor,
    type,
    year,
    index,
    label: periodLabel(type, year, index),
    months: rows,
    movements,
    openingCapital,
    closingCapital,
    averageCapital,
    totalProfit,
    paidProfit,
    unpaidProfit: totalProfit - paidProfit,
    returnPct,
    annualizedPct: returnPct * annualizeFactor(type),
    bestMonth,
    lifetime: summarizeInvestor(investor, allContributions, allProfits),
    /*
     * محسوبة حتى آخر شهر في الفترة فقط: تقرير يوليو لا يحمل أرباح أغسطس.
     * الدفعات المودَعة بعد نهاية الفترة تُستبعد كي لا يظهر مال لم يعمل بعد.
     */
    tranches: trancheBreakdown(
      investor,
      allContributions.filter((c) => c.date <= endOfMonth(monthKeys[monthKeys.length - 1])),
      allProfits,
      monthKeys[monthKeys.length - 1],
    ),
  }
}

/* ────────────────────────── إحصاءات عامة ────────────────────────── */

export interface PortfolioStats {
  investorCount: number
  activeCount: number
  totalCapital: number
  totalProfitAllTime: number
  unpaidProfit: number
  avgReturnPct: number
  /** أرباح آخر 12 شهراً مرتبة زمنياً */
  monthlySeries: { month: MonthKey; profit: number; capital: number }[]
}

export function portfolioStats(
  investors: Investor[],
  contributions: Contribution[],
  profits: ProfitEntry[],
): PortfolioStats {
  const summaries = investors.map((i) => summarizeInvestor(i, contributions, profits))
  const totalCapital = summaries.reduce((s, x) => s + x.currentCapital, 0)
  const totalProfitAllTime = summaries.reduce((s, x) => s + x.totalProfit, 0)
  const unpaidProfit = summaries.reduce((s, x) => s + x.unpaidProfit, 0)

  const months = [...new Set(profits.map((p) => p.month))].sort().slice(-12)
  const monthlySeries = months.map((month) => ({
    month,
    profit: profits.filter((p) => p.month === month).reduce((s, p) => s + p.amount, 0),
    capital: capitalAtMonthEnd(contributions, month),
  }))

  return {
    investorCount: investors.length,
    activeCount: investors.filter((i) => i.active).length,
    totalCapital,
    totalProfitAllTime,
    unpaidProfit,
    avgReturnPct: totalCapital > 0 ? (totalProfitAllTime / totalCapital) * 100 : 0,
    monthlySeries,
  }
}

/* ────────────────────────── سلسلة الأداء للرسم البياني ────────────────────────── */

export interface SeriesPoint {
  month: MonthKey
  profit: number
  capital: number
  /** نسبة ربح الشهر */
  pct: number
  hasEntry: boolean
  /** هل الشهر ضمن فترة التقرير الحالية */
  inPeriod: boolean
}

/**
 * آخر `count` شهراً منتهية بآخر شهر في فترة التقرير — تُظهر للمستثمر
 * اتجاه العائد لا لقطة شهر واحد.
 */
export function performanceSeries(
  investor: Investor,
  allContributions: Contribution[],
  allProfits: ProfitEntry[],
  type: PeriodType,
  year: number,
  index: number,
  count = 12,
): SeriesPoint[] {
  const periodMonths = monthsOfPeriod(type, year, index)
  const last = periodMonths[periodMonths.length - 1]
  const [ly, lm] = last.split('-').map(Number)

  const mine = allContributions.filter((c) => c.investorId === investor.id)
  const points: SeriesPoint[] = []

  for (let back = count - 1; back >= 0; back--) {
    const d = new Date(Date.UTC(ly, lm - 1 - back, 1))
    const month = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
    const entry = allProfits.find((p) => p.investorId === investor.id && p.month === month)
    const capital = capitalAtMonthEnd(mine, month)
    const profit = entry?.amount ?? 0
    points.push({
      month,
      profit,
      capital,
      pct: capital > 0 ? (profit / capital) * 100 : 0,
      hasEntry: Boolean(entry),
      inPeriod: periodMonths.includes(month),
    })
  }

  // تُحذف الأشهر السابقة لأول رأس مال حتى لا يبدأ الرسم بفراغ طويل
  const firstActive = points.findIndex((p) => p.capital > 0)
  return firstActive > 0 ? points.slice(firstActive) : points
}
