/**
 * صفحة تقرير المحفظة — اختيار الفترة، ثم معاينة أو إرسال.
 *
 * آلة التصدير مشتركة مع تقرير المستثمر عبر useDocExport، فما يُعاين هو
 * حرفياً ما يُرسَل، ولا يوجد مسار ثانٍ يمكن أن ينحرف عن الأول.
 */

import { useEffect, useMemo, useState } from 'react'
import { useStore } from '../store'
import {
  buildPortfolioReport,
  periodCount,
  periodLabel,
  periodNames,
  portfolioSeries,
} from '../lib/calc'
import { safeFileName } from '../lib/pdf'
import type { PeriodType } from '../types'
import { Empty, Field } from '../components/ui'
import { IconClose, IconDoc, IconEye, IconShare } from '../components/Icons'
import { PortfolioDoc } from '../report/PortfolioDoc'
import { useDocExport } from '../report/useDocExport'
import { useT } from '../i18n'

const TYPES: PeriodType[] = ['monthly', 'quarterly', 'semiannual', 'annual']

const NOW = new Date()
const THIS_YEAR = NOW.getFullYear()
const THIS_MONTH = NOW.getMonth() + 1

export function Portfolio() {
  const { db } = useStore()
  const t = useT()
  const d = t.pdoc
  const r = t.reports

  const [type, setType] = useState<PeriodType>('monthly')
  const [year, setYear] = useState(THIS_YEAR)
  const [index, setIndex] = useState(THIS_MONTH)

  /** إعادة ضبط رقم الفترة عند تغيير نوعها حتى لا يخرج عن المدى */
  useEffect(() => {
    setIndex((cur) => Math.min(cur, periodCount(type)))
  }, [type])

  const years = useMemo(() => {
    const fromData = db.profits.map((p) => Number(p.month.slice(0, 4)))
    const min = Math.min(THIS_YEAR - 2, ...(fromData.length ? fromData : [THIS_YEAR]))
    const list: number[] = []
    for (let y = THIS_YEAR + 1; y >= min; y--) list.push(y)
    return list
  }, [db.profits])

  const report = useMemo(
    () => buildPortfolioReport(db.investors, db.contributions, db.profits, type, year, index),
    [db.investors, db.contributions, db.profits, type, year, index],
  )

  const series = useMemo(
    () => portfolioSeries(db.contributions, db.profits, type, year, index),
    [db.contributions, db.profits, type, year, index],
  )

  const fileName = safeFileName([d.fileNamePrefix, periodLabel(type, year, index)])

  const ex = useDocExport({
    fileName,
    deps: [report, series, db.settings],
    ready: db.investors.length > 0,
  })

  const actions = (
    <>
      <button className="btn btn-primary" onClick={ex.shareDoc} disabled={Boolean(ex.busy)}>
        <IconShare className="btn-icon" />
        {ex.busy === 'share' ? r.preparing : r.send}
      </button>
      <button className="btn" onClick={ex.openPreview} disabled={Boolean(ex.busy)}>
        <IconEye className="btn-icon" />
        {ex.busy === 'preview' ? r.previewing : r.preview}
      </button>
    </>
  )

  if (db.investors.length === 0) {
    return (
      <>
        <div className="page-head">
          <div>
            <h1>{d.title}</h1>
            <p>{d.subtitle}</p>
          </div>
        </div>
        <div className="card">
          <Empty icon={<IconDoc size={26} />} title={r.emptyTitle} text={r.emptyText} />
        </div>
      </>
    )
  }

  return (
    <>
      <div className="page-head no-print">
        <div>
          <h1>{d.title}</h1>
          <p>{d.subtitle}</p>
        </div>
        <div className="head-actions">{actions}</div>
      </div>

      <div className="card no-print" style={{ marginBottom: 22 }}>
        <div className="toolbar" style={{ marginBottom: 0 }}>
          <Field label={r.type}>
            <select value={type} onChange={(e) => setType(e.target.value as PeriodType)}>
              {TYPES.map((x) => (
                <option key={x} value={x}>
                  {periodNames()[x]}
                </option>
              ))}
            </select>
          </Field>

          <Field label={r.year}>
            <select value={year} onChange={(e) => setYear(Number(e.target.value))}>
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </Field>

          {type !== 'annual' && (
            <Field label={r.period}>
              <select value={index} onChange={(e) => setIndex(Number(e.target.value))}>
                {Array.from({ length: periodCount(type) }, (_, i) => i + 1).map((i) => (
                  <option key={i} value={i}>
                    {periodLabel(type, year, i)}
                  </option>
                ))}
              </select>
            </Field>
          )}

          <div className="spacer" />
          {actions}
        </div>

        <div className="divider" />
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>
          {d.subtitle}
        </p>
        {ex.err && (
          <p className="neg" style={{ margin: '10px 0 0', fontSize: 13 }}>
            {ex.err}
          </p>
        )}
        {ex.manualUrl && (
          <p style={{ margin: '10px 0 0' }}>
            <a
              className="btn btn-primary"
              href={ex.manualUrl}
              target="_blank"
              rel="noreferrer"
              download={fileName}
            >
              {r.openFile}
            </a>
          </p>
        )}
      </div>

      {/* المستند معروض على الشاشة، ومنه يُلتقط الملف وصورة المعاينة معاً */}
      <div className="report-shell print-area" ref={ex.sourceRef}>
        <PortfolioDoc report={report} series={series} settings={db.settings} />
      </div>

      {ex.fullscreen && ex.pages.length > 0 && (
        <div className="preview-full" onClick={() => ex.setFullscreen(false)}>
          <button
            className="icon-btn preview-full-close"
            onClick={() => ex.setFullscreen(false)}
            aria-label={r.closePreview}
          >
            <IconClose />
          </button>
          {ex.pages.map((src, i) => (
            <img key={i} src={src} alt={r.previewPage(i + 1)} />
          ))}
        </div>
      )}
    </>
  )
}
