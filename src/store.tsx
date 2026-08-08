/** مخزن البيانات — يحفظ محلياً في المتصفح مع نسخ احتياطي يدوي */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type {
  Contribution,
  Database,
  Investor,
  MonthKey,
  ProfitEntry,
  Settings,
} from './types'
import { brand } from './theme/brand'
import { todayIso } from './lib/format'

const STORAGE_KEY = 'call-rent-investors-db-v1'
const DB_VERSION = 1

export const defaultSettings: Settings = {
  companyName: brand.name,
  companyNameAr: brand.nameAr,
  /** السطر العربي الظاهر تحت الشعار — الشعار نفسه يحمل الاسم والسطر الإنجليزي */
  tagline: brand.systemName,
  logoDataUrl: '',
  currency: 'USD',
  currencySymbol: '$',
  phone: brand.contact.phone,
  email: brand.contact.email,
  website: brand.contact.website,
  address: brand.contact.address,
  signatureName: brand.signature.name,
  signatureTitle: brand.signature.title,
  signatureImage: '',
}

const emptyDb: Database = {
  version: DB_VERSION,
  investors: [],
  contributions: [],
  profits: [],
  settings: defaultSettings,
}

function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`
}

/**
 * قيم افتراضية قديمة تُستبدل بالجديدة عند التحميل.
 * يُستبدل فقط ما لم يعدّله المستخدم بنفسه — أي ما يطابق القيمة القديمة حرفياً.
 */
const RENAMED: Partial<Record<keyof Settings, [string, string]>> = {
  companyNameAr: ['كول آند رنت', 'كول اند رينت'],
}

function migrateSettings(stored: Partial<Settings>): Settings {
  const merged: Settings = { ...defaultSettings, ...stored }
  for (const key of Object.keys(RENAMED) as (keyof Settings)[]) {
    const rename = RENAMED[key]
    if (rename && merged[key] === rename[0]) {
      merged[key] = rename[1]
    }
  }
  return merged
}

function loadDb(): Database {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return emptyDb
    const parsed = JSON.parse(raw) as Partial<Database>
    return {
      version: DB_VERSION,
      investors: parsed.investors ?? [],
      contributions: parsed.contributions ?? [],
      profits: parsed.profits ?? [],
      settings: migrateSettings(parsed.settings ?? {}),
    }
  } catch {
    return emptyDb
  }
}

interface StoreValue {
  db: Database
  /** عدد التعديلات المعلّقة التي لم تُحفظ بعد */
  pendingCount: number
  /** يثبّت التعديلات المعلّقة في التخزين */
  saveChanges: () => void
  /** يتراجع عن كل التعديلات المعلّقة */
  discardChanges: () => void
  /* المستثمرون */
  addInvestor: (data: Omit<Investor, 'id' | 'createdAt'>) => Investor
  updateInvestor: (id: string, patch: Partial<Investor>) => void
  deleteInvestor: (id: string) => void
  /* حركات رأس المال */
  addContribution: (data: Omit<Contribution, 'id'>) => void
  updateContribution: (id: string, patch: Partial<Contribution>) => void
  deleteContribution: (id: string) => void
  /* الأرباح */
  upsertProfit: (data: Omit<ProfitEntry, 'id'>) => void
  deleteProfit: (id: string) => void
  setProfitPaid: (id: string, paid: boolean) => void
  /* دفعة واحدة: تسجيل أرباح شهر لعدة مستثمرين */
  bulkUpsertProfits: (month: MonthKey, rows: { investorId: string; amount: number }[]) => void
  /* الإعدادات والنسخ الاحتياطي */
  updateSettings: (patch: Partial<Settings>) => void
  exportJson: () => void
  importJson: (file: File) => Promise<void>
  resetAll: () => void
}

const StoreContext = createContext<StoreValue | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  /*
   * نسختان من البيانات:
   *  • committed — المحفوظ فعلاً، وهو وحده ما يُكتب في التخزين المحلي.
   *  • staged    — نسخة عمل تحمل التعديلات المعلّقة، فارغة حين لا تعديل.
   *
   * ما يُنفَّذ بنقرة واحدة بلا تأكيد — تبديل حالة الصرف أو مصدر الدفعة أو
   * حذف سطر أو الكتابة في الإعدادات — يذهب إلى نسخة العمل لا إلى التخزين،
   * فلا تُثبَّت لمسة خاطئة حتى يضغط المستخدم «حفظ التعديلات».
   * أما ما يمرّ بنموذج وزرِّ حفظ فيُثبَّت فوراً: قد قُصد أصلاً.
   */
  const [committed, setCommitted] = useState<Database>(() => loadDb())
  const [staged, setStaged] = useState<Database | null>(null)
  const [pendingCount, setPendingCount] = useState(0)

  const db = staged ?? committed

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(committed))
    } catch (err) {
      console.error('تعذّر حفظ البيانات محلياً', err)
    }
  }, [committed])

  /** تحذير قبل مغادرة الصفحة وفيها تعديل معلّق */
  useEffect(() => {
    if (pendingCount === 0) return
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [pendingCount])

  /** تعديل يُثبَّت فوراً — ويُطبَّق على نسخة العمل أيضاً إن وُجدت */
  const commitNow = useCallback((fn: (d: Database) => Database) => {
    setCommitted(fn)
    setStaged((s) => (s ? fn(s) : null))
  }, [])

  /** تعديل يُعلَّق حتى يُحفظ صراحةً */
  const stage = useCallback((fn: (d: Database) => Database) => {
    setStaged((s) => fn(s ?? committed))
    setPendingCount((n) => n + 1)
  }, [committed])

  const saveChanges = useCallback(() => {
    setStaged((s) => {
      if (s) setCommitted(s)
      return null
    })
    setPendingCount(0)
  }, [])

  const discardChanges = useCallback(() => {
    setStaged(null)
    setPendingCount(0)
  }, [])

  const addInvestor = useCallback(
    (data: Omit<Investor, 'id' | 'createdAt'>) => {
      const investor: Investor = { ...data, id: newId(), createdAt: todayIso() }
      commitNow((d) => ({ ...d, investors: [...d.investors, investor] }))
      return investor
    },
    [commitNow],
  )

  const updateInvestor = useCallback(
    (id: string, patch: Partial<Investor>) => {
      commitNow((d) => ({
        ...d,
        investors: d.investors.map((i) => (i.id === id ? { ...i, ...patch } : i)),
      }))
    },
    [commitNow],
  )

  const deleteInvestor = useCallback((id: string) => {
    commitNow((d) => ({
      ...d,
      investors: d.investors.filter((i) => i.id !== id),
      contributions: d.contributions.filter((c) => c.investorId !== id),
      profits: d.profits.filter((p) => p.investorId !== id),
    }))
  }, [commitNow])

  const addContribution = useCallback(
    (data: Omit<Contribution, 'id'>) => {
      commitNow((d) => ({ ...d, contributions: [...d.contributions, { ...data, id: newId() }] }))
    },
    [commitNow],
  )

  const updateContribution = useCallback(
    (id: string, patch: Partial<Contribution>) => {
      stage((d) => ({
        ...d,
        contributions: d.contributions.map((c) => (c.id === id ? { ...c, ...patch } : c)),
      }))
    },
    [stage],
  )

  const deleteContribution = useCallback(
    (id: string) => {
      stage((d) => ({ ...d, contributions: d.contributions.filter((c) => c.id !== id) }))
    },
    [stage],
  )

  /** يضيف قيد ربح أو يستبدل القيد الموجود لنفس المستثمر ونفس الشهر */
  const upsertProfit = useCallback((data: Omit<ProfitEntry, 'id'>) => {
    commitNow((d) => {
      const existing = d.profits.find(
        (p) => p.investorId === data.investorId && p.month === data.month,
      )
      if (existing) {
        return {
          ...d,
          profits: d.profits.map((p) => (p.id === existing.id ? { ...p, ...data } : p)),
        }
      }
      return { ...d, profits: [...d.profits, { ...data, id: newId() }] }
    })
  }, [commitNow])

  const deleteProfit = useCallback(
    (id: string) => {
      stage((d) => ({ ...d, profits: d.profits.filter((p) => p.id !== id) }))
    },
    [stage],
  )

  const setProfitPaid = useCallback(
    (id: string, paid: boolean) => {
      stage((d) => ({
        ...d,
        profits: d.profits.map((p) =>
          p.id === id ? { ...p, paid, paidDate: paid ? todayIso() : '' } : p,
        ),
      }))
    },
    [stage],
  )

  const bulkUpsertProfits = useCallback(
    (month: MonthKey, rows: { investorId: string; amount: number }[]) => {
      commitNow((d) => {
        let profits = [...d.profits]
        for (const row of rows) {
          const idx = profits.findIndex(
            (p) => p.investorId === row.investorId && p.month === month,
          )
          if (row.amount === 0 && idx === -1) continue
          if (idx >= 0) {
            profits[idx] = { ...profits[idx], amount: row.amount }
          } else {
            profits.push({
              id: newId(),
              investorId: row.investorId,
              month,
              amount: row.amount,
              paid: false,
              paidDate: '',
              note: '',
            })
          }
        }
        return { ...d, profits }
      })
    },
    [commitNow],
  )

  const updateSettings = useCallback(
    (patch: Partial<Settings>) => {
      stage((d) => ({ ...d, settings: { ...d.settings, ...patch } }))
    },
    [stage],
  )

  const exportJson = useCallback(() => {
    const blob = new Blob([JSON.stringify(db, null, 2)], {
      type: 'application/json;charset=utf-8',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `نسخة-احتياطية-المستثمرين-${todayIso()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [db])

  const importJson = useCallback(async (file: File) => {
    const text = await file.text()
    const parsed = JSON.parse(text) as Partial<Database>
    if (!Array.isArray(parsed.investors)) {
      throw new Error('الملف غير صالح: لا يحتوي على قائمة مستثمرين')
    }
    setStaged(null)
    setPendingCount(0)
    setCommitted({
      version: DB_VERSION,
      investors: parsed.investors,
      contributions: parsed.contributions ?? [],
      profits: parsed.profits ?? [],
      settings: migrateSettings(parsed.settings ?? {}),
    })
  }, [])

  const resetAll = useCallback(() => {
    setStaged(null)
    setPendingCount(0)
    setCommitted({ ...emptyDb, settings: defaultSettings })
  }, [])

  const value = useMemo<StoreValue>(
    () => ({
      db,
      pendingCount,
      saveChanges,
      discardChanges,
      addInvestor,
      updateInvestor,
      deleteInvestor,
      addContribution,
      updateContribution,
      deleteContribution,
      upsertProfit,
      deleteProfit,
      setProfitPaid,
      bulkUpsertProfits,
      updateSettings,
      exportJson,
      importJson,
      resetAll,
    }),
    [
      db,
      pendingCount,
      saveChanges,
      discardChanges,
      addInvestor,
      updateInvestor,
      deleteInvestor,
      addContribution,
      updateContribution,
      deleteContribution,
      upsertProfit,
      deleteProfit,
      setProfitPaid,
      bulkUpsertProfits,
      updateSettings,
      exportJson,
      importJson,
      resetAll,
    ],
  )

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore يجب أن يُستخدم داخل StoreProvider')
  return ctx
}
