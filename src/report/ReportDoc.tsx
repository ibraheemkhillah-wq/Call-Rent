/** مستند التقرير الفاخر — صفحة A4 جاهزة للطباعة/التصدير PDF */

import type { PeriodReport } from '../lib/calc'
import { PERIOD_NAMES, annualizeFactor } from '../lib/calc'
import type { Settings } from '../types'
import { dateLabel, initials, money, monthLabel, percent, todayIso } from '../lib/format'
import { usePageSnap } from './usePageSnap'

function serial(r: PeriodReport): string {
  const code =
    r.type === 'monthly'
      ? `M${String(r.index).padStart(2, '0')}`
      : r.type === 'quarterly'
        ? `Q${r.index}`
        : r.type === 'semiannual'
          ? `H${r.index}`
          : 'FY'
  const tail = r.investor.id.replace(/[^a-z0-9]/gi, '').slice(-4).toUpperCase()
  return `RPT-${r.year}-${code}-${tail}`
}

export function ReportDoc({ report, settings }: { report: PeriodReport; settings: Settings }) {
  const s = settings
  const sym = s.currencySymbol || '$'
  const company = s.companyNameAr || s.companyName || 'الشركة'
  const monthsWithData = report.months.filter((m) => m.hasEntry)
  const maxProfit = Math.max(...report.months.map((m) => m.profit), 1)
  const showChart = report.months.length > 1

  /** يجعل ارتفاع المستند مضاعفاً لصفحة A4 حتى يستقر التذييل في أسفل آخر صفحة */
  const docRef = usePageSnap<HTMLElement>([report, settings])

  return (
    <article className="doc" ref={docRef}>
      {/* ─────────── الترويسة ─────────── */}
      <header className="doc-header">
        <div className="doc-header-top">
          <div className="doc-brand">
            <div className="doc-logo">
              {s.logoDataUrl ? (
                <img src={s.logoDataUrl} alt="شعار الشركة" />
              ) : (
                initials(company)
              )}
            </div>
            <div>
              <div className="doc-company">{company}</div>
              {s.tagline && <div className="doc-tagline">{s.tagline}</div>}
            </div>
          </div>
          <div className="doc-meta">
            <div>
              رقم التقرير: <b>{serial(report)}</b>
            </div>
            <div>
              تاريخ الإصدار: <b>{dateLabel(todayIso())}</b>
            </div>
            <div>
              العملة: <b>{s.currency || 'USD'}</b>
            </div>
          </div>
        </div>

        <div className="doc-title-block">
          <div className="doc-kicker">تقرير {PERIOD_NAMES[report.type]}</div>
          <h1 className="doc-title">{report.investor.name}</h1>
          <div className="doc-subtitle">
            بيان الأرباح والعوائد الاستثمارية — {report.label}
          </div>
        </div>
      </header>

      <div className="doc-body">
        {/* ─────────── بيانات المستثمر ─────────── */}
        <section className="doc-section">
          <h2 className="doc-section-title">
            بيانات المستثمر
            <small>معلومات الحساب الاستثماري</small>
          </h2>
          <div className="doc-identity">
            <div className="doc-kv">
              <span className="k">الاسم الكامل</span>
              <span className="v">{report.investor.name}</span>
            </div>
            <div className="doc-kv">
              <span className="k">تاريخ الانضمام</span>
              <span className="v">{dateLabel(report.investor.joinDate)}</span>
            </div>
            <div className="doc-kv">
              <span className="k">رقم الهوية</span>
              <span className="v">{report.investor.nationalId || '—'}</span>
            </div>
            <div className="doc-kv">
              <span className="k">رقم الهاتف</span>
              <span className="v num">{report.investor.phone || '—'}</span>
            </div>
            <div className="doc-kv">
              <span className="k">البريد الإلكتروني</span>
              <span className="v num">{report.investor.email || '—'}</span>
            </div>
            <div className="doc-kv">
              <span className="k">حالة الحساب</span>
              <span className="v">{report.investor.active ? 'نشط' : 'غير نشط'}</span>
            </div>
          </div>
        </section>

        {/* ─────────── أبرز الأرقام ─────────── */}
        <section className="doc-section">
          <h2 className="doc-section-title">
            ملخص {report.label}
            <small>الأرقام الرئيسية للفترة</small>
          </h2>
          <div className="doc-highlights">
            <div className="doc-hl">
              <div className="hl-label">إجمالي رأس المال المستثمر</div>
              <div className="hl-value">{money(report.closingCapital, sym)}</div>
              <div className="hl-foot">حتى نهاية الفترة</div>
            </div>
            <div className="doc-hl feature">
              <div className="hl-label">صافي أرباح الفترة</div>
              <div className="hl-value">{money(report.totalProfit, sym)}</div>
              <div className="hl-foot">
                منها مصروف {money(report.paidProfit, sym)}
              </div>
            </div>
            <div className="doc-hl">
              <div className="hl-label">نسبة العائد للفترة</div>
              <div className="hl-value">{percent(report.returnPct)}</div>
              <div className="hl-foot">على متوسط رأس المال</div>
            </div>
            <div className="doc-hl">
              <div className="hl-label">العائد السنوي المكافئ</div>
              <div className="hl-value">{percent(report.annualizedPct)}</div>
              <div className="hl-foot">
                {report.type === 'annual'
                  ? 'فترة سنوية كاملة'
                  : `× ${annualizeFactor(report.type)} فترة/سنة`}
              </div>
            </div>
          </div>
        </section>

        {/* ─────────── التفصيل الشهري ─────────── */}
        <section className="doc-section">
          <h2 className="doc-section-title">
            التفصيل الشهري
            <small>الربح ونسبته لكل شهر ضمن الفترة</small>
          </h2>
          <table>
            <thead>
              <tr>
                <th>الشهر</th>
                <th className="num">رأس المال ({sym})</th>
                <th className="num">الربح ({sym})</th>
                <th className="num">النسبة الشهرية</th>
                <th>حالة الصرف</th>
              </tr>
            </thead>
            <tbody>
              {report.months.map((m) => (
                <tr key={m.month} className={m.hasEntry ? '' : 'is-empty'}>
                  <td>{monthLabel(m.month)}</td>
                  <td className="num">{money(m.capital, '')}</td>
                  <td className="num">{m.hasEntry ? money(m.profit, '') : '—'}</td>
                  <td className="num">{m.hasEntry ? percent(m.pct) : '—'}</td>
                  <td>
                    {!m.hasEntry ? (
                      <span className="tag tag-none">لا يوجد قيد</span>
                    ) : m.paid ? (
                      <span className="tag tag-paid">مصروف</span>
                    ) : (
                      <span className="tag tag-due">مستحق</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>الإجمالي — {report.label}</td>
                <td className="num">{money(report.averageCapital, '')}</td>
                <td className="num gold">{money(report.totalProfit, '')}</td>
                <td className="num gold">{percent(report.returnPct)}</td>
                <td>{monthsWithData.length} شهر مسجّل</td>
              </tr>
            </tfoot>
          </table>
          <div style={{ marginTop: 6, fontSize: '8pt', color: '#6b7280' }}>
            * قيمة عمود رأس المال في صف الإجمالي تمثّل «متوسط رأس المال» خلال الفترة.
          </div>
        </section>

        {/* ─────────── الرسم البياني ─────────── */}
        {showChart && (
          <section className="doc-section">
            <h2 className="doc-section-title">
              تطوّر الأرباح الشهرية
              <small>بالـ {s.currency || 'USD'}</small>
            </h2>
            <div className="doc-chart">
              {report.months.map((m) => (
                <div className="doc-chart-col" key={m.month}>
                  <div className="doc-chart-val">
                    {m.profit > 0 ? Math.round(m.profit).toLocaleString('en-US') : ''}
                  </div>
                  <div
                    className="doc-chart-bar"
                    style={{ height: `${Math.max((m.profit / maxProfit) * 78, 1)}%` }}
                  />
                  <div className="doc-chart-cap">{monthLabel(m.month).split(' ')[0]}</div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ─────────── حركات رأس المال ─────────── */}
        {report.movements.length > 0 && (
          <section className="doc-section">
            <h2 className="doc-section-title">
              حركات رأس المال خلال الفترة
              <small>الإيداعات والسحوبات</small>
            </h2>
            <table>
              <thead>
                <tr>
                  <th>التاريخ</th>
                  <th>نوع الحركة</th>
                  <th className="num">المبلغ ({sym})</th>
                  <th>ملاحظات</th>
                </tr>
              </thead>
              <tbody>
                {report.movements.map((c) => (
                  <tr key={c.id}>
                    <td>{dateLabel(c.date)}</td>
                    <td>{c.type === 'deposit' ? 'إيداع استثماري' : 'سحب من رأس المال'}</td>
                    <td className="num">
                      {c.type === 'deposit' ? '+' : '−'} {money(c.amount, '')}
                    </td>
                    <td>{c.note || '—'}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td>رأس المال في بداية الفترة</td>
                  <td className="num gold">{money(report.openingCapital, sym)}</td>
                  <td>رأس المال في نهاية الفترة</td>
                  <td className="num gold">{money(report.closingCapital, sym)}</td>
                </tr>
              </tfoot>
            </table>
          </section>
        )}

        {/* ─────────── الملخص التراكمي ─────────── */}
        <section className="doc-section">
          <h2 className="doc-section-title">
            الملخص التراكمي منذ بداية الاستثمار
            <small>حتى {dateLabel(todayIso())}</small>
          </h2>
          <table>
            <thead>
              <tr>
                <th>البيان</th>
                <th className="num">القيمة</th>
                <th>البيان</th>
                <th className="num">القيمة</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>إجمالي المبالغ المستثمرة</td>
                <td className="num">{money(report.lifetime.totalDeposited, sym)}</td>
                <td>إجمالي الأرباح المحققة</td>
                <td className="num">{money(report.lifetime.totalProfit, sym)}</td>
              </tr>
              <tr>
                <td>إجمالي المسحوب من رأس المال</td>
                <td className="num">{money(report.lifetime.totalWithdrawn, sym)}</td>
                <td>الأرباح المصروفة</td>
                <td className="num">{money(report.lifetime.paidProfit, sym)}</td>
              </tr>
              <tr>
                <td>رأس المال القائم حالياً</td>
                <td className="num">{money(report.lifetime.currentCapital, sym)}</td>
                <td>الأرباح المستحقة غير المصروفة</td>
                <td className="num">{money(report.lifetime.unpaidProfit, sym)}</td>
              </tr>
              <tr>
                <td>عدد الأشهر المسجّلة</td>
                <td className="num">{report.lifetime.activeMonths}</td>
                <td>متوسط العائد الشهري</td>
                <td className="num">{percent(report.lifetime.avgMonthlyPct)}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr>
                <td>العائد التراكمي على رأس المال القائم</td>
                <td className="num gold">{percent(report.lifetime.lifetimeReturnPct)}</td>
                <td>القيمة الإجمالية (رأس المال + الأرباح المستحقة)</td>
                <td className="num gold">
                  {money(
                    report.lifetime.currentCapital + report.lifetime.unpaidProfit,
                    sym,
                  )}
                </td>
              </tr>
            </tfoot>
          </table>
        </section>

        {/* ─────────── المنهجية ─────────── */}
        <section className="doc-section">
          <div className="doc-note">
            <b>منهجية الاحتساب:</b> تُحتسب النسبة الشهرية بقسمة ربح الشهر على رأس المال القائم
            في نهاية ذلك الشهر. أما نسبة عائد الفترة فتُحتسب بقسمة إجمالي أرباح الفترة على
            متوسط رأس المال خلال أشهرها، ويُستخرج «العائد السنوي المكافئ» بضرب عائد الفترة في
            عدد الفترات المماثلة ضمن السنة الواحدة. جميع المبالغ بعملة {s.currency || 'USD'}.
          </div>
        </section>

        {/* ─────────── التوقيع ─────────── */}
        <div className="doc-sign">
          <div className="doc-sign-box">
            <div className="doc-sign-line" />
            <div className="doc-sign-name">{s.signatureName || company}</div>
            <div className="doc-sign-title">{s.signatureTitle || 'الإدارة'}</div>
          </div>
          <div className="doc-stamp">
            <div>
              {company}
              <br />
              معتمد
            </div>
          </div>
          <div className="doc-sign-box">
            <div className="doc-sign-line" />
            <div className="doc-sign-name">{report.investor.name}</div>
            <div className="doc-sign-title">المستثمر — استلام وعلم</div>
          </div>
        </div>

        <div className="doc-confid">
          هذا المستند سري ومخصص للمستثمر المذكور أعلاه فقط، ولا يجوز تداوله أو نسخه دون إذن خطي.
        </div>
      </div>

      {/* ─────────── التذييل ─────────── */}
      <footer className="doc-footer">
        <div>
          <b>{company}</b>
          {s.address ? ` — ${s.address}` : ''}
        </div>
        <div className="num">
          {[s.phone, s.email, s.website].filter(Boolean).join('  |  ')}
        </div>
        <div>
          {PERIOD_NAMES[report.type]} • {report.label}
        </div>
      </footer>
    </article>
  )
}
