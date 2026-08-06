/**
 * تحديث التطبيق المثبَّت.
 *
 * التطبيق يخزّن ملفاته محلياً ليعمل دون إنترنت، وهذا يعني أن النسخة
 * القديمة قد تبقى عالقة على الجهاز بعد نشر تحديث — خاصةً على iOS حيث
 * لا يفحص التطبيق المثبَّت وجود تحديث إلا نادراً.
 *
 * لذلك يُفحص التحديث دورياً وعند كل عودة إلى التطبيق، ويُطبَّق فوراً.
 */

/** يُلغي كل عمّال الخدمة ويمحو ما خزّنوه. يُرجع true إن وُجد ما يُزال */
async function purgeServiceWorkers(): Promise<boolean> {
  let found = false

  try {
    const regs = (await navigator.serviceWorker?.getRegistrations?.()) ?? []
    for (const reg of regs) {
      found = true
      await reg.unregister()
    }
  } catch {
    /* المتصفح لا يدعم عمّال الخدمة — لا شيء لإلغائه */
  }

  try {
    const keys = (await caches?.keys?.()) ?? []
    if (keys.length > 0) found = true
    await Promise.all(keys.map((k) => caches.delete(k)))
  } catch {
    /* لا ذاكرة ملفات — لا شيء لمحوه */
  }

  return found
}

/**
 * تنظيف عند كل إقلاع.
 *
 * لم يعد التطبيق يسجّل عامل خدمة، لكن الأجهزة التي سجّلت واحداً سابقاً
 * تبقى محكومة به فيقدّم لها نسخة قديمة إلى الأبد. هذا التنظيف يزيله من
 * أول مرة تصلها فيها نسخة جديدة، فيتحرّر الجهاز نهائياً.
 */
export function setupAppUpdates(): void {
  void purgeServiceWorkers()
}

/** فحص يدوي — زر في صفحة الإعدادات */
export async function checkForUpdate(): Promise<'updated' | 'latest' | 'unavailable'> {
  const hadStale = await purgeServiceWorkers()
  if (hadStale) {
    // بقايا نسخة قديمة أُزيلت للتوّ — تُعاد القراءة من الخادم
    window.location.reload()
    return 'updated'
  }
  return 'latest'
}

/**
 * إعادة ضبط قاسية: تُلغى تسجيلات عامل الخدمة وتُمحى كل الملفات
 * المخزّنة، ثم تُحمَّل الصفحة من الخادم.
 *
 * لماذا نحتاجها رغم وجود الفحص الدوري: على iOS قد يعلق التطبيق على
 * نسخة قديمة عناداً — إن خُزِّن ملف عامل الخدمة نفسه في ذاكرة الشبكة،
 * فلا يُجلب الجديد فلا يُكتشف التحديث أصلاً. هذه الدالة تكسر الحلقة
 * من خارجها.
 *
 * بيانات المستثمرين محفوظة في localStorage ولا تمسّها هذه العملية.
 */
export async function hardReset(): Promise<void> {
  try {
    const regs = (await navigator.serviceWorker?.getRegistrations?.()) ?? []
    await Promise.all(regs.map((r) => r.unregister()))
  } catch {
    /* المتصفح لا يدعم عمّال الخدمة — لا شيء لإلغائه */
  }

  try {
    const keys = (await caches?.keys?.()) ?? []
    await Promise.all(keys.map((k) => caches.delete(k)))
  } catch {
    /* لا ذاكرة ملفات — لا شيء لمحوه */
  }

  // معامل الوقت يتجاوز أي نسخة محفوظة في ذاكرة المتصفح نفسه
  const url = new URL(window.location.href)
  url.searchParams.set('تحديث', String(Date.now()))
  window.location.replace(url.toString())
}

/** تاريخ بناء النسخة الحالية — يُحقن وقت البناء */
export const BUILD_ID: string =
  typeof __BUILD_ID__ === 'string' ? __BUILD_ID__ : 'dev'
