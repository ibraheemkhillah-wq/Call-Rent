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

/*
 * مكتبتا التوليد تُحمَّلان عند أول استعمال فقط، لا مع إقلاع التطبيق.
 * وزنهما معاً يفوق ضعف وزن التطبيق كله، وتحميلهما مقدماً كان يجعل
 * الفتحة الأولى على شبكة الجوال بطيئة إلى حدّ تبدو معه الصفحة معطّلة.
 */
async function loadEngines() {
  const [pdfMod, imgMod] = await Promise.all([import('jspdf'), import('html-to-image')])
  return { jsPDF: pdfMod.default, toCanvas: imgMod.toCanvas }
}

/** أبعاد A4 بالمليمتر */
const A4_W = 210
const A4_H = 297

/** يحمّل صورة من مصدرها — مسار احتياطي حين لا تكون صورة الصفحة جاهزة */
function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    if (!src) return resolve(null)
    const img = new Image()
    img.onload = () => resolve(img.naturalWidth > 0 ? img : null)
    img.onerror = () => resolve(null)
    img.src = src
    // بعض المتصفحات تُكمل الصور المضمّنة فوراً دون إطلاق onload
    if (img.complete && img.naturalWidth > 0) resolve(img)
  })
}

/**
 * يرسم صور المستند على اللوحة بنفسه بعد الالتقاط.
 *
 * ◆ لماذا هذه الخطوة أصلاً:
 * مكتبة الالتقاط تغلّف المستند داخل SVG ثم ترسمه كصورة. وWebKit
 * (سفاري على الآيفون) يمنع تحميل الصور المضمّنة داخل SVG يُرسم
 * كصورة — إجراء أمني عنده — فتخرج الصفحة سليمة النصوص والحدود
 * والمساحات، لكن بلا شعار ولا توقيع ولا ختم. كروم يسمح بها، ولذلك
 * لا يظهر الخلل على سطح المكتب.
 *
 * الحل ألا نعتمد عليه في هذه النقطة: نقرأ موضع كل صورة ومقاسها من
 * التخطيط الحقيقي، ونحمّلها ونرسمها على اللوحة مباشرة. الرسم فوق
 * موضعها نفسه، فإن كان المتصفح قد رسمها أصلاً (كروم) لم يتغيّر شيء.
 *
 * وتبقى الصور داخل الالتقاط ولا تُستثنى منه: استثناؤها يحذفها من
 * النسخة الملتقطة فيُعاد حساب تخطيط الترويسة بدونها وتنزاح العناصر
 * المجاورة. وجودها يحفظ المساحات، والرسم فوقها يحفظ البكسلات.
 */
async function paintImages(
  canvas: HTMLCanvasElement,
  node: HTMLElement,
): Promise<{ painted: number; total: number }> {
  const all = Array.from(node.querySelectorAll('img'))
  const ctx = canvas.getContext('2d')
  if (!ctx) return { painted: 0, total: all.length }

  const base = node.getBoundingClientRect()
  if (base.width === 0 || base.height === 0) return { painted: 0, total: all.length }
  const scaleX = canvas.width / base.width
  const scaleY = canvas.height / base.height

  let painted = 0
  for (const el of all) {
    const box = el.getBoundingClientRect()
    if (box.width === 0 || box.height === 0) continue

    /*
     * تُرسم صورة الصفحة نفسها متى كانت جاهزة: هي محمّلة ومفكوكة
     * الترميز مسبقاً، فلا حاجة لإنشاء نسخة قد يفشل تحميلها بصمت.
     */
    const img =
      el.complete && el.naturalWidth > 0 ? el : await loadImage(el.currentSrc || el.src)
    if (!img || img.naturalWidth === 0) continue

    /*
     * مطابقة object-fit: contain — تُحفظ نسبة الصورة داخل صندوقها
     * وتُتوسَّط فيه، تماماً كما يفعل المتصفح عند العرض.
     */
    const fit = Math.min(box.width / img.naturalWidth, box.height / img.naturalHeight)
    const w = img.naturalWidth * fit
    const h = img.naturalHeight * fit
    const x = box.left - base.left + (box.width - w) / 2
    const y = box.top - base.top + (box.height - h) / 2

    try {
      ctx.drawImage(img, x * scaleX, y * scaleY, w * scaleX, h * scaleY)
      painted++
    } catch {
      // تُحتسب ناقصة ويُبلَّغ عنها بدل أن تختفي بصمت
    }
  }
  return { painted, total: all.length }
}

