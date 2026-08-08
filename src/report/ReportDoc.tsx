/** مستند التقرير — صفحة A4 واحدة، مضغوطة وجاهزة للتصدير PDF */

import type { PeriodReport, SeriesPoint } from '../lib/calc'
import { annualizeFactor, periodNames } from '../lib/calc'
import type { Settings } from '../types'
import { dateLabel, money, monthLabel, percent, todayIso } from '../lib/format'
import { Wordmark } from '../components/ui'
import { brand } from '../theme/brand'
import signatureImg from '../assets/signature.png'
import stampLogo from '../assets/logo-mark.png'
import { useLang } from '../i18n'
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
  const { t, dir, lang } = useLang()
  const d = t.doc
  const s = settings
  const sym = s.currencySymbol || '$'
  /*
   * اسم الشركة في التقرير بالإنجليزية دائماً مهما كانت لغته: CALL & RENT
   * اسم تجاري مسجَّل لا نصّ يُترجَم — في الترويسة والتوقيع والتذييل معاً.
   */
  const company = s.companyName || brand.name
  const signer = s.signatureName || brand.signature.name
  const signature = s.signatureImage || signatureImg
  const monthsWithData = report.months.filter((m) => m.hasEntry)

  /** يضمن بقاء التقرير في صفحة واحدة مهما طال الجدول */
  const fitRef = useFitToPage<HTMLElement>([report, settings, series])

  return (
    <article className="doc" dir={dir} lang={lang} ref={fitRef}>
      {/* ═══════════ الترويسة المضغوطة ═══════════ */}
      <header className="doc-header">
        <div className="doc-header-top">
          {s.logoDataUrl ? (
            <div className="doc-logo">
              <img src={s.logoDataUrl} alt={d.logoAlt} />
            </div>
          ) : (
            <Wordmark variant="light" className="doc-logo-wordmark" />
          )}

          <div className="doc-head-title">
            <div className="doc-kicker">{d.kicker(periodNames()[report.type])}</div>
            <h1 className="doc-title">{report.investor.name}</h1>
            <div className="doc-subtitle">{d.subtitle(report.label)}</div>
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
            <b>{d.joined}</b> {dateLabel(report.investor.joinDate)}
          </span>
          {report.investor.nationalId && (
            <span>
              <b>{d.idNo}</b> <span className="num">{report.investor.nationalId}</span>
            </span>
          )}
          {report.investor.phone && (
            <span>
              <b>{d.phone}</b> <span className="num">{report.investor.phone}</span>
            </span>
          )}
          {report.investor.email && (
            <span>
              <b>{d.email}</b> <span className="num">{report.investor.email}</span>
            </span>
          )}
          <span>
            <b>{d.account}</b> {report.investor.active ? t.common.active : t.common.inactive}
          </span>
        </div>

        {/* ═══════════ الأرقام الرئيسية ═══════════ */}
        <section className="doc-section">
          <h2 className="doc-section-title">
            {d.summaryOf(report.label)}
            <small>{d.summaryNote}</small>
          </h2>
          <div className="doc-highlights">
            <div className="doc-hl">
              <div className="hl-label">{d.capitalInvested}</div>
              <div className="hl-value">{money(report.closingCapital, sym)}</div>
              <div className="hl-foot">{d.capitalFoot}</div>
            </div>
            <div className="doc-hl feature">
              <div className="hl-label">{d.netProfit}</div>
              <div className="hl-value">{money(report.totalProfit, sym)}</div>
              <div className="hl-foot">{d.netProfitFoot(money(report.paidProfit, sym))}</div>
            </div>
            <div className="doc-hl">
              <div className="hl-label">{d.periodReturn}</div>
              <div className="hl-value">{percent(report.returnPct)}</div>
              <div className="hl-foot">{d.periodReturnFoot}</div>
            </div>
            <div className="doc-hl">
              <div className="hl-label">{d.annualized}</div>
              <div className="hl-value">{percent(report.annualizedPct)}</div>
              <div className="hl-foot">
                {report.type === 'annual'
                  ? d.annualizedFullYear
                  : d.annualizedFactor(annualizeFactor(report.type))}
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════ الرسم البياني ═══════════ */}
        {series.length > 0 && (
          <section className="doc-section">
            <h2 className="doc-section-title">
              {d.chartTitle}
              <small>
                <span className="lg-dot lg-bar" /> {d.legendProfit(sym)} &nbsp;
                <span className="lg-dot lg-line" /> {d.legendPct}
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
            {d.monthlyTitle}
            <small>{d.monthlyNote}</small>
          </h2>
          <table>
            <thead>
              <tr>
                <th>{d.colMonth}</th>
                <th className="num">{d.colCapital(sym)}</th>
                <th className="num">{d.colProfit(sym)}</th>
                <th className="num">{d.colPct}</th>
                <th>{d.colStatus}</th>
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
                      <span className="tag tag-none">{d.tagNone}</span>
                    ) : m.paid ? (
                      <span className="tag tag-paid">{d.tagPaid}</span>
                    ) : (
                      <span className="tag tag-due">{d.tagDue}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>{d.totalOf(report.label)}</td>
                <td className="num">{money(report.averageCapital, '')}</td>
                <td className="num accent">{money(report.totalProfit, '')}</td>
                <td className="num accent">{percent(report.returnPct)}</td>
                <td>{d.monthsRecorded(monthsWithData.length)}</td>
              </tr>
            </tfoot>
          </table>
        </section>

        {/* ═══════════ حركات رأس المال ═══════════ */}
        {report.movements.length > 0 && (
          <section className="doc-section">
            <h2 className="doc-section-title">
              {d.movementsTitle}
              <small>
                {d.movementsNote(money(report.openingCapital, sym), money(report.closingCapital, sym))}
              </small>
            </h2>
            <table>
              <thead>
                <tr>
                  <th>{d.colDate}</th>
                  <th>{d.colKind}</th>
                  <th className="num">{d.colAmount(sym)}</th>
                  <th>{t.invest.colSource}</th>
                  <th>{d.colNotes}</th>
                </tr>
              </thead>
              <tbody>
                {report.movements.map((c) => (
                  <tr key={c.id}>
                    <td>{dateLabel(c.date)}</td>
                    <td>{c.type === 'deposit' ? d.deposit : d.withdrawal}</td>
                    <td className="num">
                      {c.type === 'deposit' ? '+' : '−'} {money(c.amount, '')}
                    </td>
                    <td>
                      {c.type !== 'deposit'
                        ? '—'
                        : c.source === 'profit'
                          ? t.invest.badgeProfit
                          : t.invest.badgeNew}
                    </td>
                    <td>{c.note || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {/* ═══════════ تفصيل الدفعات ═══════════ */}
        {report.tranches.length > 1 && (
          <section className="doc-section">
            <h2 className="doc-section-title">
              {d.tranchesTitle}
              <small>{d.tranchesSub}</small>
            </h2>
            <table>
              <thead>
                <tr>
                  <th>{d.trancheDate}</th>
                  <th className="num">{d.trancheAmount}</th>
                  <th className="num">{d.trancheRemaining}</th>
                  <th className="num">{d.trancheProfit}</th>
                  <th className="num">{d.trancheReturn}</th>
                  <th className="num">{d.trancheMonths}</th>
                </tr>
              </thead>
              <tbody>
                {report.tranches.map((tr) => (
                  <tr key={tr.id} className="tranche-row">
                    <td>{dateLabel(tr.date)}</td>
                    <td className="num">{money(tr.amount, '')}</td>
                    <td className="num">{money(tr.remaining, '')}</td>
                    <td className="num accent">{money(tr.profit, '')}</td>
                    <td className="num accent">{percent(tr.returnPct)}</td>
                    <td className="num">{d.trancheMonthsCount(tr.months)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {/* ═══════════ الملخص التراكمي ═══════════ */}
        <section className="doc-section">
          <h2 className="doc-section-title">
            {d.lifetimeTitle}
            <small>{d.lifetimeNote(dateLabel(todayIso()))}</small>
          </h2>
          <table>
            <tbody>
              <tr>
                <td>{d.totalDeposited}</td>
                <td className="num">{money(report.lifetime.totalDeposited, sym)}</td>
                <td>{d.totalProfit}</td>
                <td className="num">{money(report.lifetime.totalProfit, sym)}</td>
              </tr>
              <tr>
                <td>{d.currentCapital}</td>
                <td className="num">{money(report.lifetime.currentCapital, sym)}</td>
                <td>{d.paidProfit}</td>
                <td className="num">{money(report.lifetime.paidProfit, sym)}</td>
              </tr>
              <tr>
                <td>{d.avgMonthly}</td>
                <td className="num">{percent(report.lifetime.avgMonthlyPct)}</td>
                <td>{d.unpaidProfit}</td>
                <td className="num">{money(report.lifetime.unpaidProfit, sym)}</td>
              </tr>
              {report.lifetime.reinvestedProfit > 0 && (
                <tr>
                  <td>{t.invest.reinvestedStat}</td>
                  <td className="num">{money(report.lifetime.reinvestedProfit, sym)}</td>
                  <td />
                  <td />
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr>
                <td>{d.lifetimeReturn}</td>
                <td className="num accent">{percent(report.lifetime.lifetimeReturnPct)}</td>
                <td>{d.totalValue}</td>
                <td className="num accent">
                  {money(report.lifetime.currentCapital + report.lifetime.unpaidProfit, sym)}
                </td>
              </tr>
            </tfoot>
          </table>
        </section>

        {/* ═══════════ التوقيع والختم ═══════════ */}
        <div className="doc-sign">
          {/* الاسم أولاً ثم التوقيع أسفله فوق سطر الاعتماد */}
          <div className="doc-sign-box">
            <div className="doc-sign-org">{company}</div>
            <div className="doc-sign-name">{signer}</div>
            <div className="doc-sign-title">{s.signatureTitle || d.management}</div>
            <div className="doc-sign-line">
              <img src={signature} alt={d.signatureAlt} className="doc-sign-img" />
            </div>
          </div>

          {/* ختم الاعتماد — الشعار داخل دائرة */}
          <div className="doc-stamp">
            <img src={stampLogo} alt="" className="doc-stamp-logo" />
            <div className="doc-stamp-word">{d.stampWord}</div>
          </div>

          <div className="doc-sign-box">
            <div className="doc-sign-name">{report.investor.name}</div>
            <div className="doc-sign-title">{d.investorAck}</div>
            <div className="doc-sign-line" />
          </div>
        </div>
      </div>

      {/* ═══════════ التذييل ═══════════ */}
      <footer className="doc-footer">
        {/* لا يتبع اتجاه المستند: يُعزَل ليُقرأ لاتينياً في العربية أيضاً */}
        <div dir="ltr" className="doc-footer-brand">
          <b>{company}</b>
          {s.address ? ` — ${s.address}` : ''}
        </div>
        <div className="num doc-footer-contact">
          {[s.phone, s.email, s.website].filter(Boolean).join('  |  ')}
        </div>
        <div>{d.confidential}</div>
      </footer>
    </article>
  )
}
