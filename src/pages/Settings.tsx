import { useRef, useState } from 'react'
import { useStore } from '../store'
import { useLang, useT } from '../i18n'
import { LANGS, LANG_NAMES } from '../i18n/current'
import { Field, Wordmark } from '../components/ui'
import {
  IconDownload,
  IconMoon,
  IconRefresh,
  IconSun,
  IconTrash,
  IconUpload,
} from '../components/Icons'
import { themeLabels, useTheme, type ThemeMode } from '../theme/theme'
import { BUILD_ID, checkForUpdate, hardReset } from '../lib/pwa'
import defaultSignature from '../assets/signature.png'

export function SettingsPage() {
  const { db, updateSettings, exportJson, importJson, resetAll } = useStore()
  const t = useT()
  const u = t.ui
  const { lang, setLang } = useLang()
  const { mode, theme, setMode } = useTheme()
  const s = db.settings
  const fileRef = useRef<HTMLInputElement>(null)
  const logoRef = useRef<HTMLInputElement>(null)
  const signRef = useRef<HTMLInputElement>(null)
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const [checking, setChecking] = useState(false)

  async function onCheckUpdate() {
    setChecking(true)
    setMsg(null)
    const result = await checkForUpdate()
    setChecking(false)
    if (result === 'updated') return // تُعاد صفحة التطبيق تلقائياً
    setMsg(
      result === 'latest'
        ? { text: t.settings.upToDate, ok: true }
        : { text: t.settings.checkFailed, ok: false },
    )
  }

  function onSignature(file: File) {
    if (file.size > 1024 * 1024) {
      setMsg({ text: t.settings.signatureTooBig, ok: false })
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      updateSettings({ signatureImage: String(reader.result) })
      setMsg({ text: t.settings.signatureUpdated, ok: true })
    }
    reader.onerror = () => setMsg({ text: t.settings.signatureReadFailed, ok: false })
    reader.readAsDataURL(file)
  }

  function onLogo(file: File) {
    if (file.size > 1024 * 1024) {
      setMsg({ text: t.settings.logoTooBig, ok: false })
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      updateSettings({ logoDataUrl: String(reader.result) })
      setMsg({ text: t.settings.logoUploaded, ok: true })
    }
    reader.onerror = () => setMsg({ text: t.settings.logoReadFailed, ok: false })
    reader.readAsDataURL(file)
  }

  async function onImport(file: File) {
    try {
      await importJson(file)
      setMsg({ text: t.settings.imported, ok: true })
    } catch (err) {
      setMsg({ text: t.settings.importFailed((err as Error).message), ok: false })
    }
  }

  function onReset() {
    const ok = window.confirm(
      t.settings.resetConfirm,
    )
    if (ok) {
      resetAll()
      setMsg({ text: t.settings.resetDone, ok: true })
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{t.settings.title}</h1>
          <p>{t.settings.subtitle}</p>
        </div>
      </div>

      {msg && (
        <div
          className="card"
          style={{
            marginBottom: 18,
            borderColor: msg.ok ? 'rgba(52,163,122,.5)' : 'rgba(217,99,92,.5)',
          }}
        >
          <span className={msg.ok ? 'pos' : 'neg'}>{msg.text}</span>
        </div>
      )}

      <div className="card" style={{ marginBottom: 22 }}>
        <div className="card-title">{t.settings.language}</div>
        <div className="card-sub">{t.settings.languageNote}</div>
        <div className="theme-choice">
          {LANGS.map((l) => (
            <button
              key={l}
              className={lang === l ? 'active' : ''}
              onClick={() => setLang(l)}
              aria-pressed={lang === l}
              lang={l}
            >
              {LANG_NAMES[l]}
            </button>
          ))}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 22 }}>
        <div className="card-title">{t.settings.versionTitle}</div>
        <div className="card-sub">
          {t.settings.versionNote}
          <strong>{t.settings.versionNoteBold}</strong>
        </div>
        <div className="row">
          <span className="badge badge-accent num">{BUILD_ID}</span>
          <button className="btn btn-sm" onClick={onCheckUpdate} disabled={checking}>
            <IconRefresh className="btn-icon" />
            {checking ? t.settings.checking : t.settings.checkUpdates}
          </button>
          <button className="btn btn-sm" onClick={() => void hardReset()}>
            {t.settings.forceUpdate}
          </button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 22 }}>
        <div className="card-title">{t.settings.displayTitle}</div>
        <div className="card-sub">
          {t.settings.displayNote}
        </div>
        <div className="theme-choice">
          {(['light', 'dark', 'system'] as ThemeMode[]).map((m) => (
            <button
              key={m}
              className={mode === m ? 'active' : ''}
              onClick={() => setMode(m)}
              aria-pressed={mode === m}
            >
              {m === 'light' ? <IconSun size={17} /> : m === 'dark' ? <IconMoon size={17} /> : null}
              {themeLabels()[m]}
              {m === 'system' && mode === 'system' && (
                <span className="muted">({theme === 'light' ? t.settings.themeLight : t.settings.themeDark})</span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 22 }}>
        <div className="card-title">{t.settings.brandTitle}</div>
        <div className="card-sub">{t.settings.brandNote}</div>

        <div className="row" style={{ marginBottom: 20, gap: 22 }}>
          {s.logoDataUrl ? (
            <div
              className="brand-mark"
              style={{ width: 76, height: 76, borderRadius: 16, fontSize: 26 }}
            >
              <img src={s.logoDataUrl} alt={u.setLogo} />
            </div>
          ) : (
            <Wordmark className="brand-logo" />
          )}
          <div>
            <div className="row">
              <button className="btn btn-sm" onClick={() => logoRef.current?.click()}>
                <IconUpload className="btn-icon" />
                {s.logoDataUrl ? t.settings.replaceLogo : t.settings.uploadLogo}
              </button>
              {s.logoDataUrl && (
                <button
                  className="btn btn-sm btn-danger"
                  onClick={() => updateSettings({ logoDataUrl: '' })}
                >
                  {t.settings.officialLogo}
                </button>
              )}
            </div>
            <p className="hint" style={{ marginTop: 8 }}>
              {s.logoDataUrl
                ? t.settings.logoHintCustom
                : t.settings.logoHintDefault}{' '}
              {t.settings.logoHintFormat}
            </p>
            <input
              ref={logoRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => e.target.files?.[0] && onLogo(e.target.files[0])}
            />
          </div>
        </div>

        <div className="grid grid-2">
          <Field label={t.settings.companyAr}>
            <input
              value={s.companyNameAr}
              onChange={(e) => updateSettings({ companyNameAr: e.target.value })}
            />
          </Field>
          <Field label={t.settings.companyEn}>
            <input
              value={s.companyName}
              onChange={(e) => updateSettings({ companyName: e.target.value })}
            />
          </Field>
          <Field label={u.setTagline} hint={u.setTaglineHint}>
            <input
              value={s.tagline}
              onChange={(e) => updateSettings({ tagline: e.target.value })}
            />
          </Field>
          <Field label={t.settings.address}>
            <input
              value={s.address}
              onChange={(e) => updateSettings({ address: e.target.value })}
            />
          </Field>
          <Field label={t.investors.phone}>
            <input value={s.phone} onChange={(e) => updateSettings({ phone: e.target.value })} />
          </Field>
          <Field label={t.investors.email}>
            <input value={s.email} onChange={(e) => updateSettings({ email: e.target.value })} />
          </Field>
          <Field label={t.settings.website}>
            <input
              value={s.website}
              onChange={(e) => updateSettings({ website: e.target.value })}
            />
          </Field>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 22 }}>
        <div className="card-title">{u.setCurrencyTitle}</div>
        <div className="card-sub">{u.setCurrencySub}</div>
        <div className="grid grid-2">
          <Field label={t.settings.currencySymbol} hint={u.setCurrencySymbolHint}>
            <input
              value={s.currencySymbol}
              onChange={(e) => updateSettings({ currencySymbol: e.target.value })}
            />
          </Field>
          <Field label={u.setCurrencyCode} hint={u.setCurrencyCodeHint}>
            <input
              value={s.currency}
              onChange={(e) => updateSettings({ currency: e.target.value })}
            />
          </Field>
          <Field label={u.setSignerNameLabel}>
            <input
              value={s.signatureName}
              onChange={(e) => updateSettings({ signatureName: e.target.value })}
              placeholder={u.setSignerPlaceholder}
            />
          </Field>
          <Field label={u.setSignerRole}>
            <input
              value={s.signatureTitle}
              onChange={(e) => updateSettings({ signatureTitle: e.target.value })}
            />
          </Field>
        </div>

        <div className="divider" />
        <div className="row" style={{ gap: 20 }}>
          <div className="sign-preview">
            <img src={s.signatureImage || defaultSignature} alt={u.setSignature} />
          </div>
          <div>
            <div className="row">
              <button className="btn btn-sm" onClick={() => signRef.current?.click()}>
                <IconUpload className="btn-icon" />
                {s.signatureImage ? u.setReplaceSignature : u.setUploadSignature}
              </button>
              {s.signatureImage && (
                <button
                  className="btn btn-sm btn-danger"
                  onClick={() => updateSettings({ signatureImage: '' })}
                >
                  {u.setDefaultSignatureBack}
                </button>
              )}
            </div>
            <p className="hint" style={{ marginTop: 8 }}>
              {u.setSignatureHint2}
            </p>
            <input
              ref={signRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => e.target.files?.[0] && onSignature(e.target.files[0])}
            />
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">{u.setBackupTitle}</div>
        <div className="card-sub">
          {t.settings.backupNote}
        </div>

        <div className="row">
          <button className="btn btn-primary" onClick={exportJson}>
            <IconDownload className="btn-icon" />
            {t.settings.exportBackup}
          </button>
          <button className="btn" onClick={() => fileRef.current?.click()}>
            <IconUpload className="btn-icon" />
            {t.settings.importBackup}
          </button>
          <span className="spacer" />
          <button className="btn btn-danger" onClick={onReset}>
            <IconTrash className="btn-icon" />
            {u.setEraseAll}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            hidden
            onChange={(e) => e.target.files?.[0] && onImport(e.target.files[0])}
          />
        </div>

        <div className="divider" />
        <div className="grid grid-3">
          <div>
            <div className="stat-label">{u.setCountInvestors}</div>
            <div className="stat-value">{db.investors.length}</div>
          </div>
          <div>
            <div className="stat-label">{u.setCountMovements}</div>
            <div className="stat-value">{db.contributions.length}</div>
          </div>
          <div>
            <div className="stat-label">{u.setCountProfits}</div>
            <div className="stat-value">{db.profits.length}</div>
          </div>
        </div>
      </div>
    </>
  )
}
