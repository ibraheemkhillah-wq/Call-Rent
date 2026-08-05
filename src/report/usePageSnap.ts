import { useEffect, useLayoutEffect, useRef } from 'react'

/** ارتفاع صفحة A4 بوحدات CSS (1in = 96px بحسب المواصفة، و297mm هو ارتفاع A4) */
const PAGE_HEIGHT_PX = (297 / 25.4) * 96

/**
 * يضبط ارتفاع المستند ليكون مضاعفاً صحيحاً لارتفاع صفحة A4،
 * فيستقر التذييل في أسفل آخر صفحة بدل أن يتوقف في منتصفها.
 */
export function usePageSnap<T extends HTMLElement>(deps: unknown[]) {
  const ref = useRef<T | null>(null)

  const snap = () => {
    const el = ref.current
    if (!el) return
    el.style.minHeight = ''
    const natural = el.getBoundingClientRect().height
    const pages = Math.max(1, Math.ceil(natural / PAGE_HEIGHT_PX - 0.02))
    el.style.minHeight = `${pages * PAGE_HEIGHT_PX}px`
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(snap, deps)

  /** إعادة الضبط بعد اكتمال تحميل الخطوط، لأنها تغيّر ارتفاع النص */
  useEffect(() => {
    let cancelled = false
    document.fonts?.ready.then(() => {
      if (!cancelled) snap()
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return ref
}
