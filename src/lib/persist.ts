/**
 * حفظ البيانات على الجهاز.
 *
 * هذه أرقام تراكمية تُبنى عليها قرارات وتستمرّ سنين، وضياعها لا يُعوَّض
 * بإعادة إدخال. ولذلك لا يُترك حفظها لمخزنٍ واحد:
 *
 *  • localStorage — سريع ومتزامن، يُقرأ عند الإقلاع قبل أول رسمة. لكنه
 *    محدود بنحو خمسة ميغابايت في سفاري، وشعارٌ أو توقيعٌ مرفوع يقترب من
 *    الحدّ، فتفشل الكتابة صامتةً ويظنّ المستخدم أنه حفظ.
 *
 *  • IndexedDB — حصّته أكبر بمراتب ويقبل الكائنات كما هي بلا نصّ وسيط،
 *    لكنه غير متزامن فلا يصلح وحده لأول قراءة.
 *
 * فيُكتب في الاثنين معاً، ويُقرأ المتزامن أولاً، ثم يُسأل الآخر: إن كان
 * المتزامن فارغاً وفي الآخر بيانات — وهذا ما يحدث حين يُفرغ المتصفح
 * تخزيناً دون آخر — استُعيدت من غير أن يفعل المستخدم شيئاً.
 *
 * ويبقى ما لا يملكه المتصفح: iOS يمحو تخزين المواقع التي لم تُفتح سبعة
 * أيام، ويستثني ما أُضيف إلى الشاشة الرئيسية. لذلك يُطلب التخزين الدائم
 * حيث يُتاح، ويُنبَّه المستخدم إلى الإضافة وإلى النسخة الاحتياطية.
 */

import type { Database } from '../types'

const LS_KEY = 'call-rent-investors-db-v1'
const LS_DRAFT = 'call-rent-investors-draft-v1'
const LS_META = 'call-rent-investors-meta-v1'

const IDB_NAME = 'call-rent-investors'
const IDB_STORE = 'snapshots'
const IDB_KEY = 'db'

export interface Snapshot {
  /** وقت آخر كتابة ناجحة — ISO */
  savedAt: string
  data: Database
}

/** نتيجة محاولة الحفظ في المخزنين */
export interface WriteResult {
  local: boolean
  mirror: boolean
  savedAt: string
}

/* ────────────── التخزين المتزامن ────────────── */

export function readLocal(): Snapshot | null {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<Snapshot> & Partial<Database>

    /*
     * النسخ الأقدم كتبت قاعدة البيانات مباشرةً بلا غلاف. تُميَّز بوجود
     * قائمة المستثمرين في جذرها، فتُقرأ كما هي ولا يضيع شيء بالترقية.
     */
    if (Array.isArray((parsed as Partial<Database>).investors)) {
      return { savedAt: '', data: parsed as Database }
    }
    if (parsed && typeof parsed === 'object' && parsed.data) {
      return { savedAt: parsed.savedAt ?? '', data: parsed.data as Database }
    }
    return null
  } catch {
    return null
  }
}

export function writeLocal(snap: Snapshot): boolean {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(snap))
    return true
  } catch {
    // الحصّة ممتلئة أو التخزين ممنوع — يبقى المخزن الآخر
    return false
  }
}

/* ────────────── المخزن الثاني ────────────── */

function openMirror(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') return resolve(null)
      const req = indexedDB.open(IDB_NAME, 1)
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(IDB_STORE)) {
          req.result.createObjectStore(IDB_STORE)
        }
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => resolve(null)
      req.onblocked = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
}

export async function readMirror(): Promise<Snapshot | null> {
  const idb = await openMirror()
  if (!idb) return null
  return new Promise((resolve) => {
    try {
      const req = idb.transaction(IDB_STORE, 'readonly').objectStore(IDB_STORE).get(IDB_KEY)
      req.onsuccess = () => {
        const v = req.result as Snapshot | undefined
        resolve(v && v.data && Array.isArray(v.data.investors) ? v : null)
      }
      req.onerror = () => resolve(null)
    } catch {
      resolve(null)
    } finally {
      // الإغلاق بعد انتهاء المعاملة، والمتصفح يؤخّره حتى تنتهي
      setTimeout(() => idb.close(), 0)
    }
  })
}

export async function writeMirror(snap: Snapshot): Promise<boolean> {
  const idb = await openMirror()
  if (!idb) return false
  return new Promise((resolve) => {
    try {
      const tx = idb.transaction(IDB_STORE, 'readwrite')
      tx.objectStore(IDB_STORE).put(snap, IDB_KEY)
      tx.oncomplete = () => resolve(true)
      tx.onerror = () => resolve(false)
      tx.onabort = () => resolve(false)
    } catch {
      resolve(false)
    } finally {
      setTimeout(() => idb.close(), 0)
    }
  })
}

