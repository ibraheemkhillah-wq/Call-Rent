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
  Investor,
  MonthKey,
  PeriodType,
  ProfitEntry,
} from '../types'
import { AR_MONTHS } from './format'

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
  switch (type) {
    case 'monthly':
      return `${AR_MONTHS[index - 1]} ${year}`
    case 'quarterly':
      return `الربع ${['الأول', 'الثاني', 'الثالث', 'الرابع'][index - 1]} ${year}`
    case 'semiannual':
      return `النصف ${['الأول', 'الثاني'][index - 1]} ${year}`
    case 'annual':
      return `السنة المالية ${year}`
  }
}

export const PERIOD_NAMES: Record<PeriodType, string> = {
  monthly: 'شهري',
  quarterly: 'ربع سنوي',
  semiannual: 'نصف سنوي',
  annual: 'سنوي',
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
  /** الأرباح المستحقة غير المصروفة */
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
    unpaidProfit: totalProfit - paidProfit,
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
