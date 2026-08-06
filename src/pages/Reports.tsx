import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../store'
import {
  PERIOD_NAMES,
  buildPeriodReport,
  performanceSeries,
  periodCount,
  periodLabel,
} from '../lib/calc'
import {
  canvasesToImages,
  downloadPdfFile,
  fileObjectUrl,
  pdfFileFromCanvases,
  renderDocCanvases,
  safeFileName,
  sharePdfFile,
} from '../lib/pdf'
import type { PeriodType } from '../types'
import { Empty, Field } from '../components/ui'
import { IconClose, IconDoc, IconEye, IconShare } from '../components/Icons'
import { ReportDoc } from '../report/ReportDoc'
import { BUILD_ID } from '../lib/pwa'

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
      targets.map((inv) => ({
        report: buildPeriodReport(inv, db.contributions, db.profits, type, year, index),
        series: performanceSeries(inv, db.contributions, db.profits, type, year, index),
      })),
    [targets, db.contributions, db.profits, type, year, index],
  )

  const sourceRef = useRef<HTMLDivElement>(null)
  const [busy, setBusy] = useState<'' | 'preview' | 'share'>('')
  const [err, setErr] = useState('')

  /**
   * ◆ «معاينة» وملف الإرسال مصدرهما التقاط واحد.
   *
   * المستند معروض على الشاشة، ويُلتقط مرة واحدة إلى canvas لكل صفحة؛
   * من هذا الالتقاط نفسه تُشتقّ صورة المعاينة وملف الـ PDF معاً، فما
   * تراه في المعاينة هو حرفياً ما يصل إلى المستثمر.
   *
   * والمستند يبقى معروضاً ولا يُخفى خارج الشاشة: Safari على الجوال لا
   * يفكّ ترميز الصور المقصوصة كلياً، فيخرج الالتقاط بلا شعار ولا توقيع.
   */
  const canvasesRef = useRef<HTMLCanvasElement[]>([])
  const [pages, setPages] = useState<string[]>([])
  const [fullscreen, setFullscreen] = useState(false)

  /**
   * ملف التقرير يُحضَّر مسبقاً، لا عند الضغط على «إرسال».
   *
   * السبب: المتصفح لا يفتح قائمة المشاركة إلا إذا اعتبر النداء ناتجاً
   * مباشرةً عن ضغطة المستخدم، وهذه الصفة تسقط إن طال العمل بينهما —
   * وتحضير التقرير يستغرق ثواني. فكان الزر لا يفعل شيئاً على الجوال.
   * بتحضيره مقدماً تصير المشاركة أول ما يحدث بعد الضغط.
   */
  const fileRef = useRef<File | null>(null)
  const [manualUrl, setManualUrl] = useState('')

  const fileName = safeFileName([
    'تقرير',
    investorId === 'all'
      ? 'جميع-المستثمرين'
      : (db.investors.find((i) => i.id === investorId)?.name ?? 'مستثمر'),
    periodLabel(type, year, index),
  ])

  /** أي تغيير في الاختيار أو البيانات يُبطل ما حُضِّر سابقاً */
  useEffect(() => {
    canvasesRef.current = []
    fileRef.current = null
    setPages([])
    setManualUrl((url) => {
      if (url) URL.revokeObjectURL(url)
      return ''
    })
  }, [reports, db.settings])

  /** يُرجع الالتقاط المحفوظ، أو ينفّذه عند أول حاجة إليه */
  async function ensureCanvases(): Promise<HTMLCanvasElement[]> {
    if (canvasesRef.current.length > 0) return canvasesRef.current
    const nodes = Array.from(sourceRef.current?.querySelectorAll<HTMLElement>('.doc') ?? [])
    if (nodes.length === 0) return []
    const canvases = await renderDocCanvases(nodes)
    canvasesRef.current = canvases
    setPages(canvasesToImages(canvases))
    return canvases
  }

  /** يُجهّز ملف التقرير ويحتفظ به جاهزاً للمشاركة الفورية */
  async function ensureFile(): Promise<File | null> {
    if (fileRef.current) return fileRef.current
    const canvases = await ensureCanvases()
    if (canvases.length === 0) return null
    const file = await pdfFileFromCanvases(canvases, fileName)
    fileRef.current = file
    return file
  }

  /* التحضير المسبق: يبدأ بهدوء بعد استقرار الاختيار */
  useEffect(() => {
    if (reports.length === 0) return
    let cancelled = false
    const timer = window.setTimeout(() => {
      ensureFile().catch(() => {
        /* يُعاد المحاولة عند الضغط، وتُعرض الرسالة حينها */
      })
      if (cancelled) return
    }, 700)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reports, db.settings])

  async function openPreview() {
    setBusy('preview')
    setErr('')
    try {
      const canvases = await ensureCanvases()
      if (canvases.length > 0) setFullscreen(true)
    } catch (e) {
      setErr(`تعذّر عرض المعاينة: ${(e as Error).message}`)
    } finally {
      setBusy('')
    }
  }

  /**
   * الإرسال: قائمة مشاركة النظام أولاً (واتساب، بريد، أي تطبيق).
   *
   * وإن رفضها المتصفح — لأن الصفحة داخل إطار لا يملك إذن المشاركة، أو
   * لأن التحضير لم يكن جاهزاً فسقطت صفة «ناتج عن ضغطة» — يُنزَّل الملف،
   * ويُعرض فوق ذلك رابط ظاهر يفتحه المستخدم بنفسه. الضغط على الرابط
   * ضغطة مباشرة لا يرفضها متصفح، فيبقى طريق واحد مضمون دائماً.
   */
  async function shareReport() {
    setErr('')
    setBusy('share')
    try {
      const file = await ensureFile()
      if (!file) return

      const outcome = await sharePdfFile(file)
      if (outcome === 'shared' || outcome === 'cancelled') return

      downloadPdfFile(file)
      setManualUrl((old) => {
        if (old) URL.revokeObjectURL(old)
        return fileObjectUrl(file)
      })
      setErr(
        outcome === 'unsupported'
          ? 'هذا المتصفح لا يفتح قائمة المشاركة. نُزّل الملف — أو افتحه من الرابط أدناه ثم أرسله من زر المشاركة.'
          : 'المتصفح لم يسمح بفتح قائمة المشاركة هذه المرة. اضغط الرابط أدناه لفتح الملف ثم أرسله من زر المشاركة.',
      )
    } catch (e) {
      setErr(`تعذّر تجهيز الملف: ${(e as Error).message}`)
    } finally {
      setBusy('')
    }
  }

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
          <p>
            اختر المستثمر ونوع الفترة ثم عاين التقرير وأرسله بصيغة PDF
            {/* رقم النسخة ظاهر هنا عمداً: يكشف فوراً ما إن كان الجهاز
                يعرض آخر إصدار أم نسخة قديمة عالقة في ذاكرة التطبيق */}
            <span className="build-tag">نسخة {BUILD_ID}</span>
          </p>
        </div>
        <div className="head-actions">
          <button className="btn btn-primary" onClick={shareReport} disabled={Boolean(busy)}>
            <IconShare className="btn-icon" />
            {busy === 'share' ? 'جارٍ التحضير…' : 'إرسال التقرير'}
          </button>
          <button className="btn" onClick={openPreview} disabled={Boolean(busy)}>
            <IconEye className="btn-icon" />
            {busy === 'preview' ? 'جارٍ التجهيز…' : 'معاينة'}
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
          <button className="btn btn-primary" onClick={shareReport} disabled={Boolean(busy)}>
            <IconShare className="btn-icon" />
            {busy === 'share' ? 'جارٍ التحضير…' : 'إرسال التقرير'}
          </button>
          <button className="btn" onClick={openPreview} disabled={Boolean(busy)}>
            <IconEye className="btn-icon" />
            {busy === 'preview' ? 'جارٍ التجهيز…' : 'معاينة'}
          </button>
        </div>

        <div className="divider" />
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>
          <strong className="accent">«معاينة»</strong> تفتح التقرير بملء الشاشة كما هو
          تماماً — الصورة المعروضة مأخوذة من نفس الملف الذي يُرسَل، فما تراه هنا هو ما
          يصل للمستثمر بالضبط.{' '}
          <strong className="accent">«إرسال التقرير»</strong> يحوّل المعاينة نفسها إلى
          ملف PDF ثم يفتح قائمة المشاركة لتختار واتساب أو البريد مباشرة — بلا هوامش أو
          روابط أو أرقام صفحات.
          {' '}(على الأجهزة التي لا تدعم المشاركة يُنزَّل الملف بدلاً منها.)
          {investorId === 'all' &&
            ' عند اختيار «جميع المستثمرين» يخرج ملف واحد، صفحة مستقلة لكل مستثمر.'}
        </p>
        <p className="muted" style={{ margin: '8px 0 0', fontSize: 12.5 }}>
          ⚠️ <strong>لا تستخدم «مشاركة ← طباعة» من المتصفح</strong> لإرسال التقرير: نافذة
          الطباعة تضيف رابط الموقع وتاريخاً وأرقام صفحات، وتفرض هوامش تقصّ أطراف التقرير
          وتقسّمه على عدة صفحات — ولا يمكن إلغاء ذلك من داخل التطبيق.
        </p>
        {err && (
          <p className="neg" style={{ margin: '10px 0 0', fontSize: 13 }}>
            {err}
          </p>
        )}
        {manualUrl && (
          <p style={{ margin: '10px 0 0' }}>
            <a
              className="btn btn-primary"
              href={manualUrl}
              target="_blank"
              rel="noreferrer"
              download={fileName}
            >
              فتح ملف التقرير
            </a>
          </p>
        )}
      </div>

      {/*
       * المستند — معروض على الشاشة، ومنه يُلتقط ملف الـ PDF وصورة
       * المعاينة معاً. لا تُخفِه خارج الشاشة: Safari على الجوال لا يفكّ
       * ترميز الصور المقصوصة كلياً فيخرج الالتقاط بلا شعار ولا توقيع.
       */}
      <div className="report-shell print-area" ref={sourceRef}>
        {reports.map(({ report, series }) => (
          <ReportDoc
            key={report.investor.id}
            report={report}
            series={series}
            settings={db.settings}
          />
        ))}
      </div>

      {fullscreen && pages.length > 0 && (
        <div className="preview-full" onClick={() => setFullscreen(false)}>
          <button
            className="icon-btn preview-full-close"
            onClick={() => setFullscreen(false)}
            aria-label="إغلاق المعاينة"
          >
            <IconClose />
          </button>
          {pages.map((src, i) => (
            <img key={i} src={src} alt={`التقرير — صفحة ${i + 1}`} />
          ))}
        </div>
      )}
    </>
  )
}
