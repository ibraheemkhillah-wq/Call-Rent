import { useEffect, useMemo, useState } from 'react'
import { useStore } from '../store'
import {
  PERIOD_NAMES,
  buildPeriodReport,
  periodCount,
  periodLabel,
} from '../lib/calc'
import type { PeriodType } from '../types'
import { Empty, Field } from '../components/ui'
import { IconDoc, IconPrint } from '../components/Icons'
import { ReportDoc } from '../report/ReportDoc'

const TYPES: PeriodType[] = ['monthly', 'quarterly', 'semiannual', 'annual']

const NOW = new Date()
const THIS_YEAR = NOW.getFullYear()
const THIS_MONTH = NOW.getMonth() + 1

export function Reports({ initialInvestorId }: { initialInvestorId?: string }) {
  const { db } = useStore()

  const [investorId, setInvestorId] = useState<string>(initialInvestorId ?? 'all')
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

  const targets = useMemo(
    () =>
      investorId === 'all'
        ? db.investors
        : db.investors.filter((i) => i.id === investorId),
    [db.investors, investorId],
  )

  const reports = useMemo(
    () =>
      targets.map((inv) =>
        buildPeriodReport(inv, db.contributions, db.profits, type, year, index),
      ),
    [targets, db.contributions, db.profits, type, year, index],
  )

  if (db.investors.length === 0) {
    return (
      <>
        <div className="page-head">
          <div>
            <h1>التقارير</h1>
            <p>تقارير شهرية وربع سنوية ونصف سنوية وسنوية بصيغة PDF</p>
          </div>
        </div>
        <div className="card">
          <Empty
            icon={<IconDoc size={26} />}
            title="لا توجد بيانات لإصدار تقارير"
            text="أضف مستثمرين وسجّل أرباحهم الشهرية أولاً."
          />
        </div>
      </>
    )
  }

  return (
    <>
      <div className="page-head no-print">
        <div>
          <h1>التقارير</h1>
          <p>اختر المستثمر ونوع الفترة ثم صدّر التقرير بصيغة PDF</p>
        </div>
        <div className="head-actions">
          <button className="btn btn-primary" onClick={() => window.print()}>
            <IconPrint className="btn-icon" />
            تصدير PDF / طباعة
          </button>
        </div>
      </div>

      <div className="card no-print" style={{ marginBottom: 22 }}>
        <div className="toolbar" style={{ marginBottom: 0 }}>
          <Field label="المستثمر">
            <select value={investorId} onChange={(e) => setInvestorId(e.target.value)}>
              <option value="all">جميع المستثمرين ({db.investors.length})</option>
              {db.investors.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="نوع التقرير">
            <select value={type} onChange={(e) => setType(e.target.value as PeriodType)}>
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {PERIOD_NAMES[t]}
                </option>
              ))}
            </select>
          </Field>

          <Field label="السنة">
            <select value={year} onChange={(e) => setYear(Number(e.target.value))}>
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </Field>

          {type !== 'annual' && (
            <Field label="الفترة">
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
          <button className="btn btn-primary" onClick={() => window.print()}>
            <IconPrint className="btn-icon" />
            تصدير PDF
          </button>
        </div>

        <div className="divider" />
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>
          <strong className="accent">طريقة الحفظ كـ PDF:</strong> اضغط «تصدير PDF»، ثم من نافذة
          الطباعة اختر الوجهة <strong>«حفظ كـ PDF» / Save as PDF</strong>، واضبط الهوامش على
          «بلا / None» وفعّل خيار <strong>«طباعة الخلفيات» / Background graphics</strong> للحصول
          على التصميم كاملاً.
          {investorId === 'all' &&
            ' — عند اختيار «جميع المستثمرين» يصدر التقرير في ملف واحد، صفحة مستقلة لكل مستثمر.'}
        </p>
      </div>

      <div className="report-shell print-area">
        {reports.map((r) => (
          <ReportDoc key={r.investor.id} report={r} settings={db.settings} />
        ))}
      </div>
    </>
  )
}
