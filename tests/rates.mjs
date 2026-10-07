/**
 * فحص النسبة الموحّدة والنسب الخاصة.
 *
 * موحّدة تُطبَّق على الجميع، وخاصّةٌ لا تمسّها، وتجاوزٌ صريح يشملها،
 * وإرجاعٌ يُعيد الصفّ إلى الموحّدة — وكلّ ذلك يبقى بعد الحفظ والعودة.
 */
import {
  commit, dbOf, fields, launch, nav, openMonth, reporter, seed, storedProfits, values,
} from './browser.mjs'

const { ok, done } = reporter()
const db = dbOf([['مستثمر 1', 20000], ['مستثمر 2', 30000], ['مستثمر 3', 50000]])

const browser = await launch()
const page = await (await browser.newContext({ viewport: { width: 1280, height: 1000 } })).newPage()
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })

await seed(page, db)


/* ═══ ١) نسبة موحّدة للجميع ═══ */
await openMonth(page, '2026-08')
await page.getByRole('button', { name: 'نسبة', exact: true }).click()
await page.locator('.toolbar input[inputmode=decimal]').fill('2')
await page.getByRole('button', { name: 'طبّق النسبة' }).click()
await page.waitForTimeout(400)

ok('الموحّدة 2% وصلت الجميع', (await values(page)).join('/') === '2/2/2', (await values(page)).join(' / '))
ok('وحدة الجميع نسبة', (await page.locator('.profit-row .unit-btn').allTextContents()).every((x) => x.trim() === '%'), (await page.locator('.profit-row .unit-btn').allTextContents()).join(' / '))
ok('لا تنبيه ما دام لا أحد خارجها', (await page.locator('.shared-note').count()) === 0)

/* ═══ ٢) مستثمر واحد بنسبة خاصة ═══ */
await fields(page).nth(1).fill('3.5')
await page.waitForTimeout(300)
ok('ظهر وسم النسبة الخاصة', (await page.locator('.custom-tag').count()) === 1)
ok('ظهر تنبيه من خرج عن الموحّدة', (await page.locator('.shared-note').count()) === 1,
  await page.locator('.shared-note').innerText().catch(() => ''))

/* الموحّدة تُطبَّق ثانيةً — ولا تمسّ الخاصّة */
await page.locator('.toolbar input[inputmode=decimal]').fill('4')
await page.getByRole('button', { name: 'طبّق النسبة' }).click()
await page.waitForTimeout(400)
ok('الموحّدة الجديدة لم تمسّ الخاصّة', (await values(page)).join('/') === '4/3.5/4',
  (await values(page)).join(' / '))

/* ═══ ٣) الحفظ يحتفظ بالفرق بين المستثمرين ═══ */
await commit(page)
const ps = await storedProfits(page)
const by = (id) => ps.find((p) => p.investorId === id)
ok('المستثمر ١: 4% من 20,000 = 800', by('i1').amount === 800, String(by('i1').amount))
ok('المستثمر ٢: 3.5% من 30,000 = 1,050', by('i2').amount === 1050, String(by('i2').amount))
ok('المستثمر ٣: 4% من 50,000 = 2,000', by('i3').amount === 2000, String(by('i3').amount))
ok('نسبة كل واحد محفوظة معه',
  by('i1').entryPct === 4 && by('i2').entryPct === 3.5 && by('i3').entryPct === 4,
  [by('i1').entryPct, by('i2').entryPct, by('i3').entryPct].join(' / '))

/* ═══ ٤) بعد الخروج والعودة: الموحّدة في خانتها والخاصّة موسومة ═══ */
await nav(page, 'لوحة المعلومات')
await openMonth(page, '2026-08')
ok('القيم كما تُركت', (await values(page)).join('/') === '4/3.5/4', (await values(page)).join(' / '))
ok('الموحّدة عادت إلى خانتها 4',
  (await page.locator('.toolbar input[inputmode=decimal]').inputValue()) === '4',
  await page.locator('.toolbar input[inputmode=decimal]').inputValue())
ok('الخاصّة وحدها موسومة', (await page.locator('.custom-tag').count()) === 1)
const tagRow = await page.locator('.profit-row').nth(1).locator('.custom-tag').count()
ok('والوسم على صاحبه لا على غيره', tagRow === 1, String(tagRow))

/* ═══ ٥) إرجاعه إلى الموحّدة ═══ */
await page.locator('.custom-tag').first().click()
await page.waitForTimeout(400)
ok('رجع إلى الموحّدة 4', (await values(page)).join('/') === '4/4/4', (await values(page)).join(' / '))
ok('واختفى التنبيه', (await page.locator('.shared-note').count()) === 0)

/* ═══ ٦) التجاوز الصريح يشمل الجميع ═══ */
await fields(page).nth(0).fill('9')
await page.waitForTimeout(300)
await page.locator('.toolbar input[inputmode=decimal]').fill('5')
await page.getByRole('button', { name: 'طبّقها على الجميع' }).click()
await page.waitForTimeout(400)
ok('«طبّقها على الجميع» شملت الخاصّة', (await values(page)).join('/') === '5/5/5',
  (await values(page)).join(' / '))
ok('ولم يبقَ وسم خاص', (await page.locator('.custom-tag').count()) === 0)

/* ═══ ٧) توزيع المبلغ يحترم الخاصّ كذلك ═══ */
await openMonth(page, '2026-09')
await page.getByRole('button', { name: 'مبلغ', exact: true }).click()
await page.waitForTimeout(200)
await fields(page).nth(2).fill('1000')
await page.waitForTimeout(300)
await page.locator('.toolbar input[inputmode=decimal]').fill('1000')
await page.getByRole('button', { name: 'وزّع تلقائياً' }).click()
await page.waitForTimeout(400)
// 20k و 30k وحدهما يقتسمان الألف: 400 و 600
ok('المبلغ قُسّم على غير المخصّصين وحدهم',
  (await values(page)).join('/') === '400/600/1000', (await values(page)).join(' / '))

ok('بلا أخطاء في الطرفية', errors.length === 0, errors.slice(0, 3).join(' | '))

await browser.close()
done()
