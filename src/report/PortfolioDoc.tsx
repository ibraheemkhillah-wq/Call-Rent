/**
 * تقرير المحفظة — صفحة A4 واحدة تجمع حال المحفظة كلها.
 *
 * تقرير المستثمر يجيب: كم لي؟ وهذا يجيب: أين المحفظة الآن، ومن أين
 * جاءت، وإلى أين تنمو. لذا فيه ما ليس في ذاك: تدفّق رأس المال داخلاً
 * وخارجاً، ونموّ الفترة، وجدول المستثمرين بحصصهم، وعددهم الداخل حديثاً.
 *
 * يُلتقط بالمسار نفسه الذي يلتقط تقرير المستثمر، فالمعاينة والملف
 * المُرسَل مصدرهما واحد — لا نسخة للشاشة وأخرى للإرسال.
 */

import type { PortfolioReport, SeriesPoint } from '../lib/calc'
import { annualizeFactor, periodNames } from '../lib/calc'
import type { Settings } from '../types'
import { count, dateLabel, money, monthLabel, percent, todayIso } from '../lib/format'
import { Wordmark } from '../components/ui'
import { brand } from '../theme/brand'
import signatureImg from '../assets/signature.png'
import stampLogo from '../assets/logo-mark.png'
import { useLang } from '../i18n'
import { PerformanceChart } from './PerformanceChart'
import { useFitToPage } from './useFitToPage'

function serial(r: PortfolioReport): string {
  const code =
    r.type === 'monthly'
      ? `M${String(r.index).padStart(2, '0')}`
      : r.type === 'quarterly'
        ? `Q${r.index}`
        : r.type === 'semiannual'
          ? `H${r.index}`
          : 'FY'
  return `PRT-${r.year}-${code}`
}

