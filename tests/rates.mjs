/**
 * فحص كتابة المبلغ والنسبة لكل مستثمر.
 *
 * خانتان مكتوبتان: من كتب في إحداهما حُسبت له الأخرى. والنسبة تُوحَّد
 * بضغطة لمن أراد، وتُفرَّق بالكتابة في صفٍّ على حدة لمن أراد — ويبقى
 * لكل مستثمر رقمه بعد الحفظ والعودة.
 */
import {
  commit, dbOf, fields, launch, nav, openMonth, pctFields, pctValues, reporter, seed,
  storedProfits, values,
} from './browser.mjs'

const { ok, done } = reporter()
const db = dbOf([['مستثمر 1', 20000], ['مستثمر 2', 30000], ['مستثمر 3', 50000]])

const browser = await launch()
const page = await (await browser.newContext({ viewport: { width: 1280, height: 1000 } })).newPage()
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })

await seed(page, db)

/* ═══ ١) الخانتان ظاهرتان، وكلٌّ تحسب الأخرى ═══ */
await openMonth(page, '2026-08')
ok('لكل مستثمر خانة مبلغ', (await fields(page).count()) === 3)
ok('ولكل مستثمر خانة نسبة', (await pctFields(page).count()) === 3)

await fields(page).nth(0).fill('500')
await page.waitForTimeout(300)
ok('كتابة المبلغ تحسب النسبة', (await pctValues(page))[0] === '2.5', (await pctValues(page))[0])

await pctFields(page).nth(1).fill('3')
await page.waitForTimeout(300)
ok('كتابة النسبة تحسب المبلغ', (await values(page))[1] === '900', (await values(page))[1])

/* ═══ ٢) نسبة موحّدة بضغطة ═══ */
await page.getByRole('button', { name: 'نسبة', exact: true }).click()
await page.locator('.toolbar input[inputmode=decimal]').fill('2')
await page.getByRole('button', { name: 'طبّق النسبة' }).click()
await page.waitForTimeout(400)
ok('الموحّدة 2% وصلت الجميع', (await pctValues(page)).join('/') === '2/2/2',
  (await pctValues(page)).join(' / '))
ok('ومبالغها حُسبت لكلٍّ من رأس ماله', (await values(page)).join('/') === '400/600/1000',
  (await values(page)).join(' / '))

/* ═══ ٣) ثم تُفرَّق بالكتابة في صفٍّ واحد ═══ */
await pctFields(page).nth(1).fill('3.5')
await page.waitForTimeout(300)
ok('تعديل صفٍّ لا يمسّ غيره', (await pctValues(page)).join('/') === '2/3.5/2',
  (await pctValues(page)).join(' / '))
ok('ومبلغه وحده تغيّر', (await values(page)).join('/') === '400/1050/1000',
  (await values(page)).join(' / '))

/* ═══ ٤) الحفظ يبقي لكلٍّ رقمه ═══ */
await commit(page)
const ps = await storedProfits(page)
const by = (id) => ps.find((p) => p.investorId === id)
ok('المستثمر ١: 2% من 20,000 = 400', by('i1').amount === 400, String(by('i1').amount))
ok('المستثمر ٢: 3.5% من 30,000 = 1,050', by('i2').amount === 1050, String(by('i2').amount))
ok('المستثمر ٣: 2% من 50,000 = 1,000', by('i3').amount === 1000, String(by('i3').amount))
ok('نسبة كلٍّ محفوظة معه',
  by('i1').entryPct === 2 && by('i2').entryPct === 3.5 && by('i3').entryPct === 2,
  [by('i1').entryPct, by('i2').entryPct, by('i3').entryPct].join(' / '))

/* ═══ ٥) بعد الخروج والعودة: لا شيء تغيّر ولا اختلط ═══ */
await nav(page, 'لوحة المعلومات')
await openMonth(page, '2026-08')
ok('النسب كما تُركت', (await pctValues(page)).join('/') === '2/3.5/2',
  (await pctValues(page)).join(' / '))
ok('والمبالغ كما تُركت', (await values(page)).join('/') === '400/1050/1000',
  (await values(page)).join(' / '))

/* ═══ ٦) الكتابة بالمبلغ وحده تُحفظ مبلغاً ═══ */
await fields(page).nth(2).fill('1234.56')
await page.waitForTimeout(300)
await commit(page)
const after = (await storedProfits(page)).find((p) => p.investorId === 'i3')
ok('المبلغ المكتوب يُحفظ كما هو', after.amount === 1234.56, String(after.amount))
ok('ولا تُحفظ له نسبة صورةً', after.entryPct === undefined, String(after.entryPct))

await openMonth(page, '2026-08')
ok('ويعود مبلغاً بعد العودة', (await values(page))[2] === '1234.56', (await values(page))[2])

ok('بلا أخطاء في الطرفية', errors.length === 0, errors.slice(0, 3).join(' | '))

await browser.close()
done()
