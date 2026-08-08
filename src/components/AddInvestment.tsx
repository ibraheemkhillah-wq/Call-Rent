/**
 * حركة رأس المال — إضافة مبلغ استثماري أو سحب منه.
 *
 * مدخل واحد لكل مال يدخل المحفظة أو يخرج منها. الإضافة تسأل أولاً لمن
 * هذا المبلغ: مستثمر جديد يُفتح له ملف، أو مستثمر قائم يُضاف فوق دفعاته.
 * السحب يبدأ من اختيار المستثمر مباشرة — لا يُسحب ممّن ليس له رأس مال.
 *
 * في كل الحالات ينتهي الأمر إلى حركة واحدة بتاريخها، فيلتقطها محرّك
 * الدفعات كما هي — لا حساب موازٍ ولا مسار ثانٍ للأرقام.
 */

import { useMemo, useState } from 'react'
import { useStore } from '../store'
import { useT } from '../i18n'
import { summarizeInvestor, trancheBreakdown } from '../lib/calc'
import { dateLabel, initials, money, parseAmount, todayIso } from '../lib/format'
import { Field, Modal } from './ui'
import { IconCheck, IconPlus, IconUsers, IconWallet } from './Icons'
import type { DepositSource, Investor } from '../types'

type Step = 'choose' | 'new' | 'old' | 'done'
type Mode = 'deposit' | 'withdrawal'

const blankPerson = {
  name: '',
  phone: '',
  email: '',
  nationalId: '',
  notes: '',
  active: true,
}

