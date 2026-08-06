import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

/**
 * مسار النشر. على GitHub Pages يكون التطبيق تحت /Call-Rent/،
 * لذا يضبط سير العمل المتغيّر VITE_BASE. محلياً يبقى الجذر.
 */
const base = process.env.VITE_BASE || '/'

/** معرّف النسخة — يظهر في الإعدادات ليعرف المستخدم أنه على آخر إصدار */
const buildId = new Date().toISOString().slice(0, 16).replace('T', ' ')

export default defineConfig({
  base,
  define: {
    __BUILD_ID__: JSON.stringify(buildId),
  },
  build: {
    /*
     * تُضمَّن صور الهوية والتوقيع داخل الحزمة كـ data URI بدل روابط ملفات.
     * السبب: توليد ملف PDF يلتقط الصفحة عبر SVG foreignObject، وأي صورة
     * برابط خارجي تحتاج جلباً قد يفشل أو يتأخر فتختفي من الملف الناتج.
     * الخطوط تبقى ملفات منفصلة (السلوك الافتراضي) حتى لا تتضخّم الحزمة.
     */
    assetsInlineLimit(filePath) {
      if (/\.png$/i.test(filePath)) return true
      return undefined
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // التسجيل يتم يدوياً في src/lib/pwa.ts لإضافة فحص دوري للتحديثات
      injectRegister: null,
      includeAssets: ['apple-touch-icon.png', 'favicon-64.png'],
      manifest: {
        name: 'CALL & RENT — إدارة المستثمرين',
        short_name: 'المستثمرون',
        description:
          'إدارة المستثمرين ورؤوس أموالهم، احتساب الأرباح الشهرية، وإصدار التقارير بصيغة PDF',
        lang: 'ar',
        dir: 'rtl',
        start_url: '.',
        scope: '.',
        display: 'standalone',
        orientation: 'any',
        theme_color: '#182B56',
        background_color: '#0A1226',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // الخطوط العربية كبيرة نسبياً — ترفع الحد حتى تُخزَّن كلها للعمل دون إنترنت
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        globPatterns: ['**/*.{js,css,html,png,svg,woff2}'],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
      },
    }),
  ],
  server: { host: true, port: 5173 },
})
