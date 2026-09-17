/**
 * رسم بياني مركّب لأداء المستثمر:
 *  • أعمدة = مبلغ الربح لكل شهر
 *  • خط ونقاط = نسبة العائد المئوية لكل شهر (مع قيمها مكتوبة)
 *
 * مرسوم بـ SVG لا بالصور، فيبقى حاداً عند أي تكبير أو طباعة.
 */

import type { SeriesPoint } from '../lib/calc'
import { LANG_DIR, currentLang, dict } from '../i18n/current'

const W = 1000
const H = 250
const PAD_T = 26
const PAD_B = 34
const PAD_X = 34

export function PerformanceChart({ points }: { points: SeriesPoint[] }) {
  if (points.length === 0) return null

  const plotH = H - PAD_T - PAD_B
  const step = (W - PAD_X * 2) / points.length
  const barW = Math.min(step * 0.46, 30)

  /*
   * المدى يضمّ الصفر دائماً.
   *
   * الشهر قد يخسر، فتنزل قيمته تحت الصفر. ولو قِيس المدى من أصغر قيمة
   * إلى أكبرها لتحرّك خط الأساس من رسمٍ إلى آخر، فتُقرأ خسارةٌ صعوداً.
   * بضمّ الصفر يبقى خط الأساس واحداً: ما فوقه ربح وما تحته خسارة.
   */
  const pcts = points.map((p) => p.pct)
  const pctLow = Math.min(0, ...pcts)
  const rawSpan = Math.max(Math.max(0, ...pcts) - pctLow, 1)
  /* متّسع أسفل أدنى نقطة سالبة، تُكتب فيه نسبتها فلا تركب أسماء الأشهر */
  const pctMin = pctLow < 0 ? pctLow - rawSpan * 0.18 : pctLow
  const pctSpan = Math.max(0, ...pcts) - pctMin || 1
  const yPctOf = (v: number) => PAD_T + plotH - ((v - pctMin) / pctSpan) * plotH

  const profits = points.map((p) => p.profit)
  const profMin = Math.min(0, ...profits)
  const profSpan = Math.max(Math.max(0, ...profits) - profMin, 1)
  const barArea = plotH * 0.82
  const yBarOf = (v: number) => PAD_T + plotH - ((v - profMin) / profSpan) * barArea
  const zeroY = yBarOf(0)

  /*
   * المحور الأفقي يتبع اتجاه القراءة: أقدم شهر عند بداية السطر.
   * فيُقرأ الزمن من اليمين لليسار في العربية، ومن اليسار لليمين في
   * الإنجليزية والتركية.
   */
  const rtl = LANG_DIR[currentLang()] === 'rtl'
  const x = (i: number) =>
    rtl ? W - PAD_X - step * (i + 0.5) : PAD_X + step * (i + 0.5)
  const line = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${yPctOf(p.pct).toFixed(1)}`)
    .join(' ')

  return (
    <svg
      className="doc-svg-chart"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      role="img"
      aria-label="أداء العائد الشهري"
    >
      {/* خطوط إرشادية أفقية */}
      {[0, 0.25, 0.5, 0.75, 1].map((f) => (
        <line
          key={f}
          x1={PAD_X}
          x2={W - PAD_X}
          y1={PAD_T + plotH * f}
          y2={PAD_T + plotH * f}
          stroke="#e3e8f1"
          strokeWidth={1}
        />
      ))}

      {/* خط الصفر — يظهر حين يوجد شهر خاسر */}
      {profMin < 0 && (
        <line
          x1={PAD_X}
          x2={W - PAD_X}
          y1={zeroY}
          y2={zeroY}
          stroke="#9aa5b8"
          strokeWidth={1.4}
        />
      )}

      {/* أعمدة مبلغ الربح — تنبت من خط الصفر صعوداً أو نزولاً */}
      {points.map((p, i) => {
        const end = yBarOf(p.profit)
        const loss = p.profit < 0
        return (
          <rect
            key={`b-${p.month}`}
            x={x(i) - barW / 2}
            y={Math.min(end, zeroY)}
            width={barW}
            height={Math.max(Math.abs(end - zeroY), 0)}
            rx={3}
            fill={loss ? (p.inPeriod ? '#a23b33' : '#e0b4b0') : p.inPeriod ? '#182b56' : '#c3cede'}
          />
        )
      })}

      {/* خط النسبة المئوية */}
      <path d={line} fill="none" stroke="#3e5c99" strokeWidth={2.4} strokeLinejoin="round" />

      {points.map((p, i) => {
        const tone = p.pct < 0 ? '#a23b33' : '#3e5c99'
        // نسبة الخسارة تُكتب تحت نقطتها، فلا تصطدم بالعمود النازل
        const labelY = p.pct < 0 ? yPctOf(p.pct) + 20 : yPctOf(p.pct) - 11
        return (
          <g key={`p-${p.month}`}>
            <circle cx={x(i)} cy={yPctOf(p.pct)} r={4.2} fill="#fff" stroke={tone} strokeWidth={2.2} />
            <text
              x={x(i)}
              y={labelY}
              textAnchor="middle"
              fontSize={15}
              fontWeight={700}
              fill={tone}
              /* الرقم لاتيني: إشارة السالب على يساره في كل اللغات */
              direction="ltr"
              /* هالة بيضاء تُبقي الرقم مقروءاً فوق عمودٍ نازل */
              stroke="#fff"
              strokeWidth={3.5}
              paintOrder="stroke"
            >
              {p.hasEntry ? `${p.pct.toFixed(2)}%` : '—'}
            </text>
          </g>
        )
      })}

      {/* أسماء الأشهر */}
      {points.map((p, i) => (
        <text
          key={`m-${p.month}`}
          x={x(i)}
          y={H - 14}
          textAnchor="middle"
          fontSize={15}
          fill={p.inPeriod ? '#182b56' : '#8a93a6'}
          fontWeight={p.inPeriod ? 600 : 400}
        >
          {dict().monthsShort[Number(p.month.slice(5)) - 1]}
        </text>
      ))}
    </svg>
  )
}