export function AddInvestment({
  mode = 'deposit',
  onClose,
  onOpenInvestor,
}: {
  /** اتجاه الحركة — إضافة افتراضاً */
  mode?: Mode
  onClose: () => void
  /** يفتح صفحة المستثمر بعد الحركة — اختياري */
  onOpenInvestor?: (id: string) => void
}) {
  const t = useT()
  const v = t.invest
  const { db, addInvestor, addContribution } = useStore()
  const sym = db.settings.currencySymbol || '$'
  const isWithdraw = mode === 'withdrawal'

  // السحب لا يمرّ بخطوة الاختيار: لا معنى لسحبٍ من مستثمر لم يوجد بعد
  const [step, setStep] = useState<Step>(isWithdraw ? 'old' : 'choose')
  const [person, setPerson] = useState({ ...blankPerson })
  const [pickedId, setPickedId] = useState('')
  const [query, setQuery] = useState('')
  const [amount, setAmount] = useState('')
  const [source, setSource] = useState<DepositSource>('new')
  const [date, setDate] = useState(todayIso())
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState<{ id: string; name: string; amount: number } | null>(null)

  /** ملخّصات المستثمرين — منها رأس المال الحالي والمستحق من الأرباح */
  const summaries = useMemo(
    () =>
      db.investors
        .map((i) => summarizeInvestor(i, db.contributions, db.profits))
        // السحب يعرض من له رأس مال فقط
        .filter((s) => !isWithdraw || s.currentCapital > 0)
        .sort((a, b) => b.currentCapital - a.currentCapital),
    [db.investors, db.contributions, db.profits, isWithdraw],
  )

  const matches = useMemo(() => {
    const q = query.trim()
    if (!q) return summaries
    return summaries.filter(
      (s) =>
        s.investor.name.includes(q) ||
        s.investor.phone.includes(q) ||
        s.investor.email.includes(q) ||
        s.investor.nationalId.includes(q),
    )
  }, [summaries, query])

  const picked = summaries.find((s) => s.investor.id === pickedId) ?? null
  const parsed = parseAmount(amount)
  const validAmount = Number.isFinite(parsed) && parsed > 0
  const depositCount = (id: string) =>
    db.contributions.filter((c) => c.investorId === id && c.type === 'deposit').length

  /** الدفعات التي سيستهلكها السحب، من الأقدم فالأحدث */
  const withdrawPlan = useMemo(() => {
    if (!isWithdraw || !picked || !validAmount) return []
    const tranches = trancheBreakdown(picked.investor, db.contributions, db.profits)
    let left = parsed
    const plan: { index: number; amount: number }[] = []
    tranches.forEach((tr, i) => {
      if (left <= 0 || tr.remaining <= 0) return
      const take = Math.min(tr.remaining, left)
      left -= take
      plan.push({ index: i + 1, amount: take })
    })
    return plan
  }, [isWithdraw, picked, validAmount, parsed, db.contributions, db.profits])

  function reset() {
    setPerson({ ...blankPerson })
    setPickedId('')
    setQuery('')
    setAmount('')
    setSource('new')
    setDate(todayIso())
    setNote('')
    setError('')
  }

  function goChoose() {
    reset()
    setStep(isWithdraw ? 'old' : 'choose')
  }

  function submitNew() {
    if (!person.name.trim()) return setError(v.errName)
    if (!validAmount) return setError(v.errAmount)
    if (!date) return setError(v.errDate)

    const created: Investor = addInvestor({ ...person, joinDate: date })
    addContribution({
      investorId: created.id,
      date,
      amount: parsed,
      type: 'deposit',
      // أول ما دخل به المستثمر — لا هو إضافة فوق سابق ولا من عوائد لم توجد
      source: 'initial',
      note: note.trim() || v.noteFirst,
    })
    setDone({ id: created.id, name: created.name, amount: parsed })
    setStep('done')
  }

  function submitOld() {
    if (!picked) return setError(v.errPick)
    if (!validAmount) return setError(v.errAmount)
    if (!date) return setError(v.errDate)
    if (isWithdraw && parsed > picked.currentCapital) {
      return setError(v.errTooMuch(money(picked.currentCapital, sym)))
    }

    addContribution({
      investorId: picked.investor.id,
      date,
      amount: parsed,
      type: isWithdraw ? 'withdrawal' : 'deposit',
      ...(isWithdraw ? {} : { source }),
      note: note.trim() || (isWithdraw ? v.noteWithdraw : v.noteExtra),
    })
    setDone({ id: picked.investor.id, name: picked.investor.name, amount: parsed })
    setStep('done')
  }

  /* ─────────────── الحقول المشتركة ─────────────── */
  const amountFields = (
    <div className="grid grid-2">
      <Field label={isWithdraw ? v.withdrawAmount(sym) : v.amount(sym)}>
        <input
          type="text"
          inputMode="decimal"
          value={amount}
          onChange={(e) => {
            setAmount(e.target.value)
            setError('')
          }}
          placeholder="0.00"
        />
      </Field>
      <Field label={isWithdraw ? v.withdrawDate : v.date}>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </Field>
    </div>
  )

  const noteField = (
    <div style={{ marginTop: 14 }}>
      <Field label={v.note}>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={isWithdraw ? v.withdrawNotePlaceholder : v.notePlaceholder}
        />
      </Field>
    </div>
  )

  /* اختيار مصدر المبلغ — للإيداع على مستثمر قائم وحده */
  const owed = picked?.unpaidProfit ?? 0
  const sourcePicker = (
    <div style={{ marginTop: 16 }}>
      <div className="seg-label">{v.sourceLabel}</div>
      <div className="seg seg-3">
        <button
          className={source === 'initial' ? 'seg-btn is-on' : 'seg-btn'}
          onClick={() => setSource('initial')}
        >
          <span className="seg-title">{v.sourceInitial}</span>
          <span className="seg-sub">{v.sourceInitialSub}</span>
        </button>
        <button
          className={source === 'new' ? 'seg-btn is-on' : 'seg-btn'}
          onClick={() => setSource('new')}
        >
          <span className="seg-title">{v.sourceNew}</span>
          <span className="seg-sub">{v.sourceNewSub}</span>
        </button>
        <button
          className={source === 'profit' ? 'seg-btn is-on' : 'seg-btn'}
          onClick={() => setSource('profit')}
        >
          <span className="seg-title">{v.sourceProfit}</span>
          <span className="seg-sub">
            {picked ? v.sourceAvailable(money(owed, sym)) : v.sourceProfitSub}
          </span>
        </button>
      </div>
      {source === 'profit' && (
        <p className="hint" style={{ marginTop: 8 }}>
          {validAmount && parsed > owed ? (
            <span className="warn-text">{v.sourceOver(money(owed, sym))}</span>
          ) : (
            v.sourceNote
          )}
        </p>
      )}
    </div>
  )

  const title = isWithdraw ? v.withdrawTitle : step === 'choose' ? v.chooseTitle : v.title

  return (
    <Modal
      title={title}
      onClose={onClose}
      footer={
        step === 'choose' ? undefined : step === 'done' ? (
          <>
            {onOpenInvestor && done && (
              <button
                className="btn btn-primary"
                onClick={() => {
                  onOpenInvestor(done.id)
                  onClose()
                }}
              >
                {v.goInvestor}
              </button>
            )}
            <button
              className="btn"
              onClick={() => {
                setDone(null)
                goChoose()
              }}
            >
              <IconPlus className="btn-icon" />
              {isWithdraw ? v.withdrawAnother : v.addAnother}
            </button>
            <button className="btn" onClick={onClose}>
              {t.common.close}
            </button>
          </>
        ) : (
          <>
            <button
              className="btn btn-primary"
              onClick={step === 'new' ? submitNew : submitOld}
            >
              {isWithdraw ? v.withdrawSubmit : step === 'new' ? v.submitNew : v.submitOld}
            </button>
            {isWithdraw ? (
              <button className="btn" onClick={onClose}>
                {t.common.cancel}
              </button>
            ) : (
              <button className="btn" onClick={goChoose}>
                {v.back}
              </button>
            )}
            {error && <span className="neg">{error}</span>}
          </>
        )
      }
    >
      {/* ═══════ الخطوة الأولى: جديد أم قائم ═══════ */}
      {step === 'choose' && (
        <>
          <p className="muted" style={{ marginTop: 0 }}>
            {v.chooseSub}
          </p>
          <div className="choice-grid">
            <button
              className="choice"
              onClick={() => {
                reset()
                setStep('new')
              }}
            >
              <span className="choice-mark">
                <IconPlus size={20} />
              </span>
              <span className="choice-title">{v.newCard}</span>
              <span className="choice-sub">{v.newCardSub}</span>
            </button>

            <button
              className="choice"
              disabled={summaries.length === 0}
              onClick={() => {
                reset()
                setStep('old')
              }}
            >
              <span className="choice-mark">
                <IconUsers size={20} />
              </span>
              <span className="choice-title">{v.oldCard}</span>
              <span className="choice-sub">
                {summaries.length === 0 ? v.oldCardNone : v.oldCardSub}
              </span>
            </button>
          </div>
        </>
      )}

      {/* ═══════ مستثمر جديد ═══════ */}
      {step === 'new' && (
        <>
          <div className="grid grid-2">
            <Field label={t.ui.invNameLabel}>
              <input
                value={person.name}
                onChange={(e) => setPerson({ ...person, name: e.target.value })}
                placeholder={t.ui.invNamePlaceholder}
                autoFocus
              />
            </Field>
            <Field label={t.investors.phone}>
              <input
                value={person.phone}
                onChange={(e) => setPerson({ ...person, phone: e.target.value })}
                placeholder={t.ui.invPhonePlaceholder}
              />
            </Field>
            <Field label={t.investors.email}>
              <input
                type="email"
                value={person.email}
                onChange={(e) => setPerson({ ...person, email: e.target.value })}
              />
            </Field>
            <Field label={t.investors.nationalId}>
              <input
                value={person.nationalId}
                onChange={(e) => setPerson({ ...person, nationalId: e.target.value })}
              />
            </Field>
          </div>

          <div style={{ marginTop: 14 }}>{amountFields}</div>
          {noteField}

          <p className="hint" style={{ marginTop: 12 }}>
            {v.firstHint}
          </p>
        </>
      )}

      {/* ═══════ مستثمر قائم — إضافة أو سحب ═══════ */}
      {step === 'old' && (
        <>
          <Field label={isWithdraw ? v.withdrawChoose : v.pickLabel}>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={v.pickSearch}
              autoFocus
            />
          </Field>

          <div className="pick-list">
            {matches.length === 0 ? (
              <p className="muted" style={{ padding: '10px 2px' }}>
                {summaries.length === 0 && isWithdraw ? v.withdrawNone : v.pickNoMatch}
              </p>
            ) : (
              matches.map((s) => {
                const n = depositCount(s.investor.id)
                return (
                  <button
                    key={s.investor.id}
                    className={s.investor.id === pickedId ? 'pick-row is-picked' : 'pick-row'}
                    onClick={() => {
                      setPickedId(s.investor.id)
                      // من لا إيداع له بعد، فهذا استثماره الأوّل
                      setSource(depositCount(s.investor.id) === 0 ? 'initial' : 'new')
                      setError('')
                    }}
                  >
                    <span className="avatar">{initials(s.investor.name)}</span>
                    <span className="pick-text">
                      <span className="pick-name">{s.investor.name}</span>
                      <span className="pick-meta">
                        {v.pickCapital(money(s.currentCapital, sym))}
                        {n > 0 ? ` • ${v.pickTranches(n)}` : ''}
                      </span>
                    </span>
                    {s.investor.id === pickedId && (
                      <span className="pick-check">
                        <IconCheck size={16} />
                      </span>
                    )}
                  </button>
                )
              })
            )}
          </div>

          <div style={{ marginTop: 14 }}>{amountFields}</div>

          {isWithdraw && picked && (
            <button
              className="btn btn-sm"
              style={{ marginTop: 8 }}
              onClick={() => {
                setAmount(String(picked.currentCapital))
                setError('')
              }}
            >
              {v.withdrawAll} — {money(picked.currentCapital, sym)}
            </button>
          )}

          {!isWithdraw && sourcePicker}
          {noteField}

          {/* أثر الحركة — يُقرأ قبل الحفظ لا بعده */}
          {picked && validAmount && (
            <div className="effect">
              <div className="effect-title">{isWithdraw ? v.withdrawEffectTitle : v.effectTitle}</div>
              <div className="effect-row">
                <span>{v.effectBefore}</span>
                <b className="num">{money(picked.currentCapital, sym)}</b>
              </div>
              <div className="effect-row">
                <span>{v.effectAfter}</span>
                <b className="num accent">
                  {money(
                    isWithdraw
                      ? Math.max(picked.currentCapital - parsed, 0)
                      : picked.currentCapital + parsed,
                    sym,
                  )}
                </b>
              </div>

              {isWithdraw ? (
                withdrawPlan.map((p) => (
                  <div className="effect-row" key={p.index}>
                    <span>{v.withdrawEffectFrom}</span>
                    <b className="num">
                      {v.withdrawEffectTranche(p.index, money(p.amount, sym))}
                    </b>
                  </div>
                ))
              ) : (
                <>
                  <div className="effect-row">
                    <span>{v.effectTranche(depositCount(picked.investor.id) + 1)}</span>
                    <b className="num">
                      {money(parsed, sym)} — {dateLabel(date)}
                    </b>
                  </div>
                  {source === 'profit' && (
                    <div className="effect-row">
                      <span>{t.investor.due}</span>
                      <b className="num">
                        {money(owed, sym)} ← {money(Math.max(owed - parsed, 0), sym)}
                      </b>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          <p className="hint" style={{ marginTop: 12 }}>
            {isWithdraw ? v.withdrawHint : v.trancheHint}
          </p>
        </>
      )}

      {/* ═══════ تمّت ═══════ */}
      {step === 'done' && done && (
        <div className="done-box">
          <div className="done-mark">
            <IconCheck size={26} />
          </div>
          <p className="done-text">
            {isWithdraw
              ? v.doneWithdraw(done.name, money(done.amount, sym))
              : depositCount(done.id) > 1
                ? v.doneOld(done.name, money(done.amount, sym))
                : v.doneNew(done.name, money(done.amount, sym))}
          </p>
          <p className="muted num">
            <IconWallet size={14} />{' '}
            {v.doneCapital(
              money(
                summarizeInvestor(
                  db.investors.find((i) => i.id === done.id) as Investor,
                  db.contributions,
                  db.profits,
                ).currentCapital,
                sym,
              ),
            )}
          </p>
        </div>
      )}
    </Modal>
  )
}
