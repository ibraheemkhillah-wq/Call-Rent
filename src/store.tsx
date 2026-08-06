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
  const [db, setDb] = useState<Database>(() => loadDb())

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(db))
    } catch (err) {
      console.error('تعذّر حفظ البيانات محلياً', err)
    }
  }, [db])

  const addInvestor = useCallback((data: Omit<Investor, 'id' | 'createdAt'>) => {
    const investor: Investor = { ...data, id: newId(), createdAt: todayIso() }
    setDb((d) => ({ ...d, investors: [...d.investors, investor] }))
    return investor
  }, [])

  const updateInvestor = useCallback((id: string, patch: Partial<Investor>) => {
    setDb((d) => ({
      ...d,
      investors: d.investors.map((i) => (i.id === id ? { ...i, ...patch } : i)),
    }))
  }, [])

  const deleteInvestor = useCallback((id: string) => {
    setDb((d) => ({
      ...d,
      investors: d.investors.filter((i) => i.id !== id),
      contributions: d.contributions.filter((c) => c.investorId !== id),
      profits: d.profits.filter((p) => p.investorId !== id),
    }))
  }, [])

  const addContribution = useCallback((data: Omit<Contribution, 'id'>) => {
    setDb((d) => ({ ...d, contributions: [...d.contributions, { ...data, id: newId() }] }))
  }, [])

  const updateContribution = useCallback((id: string, patch: Partial<Contribution>) => {
    setDb((d) => ({
      ...d,
      contributions: d.contributions.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    }))
  }, [])

  const deleteContribution = useCallback((id: string) => {
    setDb((d) => ({ ...d, contributions: d.contributions.filter((c) => c.id !== id) }))
  }, [])

  /** يضيف قيد ربح أو يستبدل القيد الموجود لنفس المستثمر ونفس الشهر */
  const upsertProfit = useCallback((data: Omit<ProfitEntry, 'id'>) => {
    setDb((d) => {
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
  }, [])

  const deleteProfit = useCallback((id: string) => {
    setDb((d) => ({ ...d, profits: d.profits.filter((p) => p.id !== id) }))
  }, [])

  const setProfitPaid = useCallback((id: string, paid: boolean) => {
    setDb((d) => ({
      ...d,
      profits: d.profits.map((p) =>
        p.id === id ? { ...p, paid, paidDate: paid ? todayIso() : '' } : p,
      ),
    }))
  }, [])

  const bulkUpsertProfits = useCallback(
    (month: MonthKey, rows: { investorId: string; amount: number }[]) => {
      setDb((d) => {
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
    [],
  )

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setDb((d) => ({ ...d, settings: { ...d.settings, ...patch } }))
  }, [])

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
    setDb({
      version: DB_VERSION,
      investors: parsed.investors,
      contributions: parsed.contributions ?? [],
      profits: parsed.profits ?? [],
      settings: migrateSettings(parsed.settings ?? {}),
    })
  }, [])

  const resetAll = useCallback(() => setDb({ ...emptyDb, settings: defaultSettings }), [])

  const value = useMemo<StoreValue>(
    () => ({
      db,
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
