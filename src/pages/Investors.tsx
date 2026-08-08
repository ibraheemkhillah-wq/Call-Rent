import { useMemo, useState } from 'react'
import { useStore } from '../store'
import { useT } from '../i18n'
import { summarizeInvestor } from '../lib/calc'
import { dateLabel, initials, money, parseAmount, percent, todayIso } from '../lib/format'
import { Empty, Field, Modal } from '../components/ui'
import { AddInvestment } from '../components/AddInvestment'
import { IconEdit, IconPlus, IconTrash, IconUsers } from '../components/Icons'
import type { Investor } from '../types'
import type { Route } from '../App'

const blank = {
  name: '',
  phone: '',
  email: '',
  nationalId: '',
  joinDate: todayIso(),
  notes: '',
  active: true,
}

export function Investors({ go }: { go: (r: Route) => void }) {
  const t = useT()
  const u = t.ui
  const { db, addInvestor, updateInvestor, deleteInvestor, addContribution } = useStore()
  const sym = db.settings.currencySymbol || '$'

  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Investor | null>(null)
  const [form, setForm] = useState({ ...blank })
  /** مبلغ الاستثمار الأولي — يُسجَّل كإيداع عند إنشاء مستثمر جديد */
  const [initialAmount, setInitialAmount] = useState('')
  const [query, setQuery] = useState('')
  const [error, setError] = useState('')
  const [flow, setFlow] = useState<'deposit' | 'withdrawal' | null>(null)

  const rows = useMemo(() => {
    const list = db.investors.map((i) => summarizeInvestor(i, db.contributions, db.profits))
    const q = query.trim()
    const filtered = q
      ? list.filter(
          (s) =>
            s.investor.name.includes(q) ||
            s.investor.phone.includes(q) ||
            s.investor.email.includes(q) ||
            s.investor.nationalId.includes(q),
        )
      : list
    return filtered.sort((a, b) => b.currentCapital - a.currentCapital)
  }, [db.investors, db.contributions, db.profits, query])

  function openNew() {
    setEditing(null)
    setForm({ ...blank, joinDate: todayIso() })
    setInitialAmount('')
    setError('')
    setOpen(true)
  }

  function openEdit(inv: Investor) {
    setEditing(inv)
    setForm({
      name: inv.name,
      phone: inv.phone,
      email: inv.email,
      nationalId: inv.nationalId,
      joinDate: inv.joinDate,
      notes: inv.notes,
      active: inv.active,
    })
    setInitialAmount('')
    setError('')
    setOpen(true)
  }

  function save() {
    if (!form.name.trim()) {
      setError(t.investors.nameRequired)
      return
    }
    if (editing) {
      updateInvestor(editing.id, form)
    } else {
      const created = addInvestor(form)
      const amount = parseAmount(initialAmount)
      if (Number.isFinite(amount) && amount > 0) {
        addContribution({
          investorId: created.id,
          date: form.joinDate || todayIso(),
          amount,
          type: 'deposit',
          note: u.invInitialInvestment,
        })
      }
    }
    setOpen(false)
  }

  function remove(inv: Investor) {
    const ok = window.confirm(
      u.invConfirmDelete(inv.name),
    )
    if (ok) deleteInvestor(inv.id)
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{t.investors.title}</h1>
          <p>{u.invSubtitle}</p>
        </div>
        <div className="head-actions">
          <button className="btn btn-primary" onClick={() => setFlow('deposit')}>
            <IconPlus className="btn-icon" />
            {t.invest.open}
          </button>
          <button className="btn" onClick={() => setFlow('withdrawal')}>
            {t.invest.withdrawOpen}
          </button>
          <button className="btn" onClick={openNew}>
            {t.investors.add}
          </button>
        </div>
      </div>

      {db.investors.length > 0 && (
        <div className="toolbar">
          <div className="field" style={{ minWidth: 300 }}>
            <label>{t.common.search}</label>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={u.invSearch}
            />
          </div>
        </div>
      )}

      <div className="card">
        {rows.length === 0 ? (
          <Empty
            icon={<IconUsers size={26} />}
            title={query ? u.invNoMatch : t.investors.empty}
            text={
              query
                ? u.invNoMatchText
                : u.invEmptyText
            }
            action={
              !query && (
                <button className="btn btn-primary" onClick={() => setFlow('deposit')}>
                  <IconPlus className="btn-icon" />
                  {t.invest.open}
                </button>
              )
            }
          />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t.profits.investor}</th>
                  <th>{t.investors.joinDate}</th>
                  <th className="num">{u.invColTotalInvested}</th>
                  <th className="num">{u.invColCurrentCapital}</th>
                  <th className="num">{t.investors.profit}</th>
                  <th className="num">{t.investors.returnPct}</th>
                  <th>{t.investors.status}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => (
                  <tr key={s.investor.id}>
                    <td>
                      <div
                        className="person"
                        style={{ cursor: 'pointer' }}
                        onClick={() => go({ name: 'investor', id: s.investor.id })}
                      >
                        <div className="avatar">{initials(s.investor.name)}</div>
                        <div>
                          <div className="person-name">{s.investor.name}</div>
                          <div className="person-meta">
                            {s.investor.phone || s.investor.email || '—'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>{dateLabel(s.investor.joinDate)}</td>
                    <td className="num">{money(s.totalDeposited, sym)}</td>
                    <td className="num accent">{money(s.currentCapital, sym)}</td>
                    <td className="num">{money(s.totalProfit, sym)}</td>
                    <td className="num pos">{percent(s.lifetimeReturnPct)}</td>
                    <td>
                      <span className={s.investor.active ? 'badge badge-success' : 'badge badge-muted'}>
                        {s.investor.active ? t.common.active : t.common.inactive}
                      </span>
                    </td>
                    <td>
                      <div className="row" style={{ flexWrap: 'nowrap', gap: 4 }}>
                        <button
                          className="btn btn-sm"
                          onClick={() => go({ name: 'investor', id: s.investor.id })}
                        >
                          {u.invDetails}
                        </button>
                        <button
                          className="icon-btn"
                          title={t.common.edit}
                          onClick={() => openEdit(s.investor)}
                        >
                          <IconEdit />
                        </button>
                        <button
                          className="icon-btn"
                          title={t.common.delete}
                          onClick={() => remove(s.investor)}
                        >
                          <IconTrash />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {open && (
        <Modal
          title={editing ? u.invEditTitle(editing.name) : u.invAddTitle}
          onClose={() => setOpen(false)}
          footer={
            <>
              <button className="btn btn-primary" onClick={save}>
                {editing ? u.invSaveEdits : u.invAddSubmit}
              </button>
              <button className="btn" onClick={() => setOpen(false)}>
                {t.common.cancel}
              </button>
              {error && <span className="neg">{error}</span>}
            </>
          }
        >
          <div className="grid grid-2">
            <Field label={u.invNameLabel}>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder={u.invNamePlaceholder}
                autoFocus
              />
            </Field>
            <Field label={t.investors.phone}>
              <input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder={u.invPhonePlaceholder}
              />
            </Field>
            <Field label={t.investors.email}>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </Field>
            <Field label={t.investors.nationalId}>
              <input
                value={form.nationalId}
                onChange={(e) => setForm({ ...form, nationalId: e.target.value })}
              />
            </Field>
            <Field label={t.investors.joinDate}>
              <input
                type="date"
                value={form.joinDate}
                onChange={(e) => setForm({ ...form, joinDate: e.target.value })}
              />
            </Field>
            {!editing && (
              <Field
                label={u.invInitialAmount(sym)}
                hint={u.invJoinHint}
              >
                <input
                  type="text"
                  inputMode="decimal"
                  value={initialAmount}
                  onChange={(e) => setInitialAmount(e.target.value)}
                  placeholder="0.00"
                />
              </Field>
            )}
          </div>

          <div style={{ marginTop: 14 }}>
            <Field label={t.investors.notes}>
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder={u.invNotesPlaceholder}
              />
            </Field>
          </div>

          <label className="checkline" style={{ marginTop: 14 }}>
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
            />
            {u.invActiveAccount}
          </label>
        </Modal>
      )}

      {flow && (
        <AddInvestment
          mode={flow}
          onClose={() => setFlow(null)}
          onOpenInvestor={(id) => go({ name: 'investor', id })}
        />
      )}
    </>
  )
}
