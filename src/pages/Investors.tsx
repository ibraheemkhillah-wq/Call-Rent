import { useMemo, useState } from 'react'
import { useStore } from '../store'
import { summarizeInvestor } from '../lib/calc'
import { dateLabel, initials, money, percent, todayIso } from '../lib/format'
import { Empty, Field, Modal } from '../components/ui'
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
  const { db, addInvestor, updateInvestor, deleteInvestor, addContribution } = useStore()
  const sym = db.settings.currencySymbol || '$'

  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Investor | null>(null)
  const [form, setForm] = useState({ ...blank })
  /** مبلغ الاستثمار الأولي — يُسجَّل كإيداع عند إنشاء مستثمر جديد */
  const [initialAmount, setInitialAmount] = useState('')
  const [query, setQuery] = useState('')
  const [error, setError] = useState('')

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
      setError('اسم المستثمر مطلوب')
      return
    }
    if (editing) {
      updateInvestor(editing.id, form)
    } else {
      const created = addInvestor(form)
      const amount = Number(initialAmount)
      if (Number.isFinite(amount) && amount > 0) {
        addContribution({
          investorId: created.id,
          date: form.joinDate || todayIso(),
          amount,
          type: 'deposit',
          note: 'الاستثمار الأولي',
        })
      }
    }
    setOpen(false)
  }

  function remove(inv: Investor) {
    const ok = window.confirm(
      `سيتم حذف «${inv.name}» نهائياً مع جميع حركات رأس المال وقيود الأرباح الخاصة به.\n\nهل تريد المتابعة؟`,
    )
    if (ok) deleteInvestor(inv.id)
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>المستثمرون</h1>
          <p>إدارة بيانات المستثمرين ورؤوس أموالهم</p>
        </div>
        <div className="head-actions">
          <button className="btn btn-primary" onClick={openNew}>
            <IconPlus className="btn-icon" />
            إضافة مستثمر
          </button>
        </div>
      </div>

      {db.investors.length > 0 && (
        <div className="toolbar">
          <div className="field" style={{ minWidth: 300 }}>
            <label>بحث</label>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ابحث بالاسم أو الهاتف أو رقم الهوية…"
            />
          </div>
        </div>
      )}

      <div className="card">
        {rows.length === 0 ? (
          <Empty
            icon={<IconUsers size={26} />}
            title={query ? 'لا توجد نتائج مطابقة' : 'لا يوجد مستثمرون بعد'}
            text={
              query
                ? 'جرّب كلمة بحث أخرى.'
                : 'ابدأ بإضافة أول مستثمر وتحديد المبلغ الذي استثمره.'
            }
            action={
              !query && (
                <button className="btn btn-primary" onClick={openNew}>
                  <IconPlus className="btn-icon" />
                  إضافة مستثمر
                </button>
              )
            }
          />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>المستثمر</th>
                  <th>تاريخ الانضمام</th>
                  <th className="num">إجمالي المستثمر</th>
                  <th className="num">رأس المال الحالي</th>
                  <th className="num">الأرباح</th>
                  <th className="num">العائد</th>
                  <th>الحالة</th>
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
                        {s.investor.active ? 'نشط' : 'غير نشط'}
                      </span>
                    </td>
                    <td>
                      <div className="row" style={{ flexWrap: 'nowrap', gap: 4 }}>
                        <button
                          className="btn btn-sm"
                          onClick={() => go({ name: 'investor', id: s.investor.id })}
                        >
                          التفاصيل
                        </button>
                        <button
                          className="icon-btn"
                          title="تعديل"
                          onClick={() => openEdit(s.investor)}
                        >
                          <IconEdit />
                        </button>
                        <button
                          className="icon-btn"
                          title="حذف"
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
          title={editing ? `تعديل بيانات: ${editing.name}` : 'إضافة مستثمر جديد'}
          onClose={() => setOpen(false)}
          footer={
            <>
              <button className="btn btn-primary" onClick={save}>
                {editing ? 'حفظ التعديلات' : 'إضافة المستثمر'}
              </button>
              <button className="btn" onClick={() => setOpen(false)}>
                إلغاء
              </button>
              {error && <span className="neg">{error}</span>}
            </>
          }
        >
          <div className="grid grid-2">
            <Field label="الاسم الكامل *">
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="مثال: أحمد محمد العلي"
                autoFocus
              />
            </Field>
            <Field label="رقم الهاتف">
              <input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="+970 …"
              />
            </Field>
            <Field label="البريد الإلكتروني">
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </Field>
            <Field label="رقم الهوية / جواز السفر">
              <input
                value={form.nationalId}
                onChange={(e) => setForm({ ...form, nationalId: e.target.value })}
              />
            </Field>
            <Field label="تاريخ الانضمام">
              <input
                type="date"
                value={form.joinDate}
                onChange={(e) => setForm({ ...form, joinDate: e.target.value })}
              />
            </Field>
            {!editing && (
              <Field
                label={`مبلغ الاستثمار الأولي (${sym})`}
                hint="يُسجَّل كإيداع بتاريخ الانضمام — يمكن إضافة إيداعات لاحقة من صفحة المستثمر"
              >
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={initialAmount}
                  onChange={(e) => setInitialAmount(e.target.value)}
                  placeholder="0.00"
                />
              </Field>
            )}
          </div>

          <div style={{ marginTop: 14 }}>
            <Field label="ملاحظات">
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="أي تفاصيل خاصة بالاتفاقية أو شروط الاستثمار…"
              />
            </Field>
          </div>

          <label className="checkline" style={{ marginTop: 14 }}>
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
            />
            حساب نشط
          </label>
        </Modal>
      )}
    </>
  )
}
