import { useRef, useState } from 'react'
import { useStore } from '../store'
import { Field, Wordmark } from '../components/ui'
import {
  IconDownload,
  IconMoon,
  IconRefresh,
  IconSun,
  IconTrash,
  IconUpload,
} from '../components/Icons'
import { THEME_LABELS, useTheme, type ThemeMode } from '../theme/theme'
import { BUILD_ID, checkForUpdate } from '../lib/pwa'
import defaultSignature from '../assets/signature.png'

export function SettingsPage() {
  const { db, updateSettings, exportJson, importJson, resetAll } = useStore()
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
        ? { text: 'أنت على أحدث نسخة من التطبيق', ok: true }
        : { text: 'تعذّر الفحص — تأكد من الاتصال بالإنترنت', ok: false },
    )
  }

  function onSignature(file: File) {
    if (file.size > 1024 * 1024) {
      setMsg({ text: 'حجم صورة التوقيع كبير — الحد الأقصى 1 ميغابايت', ok: false })
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      updateSettings({ signatureImage: String(reader.result) })
      setMsg({ text: 'تم تحديث صورة التوقيع', ok: true })
    }
    reader.onerror = () => setMsg({ text: 'تعذّرت قراءة الصورة', ok: false })
    reader.readAsDataURL(file)
  }

  function onLogo(file: File) {
    if (file.size > 1024 * 1024) {
      setMsg({ text: 'حجم الشعار كبير — الحد الأقصى 1 ميغابايت', ok: false })
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      updateSettings({ logoDataUrl: String(reader.result) })
      setMsg({ text: 'تم رفع الشعار بنجاح', ok: true })
    }
    reader.onerror = () => setMsg({ text: 'تعذّرت قراءة ملف الشعار', ok: false })
    reader.readAsDataURL(file)
  }

  async function onImport(file: File) {
    try {
      await importJson(file)
      setMsg({ text: 'تم استيراد النسخة الاحتياطية بنجاح', ok: true })
    } catch (err) {
      setMsg({ text: `فشل الاستيراد: ${(err as Error).message}`, ok: false })
    }
  }

  function onReset() {
    const ok = window.confirm(
      'سيتم حذف جميع المستثمرين والأرباح والحركات نهائياً من هذا الجهاز.\n\nننصح بتصدير نسخة احتياطية أولاً. هل تريد المتابعة؟',
    )
    if (ok) {
      resetAll()
      setMsg({ text: 'تم مسح جميع البيانات', ok: true })
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>الإعدادات</h1>
          <p>هوية الشركة، بيانات التقارير، والنسخ الاحتياطي</p>
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
        <div className="card-title">نسخة التطبيق</div>
        <div className="card-sub">
          يُحدَّث التطبيق تلقائياً عند توفّر إصدار جديد. إن لاحظت أن شيئاً لم يتغيّر بعد
          تحديث، اضغط الزر للفحص الفوري.
        </div>
        <div className="row">
          <span className="badge badge-accent num">{BUILD_ID}</span>
          <button className="btn btn-sm" onClick={onCheckUpdate} disabled={checking}>
            <IconRefresh className="btn-icon" />
            {checking ? 'جارٍ الفحص…' : 'التحقق من التحديثات'}
          </button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 22 }}>
        <div className="card-title">وضع العرض</div>
        <div className="card-sub">
          اختر الرؤية المريحة لعينك — الاختيار محفوظ على هذا الجهاز، ولا يؤثر على شكل
          التقارير المصدَّرة (تبقى دائماً على ورق أبيض).
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
              {THEME_LABELS[m]}
              {m === 'system' && mode === 'system' && (
                <span className="muted">({theme === 'light' ? 'نهاري' : 'ليلي'})</span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 22 }}>
        <div className="card-title">هوية الشركة</div>
        <div className="card-sub">تظهر في الشريط الجانبي وفي ترويسة كل تقرير</div>

        <div className="row" style={{ marginBottom: 20, gap: 22 }}>
          {s.logoDataUrl ? (
            <div
              className="brand-mark"
              style={{ width: 76, height: 76, borderRadius: 16, fontSize: 26 }}
            >
              <img src={s.logoDataUrl} alt="الشعار" />
            </div>
          ) : (
            <Wordmark className="brand-logo" />
          )}
          <div>
            <div className="row">
              <button className="btn btn-sm" onClick={() => logoRef.current?.click()}>
                <IconUpload className="btn-icon" />
                {s.logoDataUrl ? 'استبدال الشعار' : 'رفع شعار مخصّص'}
              </button>
              {s.logoDataUrl && (
                <button
                  className="btn btn-sm btn-danger"
                  onClick={() => updateSettings({ logoDataUrl: '' })}
                >
                  العودة للشعار الرسمي
                </button>
              )}
            </div>
            <p className="hint" style={{ marginTop: 8 }}>
              {s.logoDataUrl
                ? 'يُستخدم هذا الشعار بدل الشعار الرسمي المدمج في التطبيق.'
                : 'الشعار الرسمي CALL & RENT مدمج في التطبيق ويظهر تلقائياً — الرفع اختياري.'}{' '}
              يُفضّل PNG بخلفية شفافة، حتى 1 ميغابايت.
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
          <Field label="اسم الشركة بالعربية">
            <input
              value={s.companyNameAr}
              onChange={(e) => updateSettings({ companyNameAr: e.target.value })}
            />
          </Field>
          <Field label="اسم الشركة بالإنجليزية">
            <input
              value={s.companyName}
              onChange={(e) => updateSettings({ companyName: e.target.value })}
            />
          </Field>
          <Field label="السطر التعريفي" hint="يظهر أسفل الشعار في التطبيق والتقارير">
            <input
              value={s.tagline}
              onChange={(e) => updateSettings({ tagline: e.target.value })}
            />
          </Field>
          <Field label="العنوان">
            <input
              value={s.address}
              onChange={(e) => updateSettings({ address: e.target.value })}
            />
          </Field>
          <Field label="رقم الهاتف">
            <input value={s.phone} onChange={(e) => updateSettings({ phone: e.target.value })} />
          </Field>
          <Field label="البريد الإلكتروني">
            <input value={s.email} onChange={(e) => updateSettings({ email: e.target.value })} />
          </Field>
          <Field label="الموقع الإلكتروني">
            <input
              value={s.website}
              onChange={(e) => updateSettings({ website: e.target.value })}
            />
          </Field>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 22 }}>
        <div className="card-title">العملة والتوقيع</div>
        <div className="card-sub">تُستخدم في كل الشاشات والتقارير</div>
        <div className="grid grid-2">
          <Field label="رمز العملة" hint="مثال: $ أو ₪ أو د.إ">
            <input
              value={s.currencySymbol}
              onChange={(e) => updateSettings({ currencySymbol: e.target.value })}
            />
          </Field>
          <Field label="كود العملة" hint="مثال: USD">
            <input
              value={s.currency}
              onChange={(e) => updateSettings({ currency: e.target.value })}
            />
          </Field>
          <Field label="اسم الموقّع على التقارير">
            <input
              value={s.signatureName}
              onChange={(e) => updateSettings({ signatureName: e.target.value })}
              placeholder="الاسم الذي يظهر تحت خط التوقيع"
            />
          </Field>
          <Field label="الصفة الوظيفية">
            <input
              value={s.signatureTitle}
              onChange={(e) => updateSettings({ signatureTitle: e.target.value })}
            />
          </Field>
        </div>

        <div className="divider" />
        <div className="row" style={{ gap: 20 }}>
          <div className="sign-preview">
            <img src={s.signatureImage || defaultSignature} alt="التوقيع" />
          </div>
          <div>
            <div className="row">
              <button className="btn btn-sm" onClick={() => signRef.current?.click()}>
                <IconUpload className="btn-icon" />
                {s.signatureImage ? 'استبدال صورة التوقيع' : 'رفع صورة توقيع'}
              </button>
              {s.signatureImage && (
                <button
                  className="btn btn-sm btn-danger"
                  onClick={() => updateSettings({ signatureImage: '' })}
                >
                  العودة للتوقيع المدمج
                </button>
              )}
            </div>
            <p className="hint" style={{ marginTop: 8 }}>
              تظهر فوق خط التوقيع في كل تقرير. يُفضّل PNG بخلفية شفافة.
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
        <div className="card-title">النسخ الاحتياطي والبيانات</div>
        <div className="card-sub">
          البيانات محفوظة في متصفح هذا الجهاز فقط. صدّر نسخة احتياطية بانتظام واحتفظ بها في مكان
          آمن.
        </div>

        <div className="row">
          <button className="btn btn-primary" onClick={exportJson}>
            <IconDownload className="btn-icon" />
            تصدير نسخة احتياطية
          </button>
          <button className="btn" onClick={() => fileRef.current?.click()}>
            <IconUpload className="btn-icon" />
            استيراد نسخة احتياطية
          </button>
          <span className="spacer" />
          <button className="btn btn-danger" onClick={onReset}>
            <IconTrash className="btn-icon" />
            مسح كل البيانات
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
            <div className="stat-label">المستثمرون</div>
            <div className="stat-value">{db.investors.length}</div>
          </div>
          <div>
            <div className="stat-label">حركات رأس المال</div>
            <div className="stat-value">{db.contributions.length}</div>
          </div>
          <div>
            <div className="stat-label">قيود الأرباح</div>
            <div className="stat-value">{db.profits.length}</div>
          </div>
        </div>
      </div>
    </>
  )
}
