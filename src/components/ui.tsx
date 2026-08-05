/** مكوّنات واجهة مشتركة */

import { useEffect, type ReactNode } from 'react'
import { IconClose } from './Icons'

export function Modal({
  title,
  onClose,
  children,
  footer,
}: {
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="إغلاق">
            <IconClose />
          </button>
        </div>
        {children}
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  )
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: ReactNode
}) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
      {hint && <span className="hint">{hint}</span>}
    </div>
  )
}

export function Stat({
  label,
  value,
  foot,
  icon,
  gold,
}: {
  label: string
  value: string
  foot?: string
  icon?: ReactNode
  gold?: boolean
}) {
  return (
    <div className="stat">
      <div className="stat-label">
        {icon}
        {label}
      </div>
      <div className={gold ? 'stat-value gold' : 'stat-value'}>{value}</div>
      {foot && <div className="stat-foot">{foot}</div>}
    </div>
  )
}

export function Empty({
  icon,
  title,
  text,
  action,
}: {
  icon: ReactNode
  title: string
  text: string
  action?: ReactNode
}) {
  return (
    <div className="empty">
      <div className="empty-mark">{icon}</div>
      <h3>{title}</h3>
      <p>{text}</p>
      {action && <div style={{ marginTop: 18 }}>{action}</div>}
    </div>
  )
}

/** شعار الشركة — يعرض الصورة المرفوعة أو الأحرف الأولى */
export function LogoMark({
  logoDataUrl,
  fallback,
  className = 'brand-mark',
}: {
  logoDataUrl: string
  fallback: string
  className?: string
}) {
  return (
    <div className={className}>
      {logoDataUrl ? <img src={logoDataUrl} alt="شعار الشركة" /> : fallback}
    </div>
  )
}