/**
 * يلتقط صفحات التقرير كـ canvas واحد لكل صفحة.
 * هذه هي النقطة الوحيدة التي يُرسم فيها المستند؛ كل ما بعدها
 * (معاينة أو PDF) مشتقّ من نتيجتها.
 */
export async function renderDocCanvases(nodes: HTMLElement[]): Promise<HTMLCanvasElement[]> {
  const { toCanvas } = await loadEngines()

  // انتظار اكتمال تحميل الخطوط حتى لا يُلتقط المستند بخط بديل
  await document.fonts?.ready

  const out: HTMLCanvasElement[] = []
  let missing = 0
  for (const node of nodes) {
    const canvas = await toCanvas(node, {
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
    })

    // الشعار والتوقيع والختم تُرسم يدوياً — انظر شرح paintImages
    const { painted, total } = await paintImages(canvas, node)
    missing += total - painted
    out.push(canvas)
  }

  /*
   * إخفاق رسم صورة كان يمرّ بصمت فيصل التقرير للمستثمر ناقص الشعار
   * أو التوقيع دون أن ينتبه أحد. الآن يُعلَن عنه صراحةً.
   */
  if (missing > 0) {
    throw new Error(`تعذّر رسم ${missing} من صور التقرير (الشعار/التوقيع/الختم)`)
  }

  return out
}

/** صور المعاينة — نفس الالتقاط المستخدم في الملف المُرسَل */
export function canvasesToImages(canvases: HTMLCanvasElement[]): string[] {
  return canvases.map((c) => c.toDataURL('image/jpeg', 0.94))
}

/** يجمّع الصفحات الملتقطة في ملف PDF بحجم A4 */
export async function pdfBlobFromCanvases(
  canvases: HTMLCanvasElement[],
): Promise<Blob | null> {
  if (canvases.length === 0) return null

  const { jsPDF } = await loadEngines()
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

export async function pdfFileFromCanvases(
  canvases: HTMLCanvasElement[],
  filename: string,
): Promise<File | null> {
  const blob = await pdfBlobFromCanvases(canvases)
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
export type ShareOutcome = 'shared' | 'cancelled' | 'unsupported' | 'blocked'

export async function sharePdfFile(file: File): Promise<ShareOutcome> {
  const nav = navigator as Navigator & {
    canShare?: (data: ShareData) => boolean
    share?: (data: ShareData) => Promise<void>
  }
  if (!nav.share || !nav.canShare?.({ files: [file] })) return 'unsupported'

  try {
    /*
     * يُرسَل الملف وحده بلا title أو text: إضافتهما تجعل واتساب يحاول
     * إرسال رسالة نصية مع الملف، وهو ما كان يفشل بالرسالة
     * «تعذّر إرسال الرسالة». الملف وحده يصل دائماً.
     */
    await nav.share({ files: [file] })
    return 'shared'
  } catch (err) {
    const name = (err as Error)?.name
    // إلغاء المستخدم للمشاركة ليس خطأ
    if (name === 'AbortError') return 'cancelled'
    /*
     * NotAllowedError تعني أن المتصفح لم يعد يعتبر النداء ناتجاً عن
     * ضغطة المستخدم — يحدث حين يطول التحضير بين الضغط والمشاركة، أو
     * حين تُعرض الصفحة داخل إطار لا يملك إذن المشاركة.
     */
    return 'blocked'
  }
}

/** رابط مؤقت للملف — يُفتح أو يُنزَّل يدوياً حين تتعذّر المشاركة */
export function fileObjectUrl(file: File): string {
  return URL.createObjectURL(file)
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
