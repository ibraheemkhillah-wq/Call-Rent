/**
 * أدوات التنسيق.
 *
 * الأرقام تبقى لاتينية في كل اللغات: هكذا تُكتب في المستندات المالية
 * العربية، وهو ما يجعل المبالغ مقروءة لمن يستلم التقرير بأي لغة.
 * أما أسماء الشهور وترتيب التاريخ فيتبعان لغة العرض.
 */

import { currentLang, dict } from '../i18n/current'

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

/** تحويل YYYY-MM إلى «مارس 2026» / «March 2026» / «Mart 2026» */
export function monthLabel(monthKey: string): string {
  const [y, m] = monthKey.split('-')
  const idx = Number(m) - 1
  if (idx < 0 || idx > 11) return monthKey
  return `${dict().months[idx]} ${y}`
}

/**
 * تحويل YYYY-MM-DD إلى تاريخ مقروء بترتيب اللغة:
 * «15 مارس 2026» • «March 15, 2026» • «15 Mart 2026»
 */
export function dateLabel(iso: string): string {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  const idx = Number(m) - 1
  if (idx < 0 || idx > 11) return iso
  const month = dict().months[idx]
  const day = Number(d)
  return currentLang() === 'en' ? `${month} ${day}, ${y}` : `${day} ${month} ${y}`
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
  if (parts.length === 0) return dict().common.unknown
  if (parts.length === 1) return parts[0].slice(0, 2)
  return parts[0][0] + parts[1][0]
}

/**
 * قراءة مبلغ كتبه المستخدم.
 *
 * لوحة المفاتيح التركية والعربية تكتب الفاصلة العشرية «،» أو «,» لا النقطة،
 * و«4287,50» في JavaScript يقرأ NaN فيُرفض المبلغ وهو صحيح. تُقبل هنا
 * الفاصلة والنقطة والأرقام العربية الهندية، وتُهمل فواصل الآلاف ورمز
 * العملة والمسافات. آخر فاصل في النص هو العشري إن تبعه ثلاث خانات أو أقل.
 *
 * تُرجع NaN لِما لا يمكن قراءته رقماً، ليبقى التحقق عند المُنادي.
 */
export function parseAmount(input: string): number {
  if (typeof input !== 'string') return Number(input)

  // الأرقام العربية الهندية والفارسية إلى اللاتينية
  let s = input.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))

  // كل ما ليس رقماً أو فاصلاً أو إشارة سالب يُهمل — رموز العملة والمسافات
  s = s.replace(/[٫٬⁦-⁩‎‏]/g, (c) => (c === '٫' ? '.' : c === '٬' ? ',' : ''))
  s = s.replace(/[^\d.,-]/g, '').trim()
  if (!s) return NaN

  const neg = s.startsWith('-')
  s = s.replace(/-/g, '')

  const lastDot = s.lastIndexOf('.')
  const lastComma = s.lastIndexOf(',')
  const lastSep = Math.max(lastDot, lastComma)

  if (lastSep === -1) {
    const n = Number(s)
    return neg ? -n : n
  }

  const tail = s.slice(lastSep + 1)
  const head = s.slice(0, lastSep).replace(/[.,]/g, '')

  /*
   * ثلاث خانات بعد آخر فاصل = فاصل آلاف: «20,000» عشرون ألفاً لا عشرون.
   * المبالغ المالية تُكتب بخانتين عشريتين، والتجميع بثلاث هو العرف.
   * يُستثنى ما رأسه صفر وحده — «0,500» نصف لا خمسمئة.
   */
  const isThousands = tail.length === 3 && head !== '0' && head !== ''
  const n = isThousands ? Number(head + tail) : Number(`${head}.${tail}`)
  if (!Number.isFinite(n)) return NaN
  return neg ? -n : n
}
