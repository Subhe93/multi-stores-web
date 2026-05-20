// Definition file — see FaqList.tsx for the RSC boundary rationale.

import type { SectionDefinition } from '../../types';
import { EmbedCode } from './EmbedCode.client';

export const embedCodeSection: SectionDefinition = {
  schema: {
    id: 'embed-code',
    label: { en: 'Embed Code', ar: 'كود مخصّص' },
    icon: 'code',
    category: 'content',
    description: {
      en: 'Paste custom HTML, CSS and JavaScript. Render isolated in a sandboxed iframe (auto-resizing) or inline in the page.',
      ar: 'الصق HTML و CSS و JavaScript مخصّص. اعرضه معزولاً في إطار آمن (يضبط ارتفاعه تلقائياً) أو مضمّناً في الصفحة.',
    },
    translatable: [],
    schema: [
      { key: 'html', type: 'textarea', label: { en: 'HTML', ar: 'HTML' }, description: { en: 'Markup to render.', ar: 'الكود البنائي.' } },
      { key: 'css', type: 'textarea', label: { en: 'CSS', ar: 'CSS' }, description: { en: 'Styles for the markup above.', ar: 'تنسيقات الكود أعلاه.' } },
      { key: 'js', type: 'textarea', label: { en: 'JavaScript', ar: 'JavaScript' }, description: { en: 'Script to run. In isolated mode it runs inside the sandbox.', ar: 'سكربت يُشغّل. في الوضع المعزول يعمل داخل الإطار الآمن.' } },
      {
        key: 'mode',
        type: 'select',
        label: { en: 'Render mode', ar: 'وضع العرض' },
        defaultValue: 'isolated',
        options: [
          { value: 'isolated', label: { en: 'Isolated (sandboxed iframe)', ar: 'معزول (إطار آمن)' } },
          { value: 'inline', label: { en: 'Inline (in page)', ar: 'مضمّن (داخل الصفحة)' } },
        ],
      },
      { key: 'min_height', type: 'number', label: { en: 'Minimum height (px)', ar: 'أدنى ارتفاع (px)' }, min: 0, max: 2000, defaultValue: 0 },
    ],
  },
  Component: EmbedCode,
  defaultSettings: { mode: 'isolated', min_height: 0 },
};
