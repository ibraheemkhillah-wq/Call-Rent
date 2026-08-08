/**
 * شريط التعديلات المعلّقة.
 *
 * ما يُنفَّذ بنقرة واحدة — تبديل حالة الصرف أو مصدر الدفعة أو حذف سطر أو
 * الكتابة في الإعدادات — لا يُثبَّت في التخزين حتى يُضغط «حفظ التعديلات».
 * يظهر الشريط حين يوجد تعديل معلّق، فيُرى أثر النقرة قبل أن تصير نهائية،
 * ويُتراجَع عنها بضغطة إن كانت خطأً.
 */

import { useEffect, useState } from 'react'
import { useStore } from '../store'
import { useT } from '../i18n'
import { IconCheck, IconClose } from './Icons'

export function PendingBar() {
  const { pendingCount, saveChanges, discardChanges } = useStore()
  const t = useT()
  const p = t.pending
  const [justSaved, setJustSaved] = useState(false)

  useEffect(() => {
    if (!justSaved) return
    const id = setTimeout(() => setJustSaved(false), 2200)
    return () => clearTimeout(id)
  }, [justSaved])

  if (pendingCount === 0 && !justSaved) return null

  if (justSaved) {
    return (
      <div className="pending-bar is-done no-print" role="status">
        <IconCheck size={16} />
        <span className="pending-text">{p.saved}</span>
      </div>
    )
  }

  return (
    <div className="pending-bar no-print" role="status">
      <span className="pending-dot" />
      <span className="pending-text">
        <b>{p.count(pendingCount)}</b>
        <small>{p.note}</small>
      </span>
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
  )
}
