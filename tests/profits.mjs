/**
 * فحص حساب الأرباح: التوزيع، والتحويل بين المبلغ والنسبة، وقراءة
 * الفاصلة العشرية، وثبات القيمة بعد الخروج من الشاشة والعودة إليها.
 */
import {
  commit, dbOf, fields, launch, nav, openMonth, pctFields, pctValues, reporter, seed,
  storedProfits, values,
} from './browser.mjs'

const { ok, done } = reporter()
const near = (a, b, t = 0.02) => Math.abs(a - b) < t
const db = dbOf([['مستثمر 1', 20000], ['مستثمر 2', 30000], ['مستثمر 3', 50000]])

const browser = await launch()
const page = await (await browser.newContext({ viewport: { width: 1280, height: 1000 } })).newPage()
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })

const load = async () => {
  await seed(page, db)
  await openMonth(page, '2026-03')
}

/* ١) توزيع مبلغ بالحصص */
await load()
await page.locator('.toolbar input[inputmode=decimal]').fill('3000')
await page.getByRole('button', { name: 'وزّع تلقائياً' }).click()
await page.waitForTimeout(400)
let v = await values(page)
ok('3,000 قُسّمت 600/900/1500', v.join('/') === '600/900/1500', v.join(' / '))

await commit(page)
let ps = await storedProfits(page)
ok('حُفظت ثلاثة قيود', ps.length === 3, `${ps.length}`)
ok('مجموع المحفوظ 3,000', near(ps.reduce((s, p) => s + p.amount, 0), 3000))

/* ٢) توزيع بنسبة موحّدة مكتوبة بفاصلة */
await load()
await page.getByRole('button', { name: 'نسبة', exact: true }).click()
await page.waitForTimeout(300)
await page.locator('.toolbar input[inputmode=decimal]').fill('2,5')
await page.getByRole('button', { name: 'طبّق النسبة' }).click()
await page.waitForTimeout(400)
let p = await pctValues(page)
ok('«2,5» تُقرأ 2.5 للجميع', p.every((x) => x === '2.5'), p.join(' / '))
ok('2.5% من 20,000 = 500', (await values(page))[0] === '500', (await values(page))[0])

await commit(page)
ps = await storedProfits(page)
ok('مجموع أرباح النسبة 2,500', near(ps.reduce((s, p) => s + p.amount, 0), 2500))

/* ٣) القيمة لا تتغيّر بالخروج والعودة */
await nav(page, 'لوحة المعلومات')
await openMonth(page, '2026-03')
p = await pctValues(page)
ok('بعد العودة: النسبة كما كُتبت', p.every((x) => x === '2.5'), p.join(' / '))
v = await values(page)
ok('ومبالغها معها', v.join('/') === '500/750/1250', v.join(' / '))

/* ٤) تعديل النسبة يُحدّث مبلغها في الحال */
await pctFields(page).first().fill('4')
await page.waitForTimeout(300)
ok('4% من 20,000 = 800', (await values(page))[0] === '800', (await values(page))[0])

ok('بلا أخطاء في الطرفية', errors.length === 0, errors.slice(0, 3).join(' | '))

await browser.close()
done()
