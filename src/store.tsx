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
import { dict } from './i18n/current'
import { money, todayIso } from './lib/format'

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

/** «2026-03» → «مارس 2026» — للسطر الوصفي في قائمة المعلّق */
function monthText(month: MonthKey): string {
  const [y, m] = month.split('-')
  const idx = Number(m) - 1
  return idx >= 0 && idx < 12 ? `${dict().months[idx]} ${y}` : month
}

/** «2026-03-10» → «10 مارس 2026» */
function dateText(iso: string): string {
  const [y, m, d] = iso.split('-')
  const idx = Number(m) - 1
  return idx >= 0 && idx < 12 ? `${Number(d)} ${dict().months[idx]} ${y}` : iso
}

/** اسم حقل الإعدادات كما يظهر للمستخدم */
function settingLabel(field: string): string {
  const f = dict().pending.fields as Record<string, string>
  return f[field] ?? field
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

/** وصف تعديل معلّق — المفتاح يدمج التعديلات المتتابعة على الشيء نفسه */
export interface PendingItem {
  key: string
  label: string
}

interface StoreValue {
  db: Database
  /** التعديلات المعلّقة بترتيب حدوثها */
  pendingLog: PendingItem[]
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
  const [pendingLog, setPendingLog] = useState<PendingItem[]>([])

  const db = staged ?? committed
  const pendingCount = pendingLog.length

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

  /**
   * كل تعديل يُعلَّق حتى يُحفظ صراحةً.
   *
   * التعديلات المتتابعة على الشيء نفسه — كالكتابة حرفاً حرفاً في حقل
   * واحد — تحمل المفتاح نفسه فتُدمج في سطر واحد، وإلا امتلأت القائمة
   * بعشرات السطور لتعديلٍ واحد.
   */
  const stage = useCallback(
    (fn: (d: Database) => Database, item: PendingItem) => {
      setStaged((s) => fn(s ?? committed))
      setPendingLog((log) =>
        log.length > 0 && log[log.length - 1].key === item.key
          ? [...log.slice(0, -1), item]
          : [...log, item],
      )
    },
    [committed],
  )

  /** تثبيت يتجاوز التعليق — للاستعادة من نسخة احتياطية ومسح البيانات */
  const replaceAll = useCallback((next: Database) => {
    setStaged(null)
    setPendingLog([])
    setCommitted(next)
  }, [])

  const saveChanges = useCallback(() => {
    setStaged((s) => {
      if (s) setCommitted(s)
      return null
    })
    setPendingLog([])
  }, [])

  const discardChanges = useCallback(() => {
    setStaged(null)
    setPendingLog([])
  }, [])

  /** اسم مستثمر من نسخة العمل — للسطر الوصفي في قائمة المعلّق */
  const nameOf = useCallback(
    (investorId: string) => db.investors.find((i) => i.id === investorId)?.name ?? '',
    [db.investors],
  )

  /* وصفٌ يميّز السطر عن غيره: سطران متطابقان لا يُقرأ منهما ما تغيّر */
  const profitText = useCallback(
    (id: string) => {
      const p = db.profits.find((x) => x.id === id)
      return p ? `${monthText(p.month)} — ${nameOf(p.investorId)}` : ''
    },
    [db.profits, nameOf],
  )

  const contribText = useCallback(
    (id: string) => {
      const c = db.contributions.find((x) => x.id === id)
      return c ? `${dateText(c.date)} — ${nameOf(c.investorId)}` : ''
    },
    [db.contributions, nameOf],
  )

  const addInvestor = useCallback(
    (data: Omit<Investor, 'id' | 'createdAt'>) => {
      const investor: Investor = { ...data, id: newId(), createdAt: todayIso() }
      stage((d) => ({ ...d, investors: [...d.investors, investor] }), {
        key: `investor:add:${investor.id}`,
        label: dict().pending.log.addInvestor(investor.name),
      })
      return investor
    },
    [stage],
  )

  const updateInvestor = useCallback(
    (id: string, patch: Partial<Investor>) => {
      stage(
        (d) => ({
          ...d,
          investors: d.investors.map((i) => (i.id === id ? { ...i, ...patch } : i)),
        }),
        { key: `investor:edit:${id}`, label: dict().pending.log.editInvestor(nameOf(id)) },
      )
    },
    [stage, nameOf],
  )

  const deleteInvestor = useCallback(
    (id: string) => {
      const label = dict().pending.log.deleteInvestor(nameOf(id))
      stage(
        (d) => ({
          ...d,
          investors: d.investors.filter((i) => i.id !== id),
          contributions: d.contributions.filter((c) => c.investorId !== id),
          profits: d.profits.filter((p) => p.investorId !== id),
        }),
        { key: `investor:del:${id}`, label },
      )
    },
    [stage, nameOf],
  )

  const addContribution = useCallback(
    (data: Omit<Contribution, 'id'>) => {
      const id = newId()
      stage((d) => ({ ...d, contributions: [...d.contributions, { ...data, id }] }), {
        key: `contrib:add:${id}`,
        label:
          data.type === 'deposit'
            ? dict().pending.log.addDeposit(money(data.amount, ''), nameOf(data.investorId))
            : dict().pending.log.addWithdrawal(money(data.amount, ''), nameOf(data.investorId)),
      })
    },
    [stage, nameOf],
  )

  const updateContribution = useCallback(
    (id: string, patch: Partial<Contribution>) => {
      stage(
        (d) => ({
          ...d,
          contributions: d.contributions.map((c) => (c.id === id ? { ...c, ...patch } : c)),
        }),
        { key: `contrib:edit:${id}`, label: dict().pending.log.editContribution(contribText(id)) },
      )
    },
    [stage, contribText],
  )

  const deleteContribution = useCallback(
    (id: string) => {
      const label = dict().pending.log.deleteContribution(contribText(id))
      stage((d) => ({ ...d, contributions: d.contributions.filter((c) => c.id !== id) }), {
        key: `contrib:del:${id}`,
        label,
      })
    },
    [stage, contribText],
  )

  /** يضيف قيد ربح أو يستبدل القيد الموجود لنفس المستثمر ونفس الشهر */
  const upsertProfit = useCallback(
    (data: Omit<ProfitEntry, 'id'>) => {
      stage(
        (d) => {
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
        },
        {
          key: `profit:${data.investorId}:${data.month}`,
          label: dict().pending.log.setProfit(monthText(data.month), nameOf(data.investorId)),
        },
      )
    },
    [stage, nameOf],
  )

  const deleteProfit = useCallback(
    (id: string) => {
      const label = dict().pending.log.deleteProfit(profitText(id))
      stage((d) => ({ ...d, profits: d.profits.filter((p) => p.id !== id) }), {
        key: `profit:del:${id}`,
        label,
      })
    },
    [stage, profitText],
  )

  const setProfitPaid = useCallback(
    (id: string, paid: boolean) => {
      stage(
        (d) => ({
          ...d,
          profits: d.profits.map((p) =>
            p.id === id ? { ...p, paid, paidDate: paid ? todayIso() : '' } : p,
          ),
        }),
        {
          key: `profit:paid:${id}`,
          label: paid
            ? dict().pending.log.markPaid(profitText(id))
            : dict().pending.log.markDue(profitText(id)),
        },
      )
    },
    [stage, profitText],
  )

  const bulkUpsertProfits = useCallback(
    (month: MonthKey, rows: { investorId: string; amount: number }[]) => {
      stage((d) => {
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
      }, {
        key: `profits:bulk:${month}`,
        label: dict().pending.log.bulkProfits(monthText(month), rows.filter((r) => r.amount !== 0).length),
      })
    },
    [stage],
  )

  const updateSettings = useCallback(
    (patch: Partial<Settings>) => {
      const fields = Object.keys(patch)
      stage((d) => ({ ...d, settings: { ...d.settings, ...patch } }), {
        // مفتاح لكل حقل: الكتابة فيه حرفاً حرفاً تُدمج في سطر واحد
        key: `settings:${fields.join(',')}`,
        label: dict().pending.log.settings(fields.map((f) => settingLabel(f)).join('، ')),
      })
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
    // الاستعادة تُثبَّت فوراً: هي استبدال كامل مؤكَّد لا تعديل يُراجَع
    replaceAll({
      version: DB_VERSION,
      investors: parsed.investors,
      contributions: parsed.contributions ?? [],
      profits: parsed.profits ?? [],
      settings: migrateSettings(parsed.settings ?? {}),
    })
  }, [replaceAll])

  const resetAll = useCallback(
    () => replaceAll({ ...emptyDb, settings: defaultSettings }),
    [replaceAll],
  )

  const value = useMemo<StoreValue>(
    () => ({
      db,
      pendingLog,
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
      pendingLog,
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
