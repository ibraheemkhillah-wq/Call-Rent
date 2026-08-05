/** أنواع البيانات الأساسية للنظام */

/** شهر بصيغة YYYY-MM — مثال: "2026-03" */
export type MonthKey = string

export interface Investor {
  id: string
  /** الاسم الكامل */
  name: string
  phone: string
  email: string
  /** رقم الهوية / جواز السفر */
  nationalId: string
  /** تاريخ الانضمام ISO: YYYY-MM-DD */
  joinDate: string
  notes: string
  /** مستثمر نشط أم منسحب */
  active: boolean
  createdAt: string
}

/** حركة رأس مال: إيداع (استثمار) أو سحب من رأس المال */
export interface Contribution {
  id: string
  investorId: string
  /** ISO: YYYY-MM-DD */
  date: string
  /** المبلغ بالموجب دائماً — النوع يحدد الاتجاه */
  amount: number
  type: 'deposit' | 'withdrawal'
  note: string
}

/** ربح شهري مُسجَّل يدوياً لمستثمر */
export interface ProfitEntry {
  id: string
  investorId: string
  /** YYYY-MM */
  month: MonthKey
  /** مبلغ الربح لهذا الشهر */
  amount: number
  /** هل تم صرف الربح للمستثمر */
  paid: boolean
  /** تاريخ الصرف ISO */
  paidDate: string
  note: string
}

export interface Settings {
  companyName: string
  companyNameAr: string
  tagline: string
  /** الشعار المرفوع من داخل التطبيق (data URI) — يتجاوز brand.logoSrc */
  logoDataUrl: string
  currency: string
  currencySymbol: string
  phone: string
  email: string
  website: string
  address: string
  /** توقيع/اسم المسؤول أسفل التقرير */
  signatureName: string
  signatureTitle: string
}

export interface Database {
  version: number
  investors: Investor[]
  contributions: Contribution[]
  profits: ProfitEntry[]
  settings: Settings
}

export type PeriodType = 'monthly' | 'quarterly' | 'semiannual' | 'annual'
