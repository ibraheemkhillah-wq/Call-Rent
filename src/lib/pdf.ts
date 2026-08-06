/**
 * توليد التقرير كصورة ثم كملف PDF — من داخل التطبيق مباشرة.
 *
 * لماذا لا نعتمد على نافذة طباعة المتصفح: فهي تضيف ترويسة وتذييلاً
 * خاصين بها (رابط الموقع، التاريخ، رقم الصفحة) وتفرض هوامش تقصّ أطراف
 * المستند — ولا يمكن التحكم بذلك من CSS.
 *
 * ولماذا `html-to-image` تحديداً: هي تلتقط العنصر عبر SVG foreignObject،
 * أي أن المتصفح نفسه هو من يرسم النص — فيبقى تشكيل الحروف العربية
 * ووصلها واتجاهها سليماً تماماً. المكتبات التي تعيد رسم النص بنفسها
 * (مثل html2canvas) تكسر وصل الحروف العربية في العناوين والجداول.
 *
 * ◆ مبدأ أساسي: المعاينة داخل التطبيق والملف المُرسَل يخرجان من
 *   نفس الالتقاط (نفس الـ canvas). ما تراه في المعاينة هو حرفياً
 *   ما يصل إلى المستثمر — لا فرق ولو بكسل واحد.
 */

import jsPDF from 'jspdf'
import { toCanvas } from 'html-to-image'

/** أبعاد A4 بالمليمتر */
const A4_W = 210
const A4_H = 297

/**
 * يلتقط صفحات التقرير كـ canvas واحد لكل صفحة.
 * هذه هي النقطة الوحيدة التي يُرسم فيها المستند؛ كل ما بعدها
 * (معاينة أو PDF) مشتقّ من نتيجتها.
 */
export async function renderDocCanvases(nodes: HTMLElement[]): Promise<HTMLCanvasElement[]> {
  // انتظار اكتمال تحميل الخطوط حتى لا يُلتقط المستند بخط بديل
  await document.fonts?.ready

  const out: HTMLCanvasElement[] = []
  for (const node of nodes) {
    out.push(
      await toCanvas(node, {
        pixelRatio: 2, // دقة مضاعفة لوضوح النص عند الطباعة
        backgroundColor: '#ffffff',
        width: node.offsetWidth,
        height: node.offsetHeight,
        /**
         * المستند قد يحمل هامشاً أو ظلاً في التخطيط، وهما يُحتسبان داخل
         * الالتقاط فتخرج الصفحة مزاحة ومقصوصة من الجانب. تصفيرهما هنا
         * يضمن التقاط الصفحة وحدها بحوافّها الصحيحة.
         */
        style: { margin: '0', boxShadow: 'none' },
      }),
    )
  }
  return out
}

/** صور المعاينة — نفس الالتقاط المستخدم في الملف المُرسَل */
export function canvasesToImages(canvases: HTMLCanvasElement[]): string[] {
  return canvases.map((c) => c.toDataURL('image/jpeg', 0.94))
}

/** يجمّع الصفحات الملتقطة في ملف PDF بحجم A4 */
export function pdfBlobFromCanvases(canvases: HTMLCanvasElement[]): Blob | null {
  if (canvases.length === 0) return null

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  canvases.forEach((canvas, i) => {
    // ملاءمة الصفحة: يُصغَّر المستند إن تجاوز A4 ليبقى في صفحة واحدة
    const scale = Math.min(A4_W / canvas.width, A4_H / canvas.height)
    const w = canvas.width * scale
    const h = canvas.height * scale

    if (i > 0) pdf.addPage()
    pdf.addImage(
      canvas.toDataURL('image/jpeg', 0.94),
      'JPEG',
      (A4_W - w) / 2,
      (A4_H - h) / 2,
      w,
      h,
      undefined,
      'FAST',
    )
  })

  return pdf.output('blob')
}

export function pdfFileFromCanvases(
  canvases: HTMLCanvasElement[],
  filename: string,
): File | null {
  const blob = pdfBlobFromCanvases(canvases)
  return blob ? new File([blob], filename, { type: 'application/pdf' }) : null
}

/**
 * مشاركة التقرير مباشرة (واتساب، بريد، أي تطبيق) عبر واجهة المشاركة
 * في نظام التشغيل. هذا الطريق الصحيح على الجوال: يصل الملف كما هو
 * تماماً، بلا هوامش طباعة ولا قصّ ولا صفحات زائدة.
 *
 * تُرجع false إن كان الجهاز لا يدعم مشاركة الملفات، فيتولّى المُنادي
 * التنزيل بدلاً منها.
 */
export async function sharePdfFile(file: File): Promise<boolean> {
  const nav = navigator as Navigator & {
    canShare?: (data: ShareData) => boolean
    share?: (data: ShareData) => Promise<void>
  }
  if (!nav.share || !nav.canShare?.({ files: [file] })) return false

  try {
    /*
     * يُرسَل الملف وحده بلا title أو text: إضافتهما تجعل واتساب يحاول
     * إرسال رسالة نصية مع الملف، وهو ما كان يفشل بالرسالة
     * «تعذّر إرسال الرسالة». الملف وحده يصل دائماً.
     */
    await nav.share({ files: [file] })
    return true
  } catch (err) {
    // إلغاء المستخدم للمشاركة ليس خطأ
    if ((err as Error)?.name === 'AbortError') return true
    return false
  }
}

/** تنزيل ملف PDF يدوياً — لضمان بقاء اسم الملف العربي كما هو */
export function downloadPdfFile(file: File): void {
  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url
  a.download = file.name
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

/**
 * اسم ملف صالح للمشاركة: تُزال المحارف التي ترفضها أنظمة الملفات،
 * وتُستبدل المسافات بشرطات لأن بعض تطبيقات المراسلة تفشل في إرسال
 * ملف يحمل مسافات مع نص عربي.
 */
export function safeFileName(parts: string[]): string {
  const name = parts
    .join('-')
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  return `${name || 'تقرير'}.pdf`
}
