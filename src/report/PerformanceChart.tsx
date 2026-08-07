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

  const maxPct = Math.max(...points.map((p) => p.pct), 1)
  const maxProfit = Math.max(...points.map((p) => p.profit), 1)
  const plotH = H - PAD_T - PAD_B
  const step = (W - PAD_X * 2) / points.length
  const barW = Math.min(step * 0.46, 30)

  /*
   * المحور الأفقي يتبع اتجاه القراءة: أقدم شهر عند بداية السطر.
   * فيُقرأ الزمن من اليمين لليسار في العربية، ومن اليسار لليمين في
   * الإنجليزية والتركية.
   */
  const rtl = LANG_DIR[currentLang()] === 'rtl'
  const x = (i: number) =>
    rtl ? W - PAD_X - step * (i + 0.5) : PAD_X + step * (i + 0.5)
  const yPct = (v: number) => PAD_T + plotH - (v / maxPct) * plotH
  const yBar = (v: number) => PAD_T + plotH - (v / maxProfit) * plotH * 0.82

  const line = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${yPct(p.pct).toFixed(1)}`)
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

      {/* أعمدة مبلغ الربح */}
      {points.map((p, i) => {
        const top = yBar(p.profit)
        return (
          <rect
            key={`b-${p.month}`}
            x={x(i) - barW / 2}
            y={top}
            width={barW}
            height={Math.max(PAD_T + plotH - top, 0)}
            rx={3}
            fill={p.inPeriod ? '#182b56' : '#c3cede'}
          />
        )
      })}

      {/* خط النسبة المئوية */}
      <path d={line} fill="none" stroke="#3e5c99" strokeWidth={2.4} strokeLinejoin="round" />

      {points.map((p, i) => (
        <g key={`p-${p.month}`}>
          <circle cx={x(i)} cy={yPct(p.pct)} r={4.2} fill="#fff" stroke="#3e5c99" strokeWidth={2.2} />
          <text
            x={x(i)}
            y={yPct(p.pct) - 11}
            textAnchor="middle"
            fontSize={15}
            fontWeight={700}
            fill="#3e5c99"
          >
            {p.hasEntry ? `${p.pct.toFixed(2)}%` : '—'}
          </text>
        </g>
      ))}

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
