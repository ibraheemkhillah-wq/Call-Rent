/**
 * تنبيه واحد أعلى الصفحة حين لا يكون حفظ البيانات مضموناً.
 *
 * المتصفح يُخفي فشل الحفظ: يكتب المستخدم ويضغط «حفظ» ويخرج مطمئناً، ثم
 * يعود بعد أيام فلا يجد شيئاً. فما لا يستطيع التطبيق ضمانه بنفسه يُقال
 * صراحةً وفي وقته: أن الكتابة أخفقت، أو أن البيانات استُعيدت، أو أن
 * النسخة الاحتياطية تقادمت، أو أن iOS سيمحو ما لم يُثبَّت التطبيق.
 *
 * ولا يظهر إلا واحد في المرّة — بترتيب الخطورة — فلا يعتاد المستخدم
 * تجاهُل شريطٍ دائم فيفوته اليوم الذي يعنيه.
 */

import { useState } from 'react'
import { useStore } from '../store'
import { useT } from '../i18n'
import { daysSince, isEmptyDb, isIos, isStandalone, readMeta, writeMeta } from '../lib/persist'
import { IconAlert, IconClose, IconDownload, IconShield } from '../components/Icons'

/** أيام بلا نسخة احتياطية قبل التذكير */
const BACKUP_DAYS = 14
/** أيام قبل إعادة اقتراح التثبيت بعد إخفائه */
const INSTALL_SNOOZE_DAYS = 30

type Kind = 'fail' | 'restored' | 'install' | 'backup'

export function StorageGuard() {
  const { db, storage, exportJson } = useStore()
  const t = useT()
  const g = t.storage

  const [hidden, setHidden] = useState<Kind[]>([])
  const [installSnoozed, setInstallSnoozed] = useState(
    () => daysSince(readMeta().installHintAt) < INSTALL_SNOOZE_DAYS,
  )

  const hasData = !isEmptyDb(db)

  const kind: Kind | null = !storage.ok
    ? 'fail'
    : storage.restored
      ? 'restored'
      : isIos() && !isStandalone() && !installSnoozed
        ? 'install'
        : hasData && storage.backupAgeDays > BACKUP_DAYS
          ? 'backup'
          : null

  if (!kind || hidden.includes(kind)) return null

  function dismiss(k: Kind) {
    if (k === 'install') {
      writeMeta({ installHintAt: new Date().toISOString() })
      setInstallSnoozed(true)
    }
    setHidden((h) => [...h, k])
  }

  const view = {
    fail: {
      tone: 'guard-danger',
      icon: <IconAlert size={19} />,
      title: g.failTitle,
      text: g.failText,
    },
    restored: {
      tone: 'guard-ok',
      icon: <IconShield size={19} />,
      title: g.restoredTitle,
      text: g.restoredText,
    },
    install: {
      tone: 'guard-warn',
      icon: <IconShield size={19} />,
      title: g.installTitle,
      text: `${g.installText} ${g.installSteps}`,
    },
    backup: {
      tone: 'guard-warn',
      icon: <IconShield size={19} />,
      title: g.backupTitle(storage.backupAgeDays),
      text: g.backupText,
    },
  }[kind]

  return (
    <div className={`guard no-print ${view.tone}`} role="status">
      <span className="guard-icon">{view.icon}</span>
      <div className="guard-body">
        <strong>{view.title}</strong>
        <span>{view.text}</span>
      </div>
      {kind !== 'install' && (
        <button className="btn btn-sm" onClick={exportJson}>
          <IconDownload className="btn-icon" />
          {g.backupNow}
        </button>
      )}
      {kind !== 'fail' && (
        <button className="icon-btn guard-close" onClick={() => dismiss(kind)} aria-label={g.dismiss}>
          <IconClose size={17} />
        </button>
      )}
    </div>
  )
}
