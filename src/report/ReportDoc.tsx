/** مستند التقرير — صفحة A4 واحدة، مضغوطة وجاهزة للتصدير PDF */

import type { PeriodReport, SeriesPoint } from '../lib/calc'
import { PERIOD_NAMES, annualizeFactor } from '../lib/calc'
import type { Settings } from '../types'
import { dateLabel, money, monthLabel, percent, todayIso } from '../lib/format'
import { Wordmark } from '../components/ui'
import { brand } from '../theme/brand'
import signatureImg from '../assets/signature.png'
import stampLogo from '../assets/logo-mark.png'
import { PerformanceChart } from './PerformanceChart'
import { useFitToPage } from './useFitToPage'

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

export function ReportDoc({
  report,
  settings,
  series,
}: {
  report: PeriodReport
  settings: Settings
  series: SeriesPoint[]
}) {
  const s = settings
  const sym = s.currencySymbol || '$'
  const company = s.companyNameAr || s.companyName || 'الشركة'
  const signer = s.signatureName || brand.signature.name
  const signature = s.signatureImage || signatureImg
  const monthsWithData = report.months.filter((m) => m.hasEntry)

  /** يضمن بقاء التقرير في صفحة واحدة مهما طال الجدول */
  const fitRef = useFitToPage<HTMLElement>([report, settings, series])

  return (
    <article className="doc" dir="rtl" lang="ar" ref={fitRef}>
      {/* ═══════════ الترويسة المضغوطة ═══════════ */}
      <header className="doc-header">
        <div className="doc-header-top">
          {s.logoDataUrl ? (
            <div className="doc-logo">
              <img src={s.logoDataUrl} alt="شعار الشركة" />
            </div>
          ) : (
            <Wordmark variant="light" className="doc-logo-wordmark" />
          )}

          <div className="doc-head-title">
            <div className="doc-kicker">تقرير {PERIOD_NAMES[report.type]}</div>
            <h1 className="doc-title">{report.investor.name}</h1>
            <div className="doc-subtitle">بيان الأرباح والعوائد — {report.label}</div>
          </div>

          <div className="doc-meta">
            <div>{serial(report)}</div>
            <div>{dateLabel(todayIso())}</div>
            <div>{s.currency || 'USD'}</div>
          </div>
        </div>
      </header>

      <div className="doc-body">
        {/* ═══════════ شريط بيانات المستثمر ═══════════ */}
        <div className="doc-idbar">
          <span>
            <b>انضم:</b> {dateLabel(report.investor.joinDate)}
          </span>
          {report.investor.nationalId && (
            <span>
              <b>الهوية:</b> <span className="num">{report.investor.nationalId}</span>
            </span>
          )}
          {report.investor.phone && (
            <span>
              <b>الهاتف:</b> <span className="num">{report.investor.phone}</span>
            </span>
          )}
          {report.investor.email && (
            <span>
              <b>البريد:</b> <span className="num">{report.investor.email}</span>
            </span>
          )}
          <span>
            <b>الحساب:</b> {report.investor.active ? 'نشط' : 'غير نشط'}
          </span>
        </div>

        {/* ═══════════ الأرقام الرئيسية ═══════════ */}
        <section className="doc-section">
          <h2 className="doc-section-title">
            ملخص {report.label}
            <small>الأرقام الرئيسية للفترة</small>
          </h2>
          <div className="doc-highlights">
            <div className="doc-hl">
              <div className="hl-label">رأس المال المستثمر</div>
              <div className="hl-value">{money(report.closingCapital, sym)}</div>
              <div className="hl-foot">حتى نهاية الفترة</div>
            </div>
            <div className="doc-hl feature">
              <div className="hl-label">صافي أرباح الفترة</div>
              <div className="hl-value">{money(report.totalProfit, sym)}</div>
              <div className="hl-foot">منها مصروف {money(report.paidProfit, sym)}</div>
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

        {/* ═══════════ الرسم البياني ═══════════ */}
        {series.length > 0 && (
          <section className="doc-section">
            <h2 className="doc-section-title">
              أداء العائد الشهري
              <small>
                <span className="lg-dot lg-bar" /> الربح ({sym}) &nbsp;
                <span className="lg-dot lg-line" /> النسبة المئوية %
              </small>
            </h2>
            <div className="doc-chart-box">
              <PerformanceChart points={series} />
            </div>
          </section>
        )}

        {/* ═══════════ التفصيل الشهري ═══════════ */}
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
                <td className="num accent">{money(report.totalProfit, '')}</td>
                <td className="num accent">{percent(report.returnPct)}</td>
                <td>{monthsWithData.length} شهر مسجّل</td>
              </tr>
            </tfoot>
          </table>
        </section>

        {/* ═══════════ حركات رأس المال ═══════════ */}
        {report.movements.length > 0 && (
          <section className="doc-section">
            <h2 className="doc-section-title">
              حركات رأس المال خلال الفترة
              <small>
                من {money(report.openingCapital, sym)} إلى {money(report.closingCapital, sym)}
              </small>
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
            </table>
          </section>
        )}

        {/* ═══════════ الملخص التراكمي ═══════════ */}
        <section className="doc-section">
          <h2 className="doc-section-title">
            الملخص التراكمي منذ بداية الاستثمار
            <small>حتى {dateLabel(todayIso())}</small>
          </h2>
          <table>
            <tbody>
              <tr>
                <td>إجمالي المبالغ المستثمرة</td>
                <td className="num">{money(report.lifetime.totalDeposited, sym)}</td>
                <td>إجمالي الأرباح المحققة</td>
                <td className="num">{money(report.lifetime.totalProfit, sym)}</td>
              </tr>
              <tr>
                <td>رأس المال القائم حالياً</td>
                <td className="num">{money(report.lifetime.currentCapital, sym)}</td>
                <td>الأرباح المصروفة</td>
                <td className="num">{money(report.lifetime.paidProfit, sym)}</td>
              </tr>
              <tr>
                <td>متوسط العائد الشهري</td>
                <td className="num">{percent(report.lifetime.avgMonthlyPct)}</td>
                <td>الأرباح المستحقة غير المصروفة</td>
                <td className="num">{money(report.lifetime.unpaidProfit, sym)}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr>
                <td>العائد التراكمي على رأس المال</td>
                <td className="num accent">{percent(report.lifetime.lifetimeReturnPct)}</td>
                <td>القيمة الإجمالية (رأس المال + المستحق)</td>
                <td className="num accent">
                  {money(report.lifetime.currentCapital + report.lifetime.unpaidProfit, sym)}
                </td>
              </tr>
            </tfoot>
          </table>
        </section>

        {/* ═══════════ التوقيع والختم ═══════════ */}
        <div className="doc-sign">
          <div className="doc-sign-box">
            <div className="doc-sign-line">
              <img src={signature} alt="التوقيع" className="doc-sign-img" />
            </div>
            <div className="doc-sign-org">{company}</div>
            <div className="doc-sign-name">{signer}</div>
            <div className="doc-sign-title">{s.signatureTitle || 'الإدارة'}</div>
          </div>

          {/* ختم الاعتماد — الشعار داخل دائرة */}
          <div className="doc-stamp">
            <img src={stampLogo} alt="" className="doc-stamp-logo" />
            <div className="doc-stamp-word">معتمد</div>
          </div>

          <div className="doc-sign-box">
            <div className="doc-sign-line" />
            <div className="doc-sign-name">{report.investor.name}</div>
            <div className="doc-sign-title">المستثمر — استلام وعلم</div>
          </div>
        </div>
      </div>

      {/* ═══════════ التذييل ═══════════ */}
      <footer className="doc-footer">
        <div>
          <b>{company}</b>
          {s.address ? ` — ${s.address}` : ''}
        </div>
        <div className="num">{[s.phone, s.email, s.website].filter(Boolean).join('  |  ')}</div>
        <div>مستند سري خاص بالمستثمر المذكور</div>
      </footer>
    </article>
  )
}
