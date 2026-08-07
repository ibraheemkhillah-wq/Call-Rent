/**
 * الوضع النهاري والليلي.
 *
 * يُخزَّن الاختيار بمفتاح مستقل عن بيانات المستثمرين، حتى لا يتأثر
 * بالنسخ الاحتياطية أو ينتقل مع البيانات عند الاستيراد.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { dict } from '../i18n/current'

/** `system` يتبع إعداد الجهاز ويتغيّر معه مباشرة */
export type ThemeMode = 'light' | 'dark' | 'system'
/** الوضع المطبَّق فعلياً بعد حلّ `system` */
export type ResolvedTheme = 'light' | 'dark'

const STORAGE_KEY = 'call-rent-theme'

/** تسميات أوضاع العرض باللغة الحالية — دالة لا ثابت، فاللغة تتغيّر */
export function themeLabels(): Record<ThemeMode, string> {
  const s = dict().settings
  return { light: s.themeLight, dark: s.themeDark, system: s.themeSystem }
}

function readStored(): ThemeMode {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v === 'light' || v === 'dark' || v === 'system') return v
  } catch {
    /* الوصول للتخزين قد يكون محجوباً */
  }
  return 'system'
}

function systemTheme(): ResolvedTheme {
  return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: light)').matches
    ? 'light'
    : 'dark'
}

interface ThemeValue {
  /** الاختيار كما حدّده المستخدم */
  mode: ThemeMode
  /** الوضع المعروض فعلياً */
  theme: ResolvedTheme
  setMode: (m: ThemeMode) => void
  /** تبديل مباشر بين النهاري والليلي (يثبّت الاختيار) */
  toggle: () => void
}

const ThemeContext = createContext<ThemeValue | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(() => readStored())
  const [system, setSystem] = useState<ResolvedTheme>(() => systemTheme())

  /** متابعة تغيّر إعداد الجهاز أثناء تشغيل التطبيق */
  useEffect(() => {
    if (typeof matchMedia !== 'function') return
    const mq = matchMedia('(prefers-color-scheme: light)')
    const onChange = () => setSystem(mq.matches ? 'light' : 'dark')
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const theme: ResolvedTheme = mode === 'system' ? system : mode

  useEffect(() => {
    const root = document.documentElement
    root.dataset.theme = theme
    // يجعل عناصر المتصفح الأصلية (منتقي التاريخ، أشرطة التمرير) تتبع الوضع
    root.style.colorScheme = theme
    // لون شريط الحالة على الجوال عند فتحه كتطبيق مثبّت
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', theme === 'light' ? '#F2F5FA' : '#182B56')
  }, [theme])

  const setMode = useCallback((m: ThemeMode) => {
    setModeState(m)
    try {
      localStorage.setItem(STORAGE_KEY, m)
    } catch {
      /* التخزين غير متاح — يبقى الاختيار لهذه الجلسة فقط */
    }
  }, [])

  const toggle = useCallback(() => {
    setMode(theme === 'dark' ? 'light' : 'dark')
  }, [theme, setMode])

  const value = useMemo(
    () => ({ mode, theme, setMode, toggle }),
    [mode, theme, setMode, toggle],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme يجب أن يُستخدم داخل ThemeProvider')
  return ctx
}
