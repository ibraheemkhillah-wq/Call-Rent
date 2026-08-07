/** مزوّد اللغة — يبدّل نصوص الواجهة والتقارير واتجاه الصفحة معاً */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Dict, Lang } from './dict'
import {
  LANG_DIR,
  dict,
  isValidLang,
  setCurrentLang,
} from './current'

const STORAGE_KEY = 'call-rent-lang'

function initialLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (isValidLang(saved)) return saved
  } catch {
    /* التخزين المحلي محجوب — تُستخدم اللغة الافتراضية */
  }
  // لغة الجهاز إن كانت من المدعومة، وإلا العربية
  const nav = (navigator.language || '').slice(0, 2)
  return isValidLang(nav) ? nav : 'ar'
}

interface LangValue {
  lang: Lang
  setLang: (lang: Lang) => void
  dir: 'rtl' | 'ltr'
  t: Dict
}

const LangContext = createContext<LangValue | null>(null)

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    const l = initialLang()
    // تُضبط قبل أول رسم حتى تقرأها دوال التنسيق والحساب مباشرة
    setCurrentLang(l)
    return l
  })

  useEffect(() => {
    setCurrentLang(lang)
    const el = document.documentElement
    el.lang = lang
    el.dir = LANG_DIR[lang]
    try {
      localStorage.setItem(STORAGE_KEY, lang)
    } catch {
      /* التخزين المحلي محجوب — يبقى الاختيار لهذه الجلسة */
    }
  }, [lang])

  const setLang = useCallback((next: Lang) => {
    setCurrentLang(next)
    setLangState(next)
  }, [])

  const value = useMemo<LangValue>(
    () => ({ lang, setLang, dir: LANG_DIR[lang], t: dict() }),
    [lang, setLang],
  )

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>
}

export function useLang(): LangValue {
  const ctx = useContext(LangContext)
  if (!ctx) throw new Error('useLang يجب أن يُستخدم داخل LangProvider')
  return ctx
}

/** اختصار للنصوص وحدها — الاستعمال الأكثر شيوعاً */
export function useT(): Dict {
  return useLang().t
}

export type { Lang, Dict }
