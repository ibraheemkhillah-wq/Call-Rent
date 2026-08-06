import { useEffect, useLayoutEffect, useRef } from 'react'

/**
 * ضمان بقاء التقرير في صفحة واحدة.
 *
 * الفكرة: بدل تصغير المحتوى داخل صندوق ثابت (وهو ما يكسر الالتقاط عند
 * توليد الـ PDF فتخرج الصفحة مقصوصة من الجانب)، يُكبَّر صندوق الصفحة
 * نفسه مع الحفاظ على نسبة A4. المحتوى بمقاساته الثابتة يشغل عندها
 * مساحة نسبية أقل فيتّسع، ثم يُصغَّر المستند كاملاً إلى A4 عند التصدير.
 *
 * الميزة أن كل شيء يتم عبر التخطيط الطبيعي — بلا transform ولا zoom —
 * فيخرج المستند مطابقاً تماماً على الشاشة وفي الـ PDF وفي الطباعة.
 */
export function useFitToPage<T extends HTMLElement>(deps: unknown[]) {
  const ref = useRef<T | null>(null)

  const fit = () => {
    const doc = ref.current
    const body = doc?.querySelector<HTMLElement>('.doc-body')
    if (!doc || !body) return

    doc.style.setProperty('--page', '1')

    // بضع دورات تكفي للوصول إلى المقاس المناسب
    for (let i = 0; i < 5; i++) {
      const cs = getComputedStyle(body)
      const pad = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom)
      const available = body.clientHeight - pad
      const content = body.scrollHeight - pad
      if (available <= 0 || content <= available + 1) break

      const current = parseFloat(doc.style.getPropertyValue('--page')) || 1
      // هامش أمان 1% حتى لا يلامس المحتوى الحافة
      const next = Math.min(2, current * (content / available) * 1.01)
      if (next <= current) break
      doc.style.setProperty('--page', String(next))
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(fit, deps)

  /** إعادة الضبط بعد اكتمال تحميل الخطوط لأنها تغيّر ارتفاع النص */
  useEffect(() => {
    let cancelled = false
    document.fonts?.ready.then(() => {
      if (!cancelled) fit()
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return ref
}
