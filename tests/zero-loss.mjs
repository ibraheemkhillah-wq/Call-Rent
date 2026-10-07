/**
 * فحص قيد الصفر والقيد السالب.
 *
 * صفرٌ يُحفظ ويظهر في التقارير قيداً لا فراغاً، وخسارةٌ تُحفظ بالسالب،
 * وحقلٌ يُفرَغ يرفع قيده. وتوزيعٌ بالسالب يُقسَّم بالحصص كالموجب.
 */
import {
  commit, dbOf, fields, launch, nav, openMonth, reporter, seed, storedProfits, values,
} from './browser.mjs'

const { ok, done } = reporter()

const db = dbOf(
  [['نبيلة عوض', 60000], ['أمين عبدالقادر', 40000]],
  [
    { id: 'p1', investorId: 'i1', month: '2026-07', amount: 1200, paid: false, paidDate: '', note: '' },
    { id: 'p2', investorId: 'i2', month: '2026-07', amount: 800, paid: false, paidDate: '', note: '' },
  ],
)

const browser = await launch()
const page = await (await browser.newContext({ viewport: { width: 1280, height: 1000 } })).newPage()
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })

await seed(page, db)

/* ═══ ١) صفر وخسارة يُحفظان ═══ */
await openMonth(page, '2026-08')
await fields(page).nth(0).fill('0')
await fields(page).nth(1).fill('-500')
await page.waitForTimeout(300)

const pcts = await page.locator('.profit-row td[data-label="النسبة"]').allTextContents()
ok('نسبة الصفر تُعرض 0.00% لا شرطة', pcts[0].trim() === '0.00%', pcts[0])
ok('نسبة الخسارة سالبة', pcts[1].trim() === '-1.25%', pcts[1])
ok('خانة الخسارة بلون السالب', (await page.locator('.profit-row td.neg').count()) === 1)

await commit(page)
let ps = await storedProfits(page)
const aug = ps.filter((p) => p.month === '2026-08')
ok('حُفظ قيدان لشهر 8', aug.length === 2, `${aug.length}`)
ok('قيد الصفر محفوظ بقيمة 0', aug.find((p) => p.investorId === 'i1')?.amount === 0,
  String(aug.find((p) => p.investorId === 'i1')?.amount))
ok('قيد الخسارة محفوظ بـ -500', aug.find((p) => p.investorId === 'i2')?.amount === -500,
  String(aug.find((p) => p.investorId === 'i2')?.amount))

/* ═══ ٢) يبقيان بعد الخروج والعودة ═══ */
await nav(page, 'لوحة المعلومات')
await openMonth(page, '2026-08')
let v = await values(page)
ok('بعد العودة: الصفر ما زال 0', v[0] === '0', v[0])
ok('بعد العودة: الخسارة ما زالت -500', v[1] === '-500', v[1])

const badges = await page.locator('.profit-row td[data-label="الصرف"]').allTextContents()
ok('وسم «بلا أرباح» للصفر', badges[0].includes('بلا أرباح'), badges[0])
ok('وسم «خسارة» للسالب', badges[1].includes('خسارة'), badges[1])

/* ═══ ٣) التقرير يعرفهما قيدين ═══ */
/** يفتح تقرير شهر أغسطس 2026 لمستثمرٍ بعينه */
const openReport = async (investorId) => {
  await nav(page, 'التقارير')
  await page.waitForTimeout(500)
  const sels = page.locator('select')
  await sels.nth(0).selectOption(investorId)
  await sels.nth(1).selectOption('monthly')
  await sels.nth(2).selectOption('2026')
  await sels.nth(3).selectOption('8')
  await page.waitForTimeout(800)
  return page.locator('.doc').first().innerText()
}

let doc = await openReport('i1')
ok('التقرير لا يقول «لا يوجد قيد» لشهر 8',
  !/أغسطس 2026[\s\S]{0,40}لا يوجد قيد/.test(doc), doc.match(/أغسطس 2026.*/)?.[0] ?? '')
ok('شهر 8 يظهر بوسم «بلا أرباح»', /أغسطس 2026[\s\S]{0,40}بلا أرباح/.test(doc),
  doc.match(/أغسطس 2026.*/)?.[0] ?? '')

doc = await openReport('i2')
ok('شهر الخسارة يظهر بوسم «خسارة»', /أغسطس 2026[\s\S]{0,40}خسارة/.test(doc),
  doc.match(/أغسطس 2026.*/)?.[0] ?? '')
ok('مبلغ الخسارة سالب في التقرير', doc.includes('-500.00'))
ok('خانة الخسارة ملوّنة في المستند', (await page.locator('.doc td.loss').count()) >= 1)
ok('الرسم البياني بلا قيم فاسدة',
  !(await page.locator('.doc-svg-chart').innerHTML()).includes('NaN'))

/* ═══ ٤) إفراغ حقل يرفع قيده ═══ */
await openMonth(page, '2026-08')
await fields(page).nth(1).fill('')
await commit(page)
ps = await storedProfits(page)
ok('رُفع القيد بعد إفراغ الحقل', ps.filter((p) => p.month === '2026-08').length === 1,
  String(ps.filter((p) => p.month === '2026-08').length))

doc = await openReport('i2')
ok('وعاد التقرير يقول «لا يوجد قيد»', /أغسطس 2026[\s\S]{0,40}لا يوجد قيد/.test(doc),
  doc.match(/أغسطس 2026.*/)?.[0] ?? '')

/* ═══ ٥) توزيع مبلغ سالب بالحصص ═══ */
await openMonth(page, '2026-09')
await page.locator('.toolbar input[inputmode=decimal]').fill('-1000')
await page.getByRole('button', { name: 'وزّع تلقائياً' }).click()
await page.waitForTimeout(400)
v = await values(page)
ok('الخسارة 1,000 قُسّمت 600/400', v[0] === '-600' && v[1] === '-400', v.join(' / '))

ok('بلا أخطاء في الطرفية', errors.length === 0, errors.slice(0, 3).join(' | '))

await browser.close()
done()
