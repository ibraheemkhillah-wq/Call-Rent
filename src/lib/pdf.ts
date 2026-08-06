/**
 * توليد ملف PDF من داخل التطبيق مباشرة.
 *
 * لماذا لا نعتمد على نافذة طباعة المتصفح: فهي تضيف ترويسة وتذييلاً
 * خاصين بها (رابط الموقع، التاريخ، رقم الصفحة) وتفرض هوامش تقصّ أطراف
 * المستند — ولا يمكن التحكم بذلك من CSS.
 *
 * ولماذا `html-to-image` تحديداً: هي تلتقط العنصر عبر SVG foreignObject،
 * أي أن المتصفح نفسه هو من يرسم النص — فيبقى تشكيل الحروف العربية
 * ووصلها واتجاهها سليماً تماماً. المكتبات التي تعيد رسم النص بنفسها
 * (مثل html2canvas) تكسر وصل الحروف العربية في العناوين والجداول.
 */

import jsPDF from 'jspdf'
import { toCanvas } from 'html-to-image'

/** أبعاد A4 بالمليمتر */
const A4_W = 210
const A4_H = 297

/** ينشئ ملف PDF في الذاكرة دون تنزيله */
export async function buildPdfFile(
  nodes: HTMLElement[],
  filename: string,
): Promise<File | null> {
  const blob = await renderPdfBlob(nodes)
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
export async function sharePdf(nodes: HTMLElement[], filename: string): Promise<boolean> {
  const file = await buildPdfFile(nodes, filename)
  if (!file) return false

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

export async function exportDocsToPdf(nodes: HTMLElement[], filename: string): Promise<void> {
  const blob = await renderPdfBlob(nodes)
  if (!blob) return

  // تنزيل يدوي بدل pdf.save() لضمان بقاء اسم الملف العربي كما هو
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

async function renderPdfBlob(nodes: HTMLElement[]): Promise<Blob | null> {
  if (nodes.length === 0) return null

  // انتظار اكتمال تحميل الخطوط حتى لا يُلتقط المستند بخط بديل
  await document.fonts?.ready

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i]
    const canvas = await toCanvas(node, {
      pixelRatio: 2, // دقة مضاعفة لوضوح النص عند الطباعة
      backgroundColor: '#ffffff',
      width: node.offsetWidth,
      height: node.offsetHeight,
      /**
       * المستند معروض على الشاشة بـ margin:0 auto ليتوسّط منطقة المعاينة،
       * وهذا الهامش كان يُحتسب داخل الالتقاط فتخرج الصفحة مزاحة ومقصوصة
       * من الجانب. تصفيره هنا يلغي الإزاحة، وإلغاء الظل يمنع خبزه في الصورة.
       */
      style: { margin: '0', boxShadow: 'none' },
    })

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
  }

  return pdf.output('blob')
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
