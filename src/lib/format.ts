/** أدوات التنسيق — أرقام لاتينية مع نصوص عربية (المعتاد في المستندات المالية) */

export const AR_MONTHS = [
  'يناير',
  'فبراير',
  'مارس',
  'أبريل',
  'مايو',
  'يونيو',
  'يوليو',
  'أغسطس',
  'سبتمبر',
  'أكتوبر',
  'نوفمبر',
  'ديسمبر',
]

const numberFmt = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const intFmt = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })

/** مبلغ مالي مع رمز العملة، مثال: 12,500.00 $ */
export function money(value: number, symbol = '$'): string {
  const safe = Number.isFinite(value) ? value : 0
  return `${numberFmt.format(safe)} ${symbol}`.trim()
}

/** رقم بدون كسور */
export function count(value: number): string {
  return intFmt.format(Number.isFinite(value) ? value : 0)
}

/** نسبة مئوية، مثال: 4.25% */
export function percent(value: number, digits = 2): string {
  if (!Number.isFinite(value)) return '—'
  return `${value.toFixed(digits)}%`
}

/** تحويل YYYY-MM إلى «مارس 2026» */
export function monthLabel(monthKey: string): string {
  const [y, m] = monthKey.split('-')
  const idx = Number(m) - 1
  if (idx < 0 || idx > 11) return monthKey
  return `${AR_MONTHS[idx]} ${y}`
}

/** تحويل YYYY-MM-DD إلى «15 مارس 2026» */
export function dateLabel(iso: string): string {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  const idx = Number(m) - 1
  if (idx < 0 || idx > 11) return iso
  return `${Number(d)} ${AR_MONTHS[idx]} ${y}`
}

/** تاريخ اليوم بصيغة YYYY-MM-DD حسب التوقيت المحلي */
export function todayIso(): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

/** الشهر الحالي بصيغة YYYY-MM */
export function currentMonthKey(): string {
  return todayIso().slice(0, 7)
}

/** الأحرف الأولى من الاسم — للأفاتار */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '؟'
  if (parts.length === 1) return parts[0].slice(0, 2)
  return parts[0][0] + parts[1][0]
}