/** كتابة في المخزنين معاً — ينجح ما ينجح ويُخبَر عن الباقي */
export async function writeBoth(data: Database): Promise<WriteResult> {
  const savedAt = new Date().toISOString()
  const snap: Snapshot = { savedAt, data }
  const local = writeLocal(snap)
  const mirror = await writeMirror(snap)
  return { local, mirror, savedAt }
}

/** قاعدة بلا أي إدخال — لا يُستبدل بها شيء ولا تُكتب فوق نسخة عامرة */
export function isEmptyDb(db: Database | null | undefined): boolean {
  if (!db) return true
  return (
    (db.investors?.length ?? 0) === 0 &&
    (db.contributions?.length ?? 0) === 0 &&
    (db.profits?.length ?? 0) === 0
  )
}

/* ────────────── التعديلات المعلّقة ────────────── */

/**
 * التعديل المعلّق يُحفظ هو أيضاً — بوصفه معلّقاً لا محفوظاً.
 *
 * ما ينتظر «حفظ التعديلات» يعيش في الذاكرة وحدها، فإغلاقٌ مفاجئ أو
 * إخلاء iOS للصفحة من الذاكرة يمحو عمل جلسة كاملة. بحفظه هنا يعود عند
 * الفتح كما تُرك: مدرَجاً في الشريط ينتظر قرار المستخدم، لا مُثبَّتاً
 * من وراء ظهره.
 */
export interface DraftBox<P> {
  staged: Database
  pendingLog: P[]
}

export function readDraft<P>(): DraftBox<P> | null {
  try {
    const raw = localStorage.getItem(LS_DRAFT)
    if (!raw) return null
    const parsed = JSON.parse(raw) as DraftBox<P>
    if (!parsed?.staged || !Array.isArray(parsed.staged.investors)) return null
    if (!Array.isArray(parsed.pendingLog) || parsed.pendingLog.length === 0) return null
    return parsed
  } catch {
    return null
  }
}

export function writeDraft<P>(box: DraftBox<P>): void {
  try {
    localStorage.setItem(LS_DRAFT, JSON.stringify(box))
  } catch {
    /* المسوّدة تحسين — إخفاقها لا يمسّ المحفوظ */
  }
}

export function clearDraft(): void {
  try {
    localStorage.removeItem(LS_DRAFT)
  } catch {
    /* لا شيء يُمسح */
  }
}

/* ────────────── حالة التخزين ────────────── */

/** طلب تخزينٍ لا يُخلى تلقائياً — يُتاح على أندرويد وسطح المكتب */
export async function requestPersistent(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false
    if (await navigator.storage.persisted()) return true
    return await navigator.storage.persist()
  } catch {
    return false
  }
}

interface Meta {
  /** آخر مرة صُدِّر فيها ملف نسخة احتياطية — ISO */
  lastBackupAt: string
  /** آخر مرة أُخفي فيها تنبيه الإضافة إلى الشاشة الرئيسية — ISO */
  installHintAt: string
}

const emptyMeta: Meta = { lastBackupAt: '', installHintAt: '' }

export function readMeta(): Meta {
  try {
    const raw = localStorage.getItem(LS_META)
    return raw ? { ...emptyMeta, ...(JSON.parse(raw) as Partial<Meta>) } : emptyMeta
  } catch {
    return emptyMeta
  }
}

export function writeMeta(patch: Partial<Meta>): Meta {
  const next = { ...readMeta(), ...patch }
  try {
    localStorage.setItem(LS_META, JSON.stringify(next))
  } catch {
    /* التوقيتات تحسين — إخفاقها لا يمسّ البيانات */
  }
  return next
}

/** عدد الأيام منذ تاريخ ISO، و Infinity إن لم يكن هناك تاريخ */
export function daysSince(iso: string): number {
  if (!iso) return Infinity
  const then = new Date(iso).getTime()
  if (!Number.isFinite(then)) return Infinity
  return (Date.now() - then) / 86400000
}

/** التطبيق مفتوح من الشاشة الرئيسية لا من داخل المتصفح */
export function isStandalone(): boolean {
  try {
    return (
      window.matchMedia?.('(display-mode: standalone)')?.matches === true ||
      (navigator as { standalone?: boolean }).standalone === true
    )
  } catch {
    return false
  }
}

/** جهاز iOS — عليه وحده يمحو المتصفح التخزين بعد سبعة أيام بلا فتح */
export function isIos(): boolean {
  try {
    const ua = navigator.userAgent
    return (
      /iPad|iPhone|iPod/.test(ua) ||
      // آيباد الحديث يعرّف نفسه ماكنتوش، ويميّزه وجود اللمس
      (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
    )
  } catch {
    return false
  }
}
