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
    /**
     * ملف نصّي صغير يحمل رقم النسخة المنشورة.
     *
     * فائدته أنه يُقرأ بنقرة واحدة من المتصفح مباشرة، فيفصل فصلاً
     * قاطعاً بين «الخادم يقدّم نسخة قديمة» و«الجهاز يعرض نسخة مخزّنة»
     * — وهما حالتان تبدوان متطابقتين من داخل التطبيق.
     */
    {
      name: 'emit-version-file',
      generateBundle() {
        this.emitFile({ type: 'asset', fileName: 'version.txt', source: `${buildId}\n` })
      },
    },
    react(),
    VitePWA({
      /**
       * ◆ لا تخزين محلي للتطبيق — عمداً.
       *
       * كان التطبيق يخزّن ملفاته ليعمل دون إنترنت، فعلق على أجهزة iOS
       * على نسخة قديمة ورفض تسليم أي تحديث: الملف الذي يقرّر أي نسخة
       * تُعرض كان هو نفسه من ضمن المخزَّن، فلا يُجلب جديده فلا يُكتشف
       * التحديث — حلقة مغلقة لا يكسرها فحص دوري ولا مسح بيانات الموقع.
       *
       * selfDestroying يولّد عامل خدمة مهمته الوحيدة أن يُلغي نفسه
       * ويمحو كل ما خزّنه ثم يعيد تحميل الصفحة. فأي جهاز عالق يتحرّر
       * تلقائياً أول ما يصله هذا الملف، والأجهزة الجديدة لا تخزّن شيئاً
       * أصلاً فتقرأ دائماً من الخادم.
       *
       * الثمن: لا عمل دون إنترنت. وهو ثمن مقبول أمام تطبيق يعرض أرقاماً
       * قديمة لصاحبه دون أن يدري. البيان والأيقونات تبقى، فيبقى التطبيق
       * قابلاً للتثبيت على الشاشة الرئيسية كما هو.
       */
      selfDestroying: true,
      registerType: 'autoUpdate',
      // التسجيل يتم يدوياً في src/lib/pwa.ts
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
