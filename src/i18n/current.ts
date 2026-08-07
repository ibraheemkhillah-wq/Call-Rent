/**
 * اللغة الحالية — مصدر واحد تقرأ منه دوال التنسيق والحساب.
 *
 * لماذا حالة على مستوى الوحدة لا سياق React: دوال مثل money و
 * monthLabel و periodLabel تُستدعى من عشرات المواضع، بعضها خارج شجرة
 * المكوّنات أصلاً (توليد اسم الملف، ترتيب الفترات). تمرير اللغة إلى كل
 * نداء يضخّم الشيفرة بلا فائدة، والتطبيق يعرض لغة واحدة في كل لحظة.
 *
 * إعادة الرسم عند التبديل يتكفّل بها مزوّد اللغة في i18n/index.tsx.
 */

import { ar, en, tr, type Dict, type Lang } from './dict'

const DICTS: Record<Lang, Dict> = { ar, en, tr }

export const LANGS: Lang[] = ['ar', 'en', 'tr']

/** أسماء اللغات بلغتها نفسها — لا تُترجَم */
export const LANG_NAMES: Record<Lang, string> = {
  ar: 'العربية',
  en: 'English',
  tr: 'Türkçe',
}

export const LANG_DIR: Record<Lang, 'rtl' | 'ltr'> = {
  ar: 'rtl',
  en: 'ltr',
  tr: 'ltr',
}

/** رمز المحلّية لتنسيق الأرقام والتواريخ */
export const LANG_LOCALE: Record<Lang, string> = {
  ar: 'ar',
  en: 'en-US',
  tr: 'tr-TR',
}

let current: Lang = 'ar'

export function setCurrentLang(lang: Lang): void {
  current = lang
}

export function currentLang(): Lang {
  return current
}

export function dict(): Dict {
  return DICTS[current]
}

export function isValidLang(value: unknown): value is Lang {
  return typeof value === 'string' && (LANGS as string[]).includes(value)
}
