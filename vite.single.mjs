/**
 * بناء نسخة «ملف واحد» من التطبيق.
 *
 *   npm run build:single   →   dist-single/index.html
 *
 * لماذا توجد هذه النسخة أصلاً: النسخة المعتادة تتكوّن من صفحة تستدعي
 * ملفات برنامج وخطوط منفصلة، وأي إخفاق في تحميل ملف واحد منها يُنتج
 * صفحة بيضاء صامتة — وهو ما حدث فعلاً حين احتفظ المتصفح بصفحة قديمة
 * تشير إلى ملفات لم تعد موجودة بعد نشر تحديث.
 *
 * هنا يُدمج كل شيء داخل الصفحة: البرنامج والخطوط والشعار والتوقيع
 * والختم. لا ملفات خارجية إطلاقاً، فلا شيء يمكن أن يفشل تحميله، ولا
 * يبقى أثر لأي نسخة قديمة. تصلح للاستضافة في أي مكان وللفتح مباشرة.
 *
 * الثمن: حجم أكبر عند الفتحة الأولى (نحو ٢ م.ب) لأن الخطوط تُضمَّن
 * بترميز نصّي، ولا تُفصل مكتبات التقارير لتُحمَّل عند الحاجة.
 */

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const buildId = new Date().toISOString().slice(0, 16).replace('T', ' ')

export default defineConfig({
  base: './',
  define: { __BUILD_ID__: JSON.stringify(`${buildId} (ملف واحد)`) },
  build: {
    outDir: 'dist-single',
    emptyOutDir: true,
    // كل الأصول داخل الحزمة: صور وخطوط بلا استثناء
    assetsInlineLimit: () => true,
    cssCodeSplit: false,
    // بلا تقسيم: الاستيراد المؤجَّل يصير جزءاً من الملف نفسه
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
  plugins: [react()],
})
