/**
 * تحديث التطبيق المثبَّت.
 *
 * التطبيق يخزّن ملفاته محلياً ليعمل دون إنترنت، وهذا يعني أن النسخة
 * القديمة قد تبقى عالقة على الجهاز بعد نشر تحديث — خاصةً على iOS حيث
 * لا يفحص التطبيق المثبَّت وجود تحديث إلا نادراً.
 *
 * لذلك يُفحص التحديث دورياً وعند كل عودة إلى التطبيق، ويُطبَّق فوراً.
 */

import { registerSW } from 'virtual:pwa-register'

/** كل دقيقتين أثناء الاستخدام */
const CHECK_EVERY_MS = 120_000

let updateFn: ((reload?: boolean) => Promise<void>) | null = null
let registration: ServiceWorkerRegistration | null = null

export function setupAppUpdates(): void {
  updateFn = registerSW({
    immediate: true,
    onRegisteredSW(_swUrl, reg) {
      if (!reg) return
      registration = reg

      const check = () => {
        reg.update().catch(() => {
          /* لا اتصال — تُعاد المحاولة لاحقاً */
        })
      }

      check()
      setInterval(check, CHECK_EVERY_MS)

      // العودة إلى التطبيق بعد تركه لحظة مناسبة للفحص
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check()
      })
      window.addEventListener('online', check)
    },
    onNeedRefresh() {
      // تطبيق النسخة الجديدة فوراً بدل انتظار إغلاق التطبيق
      void updateFn?.(true)
    },
  })
}

/** فحص يدوي للتحديثات — زر في صفحة الإعدادات */
export async function checkForUpdate(): Promise<'updated' | 'latest' | 'unavailable'> {
  if (!registration) return 'unavailable'
  try {
    await registration.update()
  } catch {
    return 'unavailable'
  }
  if (registration.waiting || registration.installing) {
    await updateFn?.(true)
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
