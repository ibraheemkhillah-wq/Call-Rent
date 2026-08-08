/**
 * إضافة مبلغ استثماري.
 *
 * مدخل واحد لكل مال داخل إلى المحفظة، يسأل أولاً لمن هذا المبلغ: مستثمر
 * جديد يُفتح له ملف، أو مستثمر قائم يُضاف المبلغ فوق دفعاته. في الحالتين
 * ينتهي الأمر إلى إيداع واحد بتاريخه، فيلتقطه محرّك الدفعات كما هو ويحسب
 * عوائده من تاريخه وحده — لا حساب موازٍ ولا مسار ثانٍ للأرقام.
 */

import { useMemo, useState } from 'react'
import { useStore } from '../store'
import { useT } from '../i18n'
import { summarizeInvestor } from '../lib/calc'
import { dateLabel, initials, money, todayIso } from '../lib/format'
import { Field, Modal } from './ui'
import { IconCheck, IconPlus, IconUsers, IconWallet } from './Icons'
import type { Investor } from '../types'

type Step = 'choose' | 'new' | 'old' | 'done'

const blankPerson = {
  name: '',
  phone: '',
  email: '',
  nationalId: '',
  notes: '',
  active: true,
}

export function AddInvestment({
  onClose,
  onOpenInvestor,
}: {
  onClose: () => void
  /** يفتح صفحة المستثمر بعد الإضافة — اختياري */
  onOpenInvestor?: (id: string) => void
}) {
  const t = useT()
  const v = t.invest
  const { db, addInvestor, addContribution } = useStore()
  const sym = db.settings.currencySymbol || '$'

  const [step, setStep] = useState<Step>('choose')
  const [person, setPerson] = useState({ ...blankPerson })
  const [pickedId, setPickedId] = useState('')
  const [query, setQuery] = useState('')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(todayIso())
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState<{ id: string; name: string; amount: number } | null>(null)

  /** ملخّصات المستثمرين — منها رأس المال الحالي وعدد الدفعات السابقة */
  const summaries = useMemo(
    () =>
      db.investors
        .map((i) => summarizeInvestor(i, db.contributions, db.profits))
        .sort((a, b) => b.currentCapital - a.currentCapital),
    [db.investors, db.contributions, db.profits],
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
  const parsed = Number(amount)
  const validAmount = Number.isFinite(parsed) && parsed > 0
  const depositCount = (id: string) =>
    db.contributions.filter((c) => c.investorId === id && c.type === 'deposit').length

  function reset() {
    setPerson({ ...blankPerson })
    setPickedId('')
    setQuery('')
    setAmount('')
    setDate(todayIso())
    setNote('')
    setError('')
  }

  function goChoose() {
    reset()
    setStep('choose')
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
      note: note.trim() || v.noteFirst,
    })
    setDone({ id: created.id, name: created.name, amount: parsed })
    setStep('done')
  }

  function submitOld() {
    if (!picked) return setError(v.errPick)
    if (!validAmount) return setError(v.errAmount)
    if (!date) return setError(v.errDate)

    addContribution({
      investorId: picked.investor.id,
      date,
      amount: parsed,
      type: 'deposit',
      note: note.trim() || v.noteExtra,
    })
    setDone({ id: picked.investor.id, name: picked.investor.name, amount: parsed })
    setStep('done')
  }

  /* ─────────────── الحقول المشتركة بين المسارين ─────────────── */
  const amountFields = (
    <div className="grid grid-2">
      <Field label={v.amount(sym)}>
        <input
          type="number"
          min="0"
          step="0.01"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.00"
        />
      </Field>
      <Field label={v.date}>
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
          placeholder={v.notePlaceholder}
        />
      </Field>
    </div>
  )

  const title =
    step === 'done' ? v.title : step === 'choose' ? v.chooseTitle : v.title

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
              {v.addAnother}
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
              {step === 'new' ? v.submitNew : v.submitOld}
            </button>
            <button className="btn" onClick={goChoose}>
              {v.back}
            </button>
            {error && <span className="neg">{error}</span>}
          </>
        )
      }
    >
      {/* ═══════ الخطوة الأولى: جديد أم قديم ═══════ */}
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

      {/* ═══════ مستثمر قائم ═══════ */}
      {step === 'old' && (
        <>
          <Field label={v.pickLabel}>
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
                {v.pickNoMatch}
              </p>
            ) : (
              matches.map((s) => {
                const n = depositCount(s.investor.id)
                return (
                  <button
                    key={s.investor.id}
                    className={
                      s.investor.id === pickedId ? 'pick-row is-picked' : 'pick-row'
                    }
                    onClick={() => {
                      setPickedId(s.investor.id)
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
          {noteField}

          {/* أثر الإضافة — يُقرأ قبل الحفظ لا بعده */}
          {picked && validAmount && (
            <div className="effect">
              <div className="effect-title">{v.effectTitle}</div>
              <div className="effect-row">
                <span>{v.effectBefore}</span>
                <b className="num">{money(picked.currentCapital, sym)}</b>
              </div>
              <div className="effect-row">
                <span>{v.effectAfter}</span>
                <b className="num accent">{money(picked.currentCapital + parsed, sym)}</b>
              </div>
              <div className="effect-row">
                <span>{v.effectTranche(depositCount(picked.investor.id) + 1)}</span>
                <b className="num">
                  {money(parsed, sym)} — {dateLabel(date)}
                </b>
              </div>
            </div>
          )}

          <p className="hint" style={{ marginTop: 12 }}>
            {v.trancheHint}
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
            {depositCount(done.id) > 1
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
