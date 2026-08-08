/**
 * شريط التعديلات المعلّقة.
 *
 * لا شيء في التطبيق يُكتب في التخزين لحظة عمله: كل تعديل — رقماً كان أو
 * نسبة أو حذفاً أو إضافة — يذهب إلى نسخة عمل، ويُرى أثره في الشاشة، ولا
 * يُثبَّت حتى يُضغط «حفظ التعديلات». فلمسة خاطئة تُمحى بـ«تراجع».
 *
 * الشريط ثابت أسفل كل الصفحات لا في صفحة واحدة، ليُحفظ من حيث كان
 * المستخدم بلا تنقّل. وتُفتح منه قائمة بما سيُحفظ، فيُقرأ قبل أن يُثبَّت.
 */

import { useEffect, useState } from 'react'
import { useStore } from '../store'
import { useT } from '../i18n'
import { IconCheck, IconClose } from './Icons'

export function PendingBar() {
  const { pendingLog, pendingCount, saveChanges, discardChanges } = useStore()
  const t = useT()
  const p = t.pending
  const [open, setOpen] = useState(false)
  const [justSaved, setJustSaved] = useState(false)

  useEffect(() => {
    if (!justSaved) return
    const id = setTimeout(() => setJustSaved(false), 2200)
    return () => clearTimeout(id)
  }, [justSaved])

  // القائمة تُغلق مع آخر تعديل، فلا تبقى مفتوحة فارغة
  useEffect(() => {
    if (pendingCount === 0) setOpen(false)
  }, [pendingCount])

  /*
   * تعديل جديد يلغي رسالة «حُفظت» فوراً: لو بقيت لأخفت الشريطُ تعديلاً
   * معلّقاً حتى تنقضي مهلتها، فيبدو المحفوظ وغيرُ المحفوظ سواءً.
   */
  useEffect(() => {
    if (pendingCount > 0) setJustSaved(false)
  }, [pendingCount])

  if (pendingCount === 0 && !justSaved) return null

  if (pendingCount === 0 && justSaved) {
    return (
      <div className="pending-wrap no-print">
        <div className="pending-bar is-done" role="status">
          <IconCheck size={16} />
          <span className="pending-text">
            <b>{p.saved}</b>
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="pending-wrap no-print">
      {open && (
        <ol className="pending-list">
          {pendingLog.map((item, i) => (
            <li key={`${item.key}-${i}`}>{item.label}</li>
          ))}
        </ol>
      )}

      <div className="pending-bar" role="status">
        <button
          className="pending-summary"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          <span className="pending-dot" />
          <span className="pending-text">
            <b>{p.count(pendingCount)}</b>
            <small>{open ? p.collapse : p.expand}</small>
          </span>
        </button>

        <span className="spacer" />

        <button className="btn btn-sm" onClick={discardChanges}>
          <IconClose />
          {p.discard}
        </button>
        <button
          className="btn btn-sm btn-primary"
          onClick={() => {
            saveChanges()
            setJustSaved(true)
          }}
        >
          <IconCheck className="btn-icon" />
          {p.save}
        </button>
      </div>
    </div>
  )
}
