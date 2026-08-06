/**
 * هوية التطبيق على الشاشة الرئيسية.
 *
 * حين يُضاف التطبيق إلى شاشة الجوال، يقرأ iOS الأيقونة وإعدادات العرض
 * من وسوم <head> الموجودة في الصفحة لحظة الإضافة. وهذه الوسوم مكتوبة
 * أصلاً في index.html — لكنها تضيع حين يُستضاف التطبيق على منصّة تبني
 * هيكل الصفحة بنفسها، فتظهر الأيقونة بشعار المنصّة ويفتح داخل المتصفح
 * بشريط عنوان بدل أن يفتح كتطبيق.
 *
 * الحقن هنا وقت التشغيل يجعل الهوية مضمونة أينما استُضيف التطبيق:
 * شعار الشركة أيقونةً، وفتح بملء الشاشة بلا شريط متصفح.
 */

import appIcon from '../assets/app-icon.png'
import appIconTouch from '../assets/app-icon-touch.png'
import { brand } from '../theme/brand'

const APP_TITLE = 'إدارة المستثمرين'

function put(selector: string, build: () => HTMLElement): void {
  document.head.querySelectorAll(selector).forEach((el) => el.remove())
  document.head.appendChild(build())
}

function meta(name: string, content: string): void {
  put(`meta[name="${name}"]`, () => {
    const el = document.createElement('meta')
    el.name = name
    el.content = content
    return el
  })
}

function link(rel: string, href: string, sizes?: string): void {
  const sel = sizes ? `link[rel="${rel}"][sizes="${sizes}"]` : `link[rel="${rel}"]`
  put(sel, () => {
    const el = document.createElement('link')
    el.rel = rel
    el.href = href
    if (sizes) el.setAttribute('sizes', sizes)
    return el
  })
}

export function setupHomeScreenIdentity(): void {
  try {
    document.title = `${APP_TITLE} — ${brand.name}`

    // أيقونة الشاشة الرئيسية على iOS، وأيقونة التبويب
    link('apple-touch-icon', appIconTouch)
    link('apple-touch-icon', appIcon, '512x512')
    link('icon', appIcon)

    // الفتح كتطبيق بملء الشاشة بلا شريط عنوان
    meta('apple-mobile-web-app-capable', 'yes')
    meta('mobile-web-app-capable', 'yes')
    meta('apple-mobile-web-app-status-bar-style', 'black-translucent')
    meta('apple-mobile-web-app-title', APP_TITLE)
    meta('theme-color', brand.colors.navy)

    /*
     * بيان التطبيق يُبنى في الذاكرة: أندرويد يعتمد عليه في التثبيت،
     * ولا يمكن الاعتماد على وجود ملف مجاور حين تستضيف المنصّة الصفحة.
     */
    const manifest = {
      name: `${brand.name} — ${APP_TITLE}`,
      short_name: 'المستثمرون',
      lang: 'ar',
      dir: 'rtl',
      start_url: '.',
      scope: '.',
      display: 'standalone',
      theme_color: brand.colors.navy,
      background_color: brand.colors.navy900,
      icons: [
        { src: appIcon, sizes: '512x512', type: 'image/png' },
        { src: appIcon, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    }
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(manifest)], { type: 'application/manifest+json' }),
    )
    link('manifest', url)
  } catch {
    /* هوية الشاشة الرئيسية تحسين إضافي — لا يمنع إخفاقها تشغيل التطبيق */
  }
}
