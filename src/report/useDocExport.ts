/**
 * تصدير المستندات: معاينة وإرسال من التقاط واحد.
 *
 * المنطق هنا لا في الصفحات، لأن دقائقه ليست بديهية ولا تُنسَخ بأمان:
 * تحضير الملف مسبقاً حتى لا تسقط صفة «ناتج عن ضغطة» على الجوال، وإبقاء
 * المستند معروضاً لا مخفياً خارج الشاشة، وطريق احتياطي مضمون إن رفض
 * المتصفح المشاركة. صفحتان تستعملانه: تقرير المستثمر وتقرير المحفظة.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  canvasesToImages,
  downloadPdfFile,
  fileObjectUrl,
  pdfFileFromCanvases,
  renderDocCanvases,
  sharePdfFile,
} from '../lib/pdf'
import { useT } from '../i18n'

export interface DocExport {
  /** يُربَط بالحاوية التي تضمّ عناصر .doc */
  sourceRef: React.RefObject<HTMLDivElement>
  busy: '' | 'preview' | 'share'
  err: string
  pages: string[]
  fullscreen: boolean
  setFullscreen: (v: boolean) => void
  openPreview: () => Promise<void>
  shareDoc: () => Promise<void>
  /** رابط يفتحه المستخدم بنفسه إن رفض المتصفح المشاركة */
  manualUrl: string
}

export function useDocExport({
  fileName,
  /** أي تغيّر فيها يُبطل الالتقاط المحفوظ */
  deps,
  /** لا يُحضَّر شيء قبل وجود مستند */
  ready,
}: {
  fileName: string
  deps: unknown[]
  ready: boolean
}): DocExport {
  const t = useT()
  const r = t.reports

  const sourceRef = useRef<HTMLDivElement>(null)
  const canvasesRef = useRef<HTMLCanvasElement[]>([])
  const fileRef = useRef<File | null>(null)

  const [pages, setPages] = useState<string[]>([])
  const [fullscreen, setFullscreen] = useState(false)
  const [busy, setBusy] = useState<'' | 'preview' | 'share'>('')
  const [err, setErr] = useState('')
  const [manualUrl, setManualUrl] = useState('')

  /** أي تغيير في الاختيار أو البيانات يُبطل ما حُضِّر سابقاً */
  useEffect(() => {
    canvasesRef.current = []
    fileRef.current = null
    setPages([])
    setManualUrl((url) => {
      if (url) URL.revokeObjectURL(url)
      return ''
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  /** يُرجع الالتقاط المحفوظ، أو ينفّذه عند أول حاجة إليه */
  const ensureCanvases = useCallback(async (): Promise<HTMLCanvasElement[]> => {
    if (canvasesRef.current.length > 0) return canvasesRef.current
    const nodes = Array.from(sourceRef.current?.querySelectorAll<HTMLElement>('.doc') ?? [])
    if (nodes.length === 0) return []
    const canvases = await renderDocCanvases(nodes)
    canvasesRef.current = canvases
    setPages(canvasesToImages(canvases))
    return canvases
  }, [])

  /**
   * يُجهّز الملف ويحتفظ به جاهزاً للمشاركة الفورية.
   *
   * المتصفح لا يفتح قائمة المشاركة إلا إذا اعتبر النداء ناتجاً مباشرةً
   * عن ضغطة المستخدم، وهذه الصفة تسقط إن طال العمل بينهما — والتحضير
   * يستغرق ثواني. فبتحضيره مقدماً تصير المشاركة أول ما يحدث بعد الضغط.
   */
  const ensureFile = useCallback(async (): Promise<File | null> => {
    if (fileRef.current) return fileRef.current
    const canvases = await ensureCanvases()
    if (canvases.length === 0) return null
    const file = await pdfFileFromCanvases(canvases, fileName)
    fileRef.current = file
    return file
  }, [ensureCanvases, fileName])

  /* التحضير المسبق: يبدأ بهدوء بعد استقرار الاختيار */
  useEffect(() => {
    if (!ready) return
    const timer = window.setTimeout(() => {
      ensureFile().catch(() => {
        /* يُعاد المحاولة عند الضغط، وتُعرض الرسالة حينها */
      })
    }, 700)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, ready])

  const openPreview = useCallback(async () => {
    setBusy('preview')
    setErr('')
    try {
      const canvases = await ensureCanvases()
      if (canvases.length > 0) setFullscreen(true)
    } catch (e) {
      setErr(r.previewFailed((e as Error).message))
    } finally {
      setBusy('')
    }
  }, [ensureCanvases, r])

  /**
   * الإرسال: قائمة مشاركة النظام أولاً (واتساب، بريد، أي تطبيق).
   *
   * وإن رفضها المتصفح — لأن الصفحة داخل إطار لا يملك إذن المشاركة، أو
   * لأن التحضير لم يكن جاهزاً فسقطت صفة «ناتج عن ضغطة» — يُنزَّل الملف،
   * ويُعرض فوق ذلك رابط ظاهر يفتحه المستخدم بنفسه. الضغط على الرابط
   * ضغطة مباشرة لا يرفضها متصفح، فيبقى طريق واحد مضمون دائماً.
   */
  const shareDoc = useCallback(async () => {
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
      setErr(outcome === 'unsupported' ? r.shareUnsupported : r.shareBlocked)
    } catch (e) {
      setErr(r.prepareFailed((e as Error).message))
    } finally {
      setBusy('')
    }
  }, [ensureFile, r])

  return {
    sourceRef,
    busy,
    err,
    pages,
    fullscreen,
    setFullscreen,
    openPreview,
    shareDoc,
    manualUrl,
  }
}
