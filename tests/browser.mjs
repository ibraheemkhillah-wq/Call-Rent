/**
 * تشغيل المتصفح للفحوص.
 *
 * الفحوص هنا تفتح التطبيق فعلاً وتضغط أزراره، لأن ما يُراد التأكّد منه
 * سلوكٌ يراه المستخدم: رقمٌ يبقى كما حُفظ، ووسمٌ يظهر عند صاحبه. ولا
 * يُثبَّت playwright في حزمة التطبيق — يُؤخذ من المثبَّت على الجهاز إن
 * وُجد، فلا يحمل المستخدم تبعة أداة لا يستعملها.
 */
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

/** أماكن يُبحث فيها عن playwright-core بالترتيب */
const PATHS = [
  process.env.PLAYWRIGHT_PATH,
  'playwright-core',
  '/opt/node22/lib/node_modules/playwright/node_modules/playwright-core',
  '/usr/lib/node_modules/playwright/node_modules/playwright-core',
].filter(Boolean)

/** متصفّحات مثبَّتة مسبقاً في بيئات العمل الجاهزة */
const BROWSERS = [
  process.env.CHROMIUM_PATH,
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/opt/pw-browsers/chromium/chrome-linux/chrome',
  '/usr/bin/chromium',
  '/usr/bin/google-chrome',
].filter(Boolean)

export const BASE = process.env.BASE || 'http://localhost:4200'

export async function launch() {
  let pw = null
  for (const p of PATHS) {
    try {
      pw = require(p)
      break
    } catch {
      /* يُجرَّب التالي */
    }
  }
  if (!pw) throw new Error('playwright-core غير موجود — عيّن PLAYWRIGHT_PATH')

  const { existsSync } = await import('node:fs')
  const executablePath = BROWSERS.find((b) => existsSync(b))
  return (pw.chromium ?? pw.default.chromium).launch(
    executablePath ? { executablePath } : {},
  )
}

/* ─────────── أدوات مشتركة بين الفحوص ─────────── */

export function reporter() {
  const results = []
  return {
    ok: (name, cond, extra = '') => {
      results.push([cond ? 'PASS' : 'FAIL', name, extra])
      return cond
    },
    /** يطبع الحصيلة ويُنهي العملية بما يناسبها */
    done: () => {
      const fails = results.filter((r) => r[0] === 'FAIL')
      for (const [s, n, e] of results) console.log(`${s}  ${n}${e ? `   ← ${e}` : ''}`)
      console.log(`\n${results.length - fails.length}/${results.length} نجحت`)
      process.exit(fails.length ? 1 : 0)
    },
  }
}

/** يزرع قاعدة بيانات ويفتح التطبيق عليها نظيفاً */
export async function seed(page, db, lang = 'ar') {
  await page.goto(BASE + '/', { waitUntil: 'load' })
  await page.evaluate(
    ([d, l]) => {
      localStorage.setItem('call-rent-investors-db-v1', JSON.stringify(d))
      localStorage.setItem('call-rent-lang', l)
      localStorage.removeItem('call-rent-investors-draft-v1')
      indexedDB.deleteDatabase('call-rent-investors')
    },
    [db, lang],
  )
  await page.reload({ waitUntil: 'load' })
  await page.waitForTimeout(900)
}

/** مستثمر بسيط برأس مال واحد */
export function investor(i, name, capital) {
  return {
    investor: {
      id: `i${i}`, name, phone: '', email: '', nationalId: '',
      joinDate: '2026-01-05', notes: '', active: true, createdAt: '2026-01-05',
    },
    contribution: {
      id: `d${i}`, investorId: `i${i}`, date: '2026-01-05',
      amount: capital, type: 'deposit', source: 'initial', note: '',
    },
  }
}

/** يبني قاعدة من قائمة [اسم، رأس مال] */
export function dbOf(people, profits = []) {
  const built = people.map(([name, capital], i) => investor(i + 1, name, capital))
  return {
    version: 1,
    investors: built.map((b) => b.investor),
    contributions: built.map((b) => b.contribution),
    profits,
    settings: {},
  }
}

/** الانتقال بين صفحات التطبيق بالاسم الظاهر في القائمة */
export const nav = async (page, name) => {
  await page.getByRole('button', { name, exact: true }).first().click()
  await page.waitForTimeout(450)
}

export const openMonth = async (page, month) => {
  await nav(page, 'الأرباح الشهرية')
  await page.locator('input[type="month"]').fill(month)
  await page.waitForTimeout(450)
}

export const fields = (page) => page.locator('.profit-row .unit-input input')
export const values = (page) => fields(page).evaluateAll((e) => e.map((x) => x.value))

/** يحفظ أرباح الشهر ثم يثبّتها من شريط التعديلات المعلّقة */
export const commit = async (page) => {
  await page.getByRole('button', { name: 'حفظ أرباح الشهر' }).first().click()
  await page.waitForTimeout(300)
  const save = page.locator('.pending-bar button', { hasText: 'حفظ التعديلات' })
  if (await save.count()) {
    await save.first().click()
    await page.waitForTimeout(500)
  }
}

/** قيود الأرباح كما استقرّت في التخزين */
export const storedProfits = (page) =>
  page.evaluate(() => {
    const x = JSON.parse(localStorage.getItem('call-rent-investors-db-v1'))
    return (x.data ?? x).profits
  })