export function PortfolioDoc({
  report,
  settings,
  series,
}: {
  report: PortfolioReport
  settings: Settings
  series: SeriesPoint[]
}) {
  const { t, dir, lang } = useLang()
  const d = t.pdoc
  const s = settings
  const sym = s.currencySymbol || '$'
  /* الاسم التجاري بالإنجليزية دائماً — اسم مسجَّل لا نصّ يُترجَم */
  const company = s.companyName || brand.name
  const signer = s.signatureName || brand.signature.name
  const signature = s.signatureImage || signatureImg
  const l = report.lifetime

  const fitRef = useFitToPage<HTMLElement>([report, settings, series])

  return (
    <article className="doc" dir={dir} lang={lang} ref={fitRef}>
      {/* ═══════════ الترويسة ═══════════ */}
      <header className="doc-header">
        <div className="doc-header-top">
          {s.logoDataUrl ? (
            <div className="doc-logo">
              <img src={s.logoDataUrl} alt={t.doc.logoAlt} />
            </div>
          ) : (
            <Wordmark variant="light" className="doc-logo-wordmark" />
          )}

          <div className="doc-head-title">
            <div className="doc-kicker">{d.kicker(periodNames()[report.type])}</div>
            <h1 className="doc-title">{d.title}</h1>
            <div className="doc-subtitle">{d.heading(report.label)}</div>
          </div>

          <div className="doc-meta">
            <div>{serial(report)}</div>
            <div>{dateLabel(todayIso())}</div>
            <div>{s.currency || 'USD'}</div>
          </div>
        </div>
      </header>

      <div className="doc-body">
        {/* ═══════════ شريط الحال العام ═══════════ */}
        <div className="doc-idbar">
          <span>
            <b>{t.dashboard.investorsCount}</b> <span className="num">{count(report.investorCount)}</span>
          </span>
          <span>
            <b>{t.common.active}</b> <span className="num">{count(report.activeCount)}</span>
          </span>
          <span>
            <b>{d.funded}</b> <span className="num">{count(report.fundedCount)}</span>
          </span>
          {l.firstMonth && (
            <span>
              <b>{d.lifetimeTitle}</b> {monthLabel(l.firstMonth)}
            </span>
          )}
          <span>
            <b>{d.monthsRecorded(l.monthsRecorded)}</b>
          </span>
        </div>

        {/* ═══════════ الأرقام الرئيسية ═══════════ */}
        <section className="doc-section">
          <h2 className="doc-section-title">
            {d.heading(report.label)}
            <small>{t.doc.summaryNote}</small>
          </h2>
          <div className="doc-highlights">
            <div className="doc-hl">
              <div className="hl-label">{d.capital}</div>
              <div className="hl-value">{money(report.closingCapital, sym)}</div>
              <div className="hl-foot">{d.capitalFoot(report.fundedCount)}</div>
            </div>
            <div className="doc-hl feature">
              <div className="hl-label">{d.periodProfit}</div>
              <div className="hl-value">{money(report.totalProfit, sym)}</div>
              <div className="hl-foot">{d.periodProfitFoot(money(report.paidProfit, sym))}</div>
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
                  ? t.doc.annualizedFullYear
                  : t.doc.annualizedFactor(annualizeFactor(report.type))}
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════ حركة رأس المال ونموّه ═══════════ */}
        <section className="doc-section">
          <h2 className="doc-section-title">
            {d.flowTitle}
            <small>{d.flowNote}</small>
          </h2>
          <div className="doc-flow">
            <div className="flow-cell">
              <span>{d.deposits}</span>
              <b className="num pos">+ {money(report.deposits, '')}</b>
            </div>
            <div className="flow-cell">
              <span>{d.withdrawals}</span>
              <b className="num neg">− {money(report.withdrawals, '')}</b>
            </div>
            <div className="flow-cell">
              <span>{d.netFlow}</span>
              <b className="num accent">{money(report.netFlow, '')}</b>
            </div>
            <div className="flow-cell">
              <span>{d.growth}</span>
              <b className="num accent">{percent(report.growthPct)}</b>
            </div>
            <div className="flow-cell">
              <span>{d.newInvestors}</span>
              <b className="num">{count(report.newInvestors)}</b>
            </div>
          </div>
          <div className="doc-flow-note num">
            {d.growthFoot(money(report.openingCapital, sym), money(report.closingCapital, sym))}
          </div>
        </section>

        {/* ═══════════ الرسم البياني ═══════════ */}
        {series.length > 0 && (
          <section className="doc-section">
            <h2 className="doc-section-title">
              {t.doc.chartTitle}
              <small>
                <span className="lg-dot lg-bar" /> {t.doc.legendProfit(sym)} &nbsp;
                <span className="lg-dot lg-line" /> {t.doc.legendPct}
              </small>
            </h2>
            <div className="doc-chart-box">
              <PerformanceChart points={series} />
            </div>
          </section>
        )}

        {/* ═══════════ أداء المحفظة شهرياً ═══════════ */}
        <section className="doc-section">
          <h2 className="doc-section-title">
            {d.monthlyTitle}
            <small>{d.monthlyNote}</small>
          </h2>
          <table className="pf-months">
            <thead>
              <tr>
                <th>{d.colMonth}</th>
                <th className="num">{d.colCapital(sym)}</th>
                <th className="num">{d.colProfit(sym)}</th>
                <th className="num">{d.colPct}</th>
                <th className="num">{d.colInvestors}</th>
              </tr>
            </thead>
            <tbody>
              {report.months.map((m) => (
                <tr key={m.month} className={m.hasEntry ? '' : 'is-empty'}>
                  <td>{monthLabel(m.month)}</td>
                  <td className="num">{money(m.capital, '')}</td>
                  <td className="num">{m.hasEntry ? money(m.profit, '') : '—'}</td>
                  <td className="num">{m.hasEntry ? percent(m.pct) : '—'}</td>
                  <td className="num">{count(m.investors)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>{d.totalRow}</td>
                <td className="num">{money(report.averageCapital, '')}</td>
                <td className="num accent">{money(report.totalProfit, '')}</td>
                <td className="num accent">{percent(report.returnPct)}</td>
                <td className="num">{count(report.fundedCount)}</td>
              </tr>
            </tfoot>
          </table>
        </section>

        {/* ═══════════ المستثمرون ═══════════ */}
        <section className="doc-section">
          <h2 className="doc-section-title">
            {d.investorsTitle}
            <small>{d.investorsNote(report.rows.length)}</small>
          </h2>
          <table className="pf-investors">
            <thead>
              <tr>
                <th>{d.colName}</th>
                <th>{d.colSince}</th>
                <th className="num">{d.colDeposited(sym)}</th>
                <th className="num">{t.profits.capital}</th>
                <th className="num">{d.colShare}</th>
                <th className="num">{d.colPeriodProfit(sym)}</th>
                <th className="num">{d.colLifetimeProfit(sym)}</th>
                <th className="num">{d.colReturn}</th>
                <th className="num">{d.colDue(sym)}</th>
              </tr>
            </thead>
            <tbody>
              {report.rows.map((r) => (
                <tr key={r.investor.id} className={r.capital > 0 ? '' : 'is-empty'}>
                  <td>{r.investor.name}</td>
                  <td>{dateLabel(r.firstDeposit)}</td>
                  <td className="num">{money(r.totalDeposited, '')}</td>
                  <td className="num">{money(r.capital, '')}</td>
                  <td className="num">{percent(r.sharePct, 1)}</td>
                  <td className="num">{money(r.periodProfit, '')}</td>
                  <td className="num">{money(r.lifetimeProfit, '')}</td>
                  <td className="num">{percent(r.lifetimeReturnPct)}</td>
                  <td className="num">{money(r.unpaidProfit, '')}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>{d.totalRow}</td>
                <td>—</td>
                <td className="num">{money(l.totalDeposited, '')}</td>
                <td className="num accent">{money(report.closingCapital, '')}</td>
                <td className="num">100%</td>
                <td className="num accent">{money(report.totalProfit, '')}</td>
                <td className="num accent">{money(l.totalProfit, '')}</td>
                <td className="num">{percent(l.returnPct)}</td>
                <td className="num">{money(l.unpaidProfit, '')}</td>
              </tr>
            </tfoot>
          </table>
        </section>

        {/* ═══════════ المحفظة منذ بداية النشاط ═══════════ */}
        <section className="doc-section">
          <h2 className="doc-section-title">
            {d.lifetimeTitle}
            <small>{d.lifetimeNote(dateLabel(todayIso()))}</small>
          </h2>
          <table className="pf-life">
            <tbody>
              <tr>
                <td>{d.totalDeposited}</td>
                <td className="num">{money(l.totalDeposited, sym)}</td>
                <td>{d.totalProfit}</td>
                <td className="num">{money(l.totalProfit, sym)}</td>
              </tr>
              <tr>
                <td>{d.totalWithdrawn}</td>
                <td className="num">{money(l.totalWithdrawn, sym)}</td>
                <td>{d.paidProfit}</td>
                <td className="num">{money(l.paidProfit, sym)}</td>
              </tr>
              {/* متوسط العائد يظهر دائماً؛ والمُعاد استثماره حين يوجد فقط */}
              <tr>
                <td>{d.avgMonthly}</td>
                <td className="num">{percent(l.avgMonthlyPct)}</td>
                <td>{l.reinvestedProfit > 0 ? d.reinvested : ''}</td>
                <td className="num">
                  {l.reinvestedProfit > 0 ? money(l.reinvestedProfit, sym) : ''}
                </td>
              </tr>
              {/*
               * صفّ المستحقّ مُبرَز كاملاً: هذا ما على المحفظة تسليمه
               * لمستثمريها، فيُقرأ بنظرة واحدة كما في تقرير المستثمر.
               */}
              <tr className="due-row">
                <td>{d.currentCapital}</td>
                <td className="num">{money(l.currentCapital, sym)}</td>
                <td className="due-label">{d.unpaidProfit}</td>
                <td className="num due-amount">{money(l.unpaidProfit, sym)}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr>
                <td>{d.lifetimeReturn}</td>
                <td className="num accent">{percent(l.returnPct)}</td>
                <td>{d.totalValue}</td>
                <td className="num accent">
                  {money(l.currentCapital + l.unpaidProfit, sym)}
                </td>
              </tr>
            </tfoot>
          </table>
        </section>

        {/* ═══════════ التوقيع والختم ═══════════ */}
        <div className="doc-sign">
          <div className="doc-sign-box">
            <div className="doc-sign-org">{company}</div>
            <div className="doc-sign-name">{signer}</div>
            <div className="doc-sign-title">{s.signatureTitle || t.doc.management}</div>
            <div className="doc-sign-line">
              <img src={signature} alt={t.doc.signatureAlt} className="doc-sign-img" />
            </div>
          </div>

          <div className="doc-stamp">
            <img src={stampLogo} alt="" className="doc-stamp-logo" />
            <div className="doc-stamp-word">{t.doc.stampWord}</div>
          </div>

          {/* لا خانة استلام هنا: التقرير للمحفظة لا لمستثمر بعينه */}
          <div className="doc-sign-box" />
        </div>
      </div>

      {/* ═══════════ التذييل ═══════════ */}
      <footer className="doc-footer">
        <div dir="ltr" className="doc-footer-brand">
          <b>{company}</b>
          {s.address ? ` — ${s.address}` : ''}
        </div>
        <div className="num doc-footer-contact">
          {[s.phone, s.email, s.website].filter(Boolean).join('  |  ')}
        </div>
        <div>{d.internal}</div>
      </footer>
    </article>
  )
}
