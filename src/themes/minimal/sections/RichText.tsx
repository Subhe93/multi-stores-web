import type { SectionDefinition, SectionRenderProps } from '../../types';

function RichText({ settings, content }: SectionRenderProps) {
  const html = (content.html as string) || '';
  const heading = (content.heading as string) || '';
  const eyebrow = (content.eyebrow as string) || '';
  const width = (settings.width as 'narrow' | 'normal' | 'wide') || 'normal';
  const alignment = (settings.alignment as 'left' | 'center') || 'left';
  const padding = (settings.padding as 'none' | 'small' | 'medium' | 'large') || 'medium';
  const surface = settings.surface === true;

  const widthClass =
    width === 'narrow' ? 'max-w-2xl' : width === 'wide' ? 'max-w-5xl' : 'max-w-3xl';
  const padClass =
    padding === 'none' ? '' : padding === 'small' ? 'py-6' : padding === 'large' ? 'py-20' : 'py-12';

  return (
    <section className={padClass}>
      <div
        className={`${widthClass} mx-auto ${alignment === 'center' ? 'text-center' : ''} ${
          surface ? 'p-8' : ''
        }`}
        style={
          surface
            ? {
                backgroundColor: 'var(--theme-colors-surface)',
                border: '1px solid var(--theme-colors-border)',
                borderRadius: 'var(--theme-radius-md)',
              }
            : undefined
        }
      >
        {eyebrow && (
          <p
            className="text-xs font-semibold uppercase tracking-[0.2em] mb-3"
            style={{ color: 'var(--theme-colors-accent)' }}
          >
            {eyebrow}
          </p>
        )}
        {heading && (
          <h2
            className="mb-5"
            style={{
              fontFamily: 'var(--theme-font-heading)',
              fontSize: 'var(--theme-scale-h2)',
              fontWeight: 'var(--theme-weight-heading)',
              lineHeight: 'var(--theme-line-heading)',
              color: 'var(--theme-colors-text)',
            }}
          >
            {heading}
          </h2>
        )}
        {html && (
          <div
            className="prose prose-lg max-w-none [&_a]:text-[var(--theme-colors-primary)] [&_strong]:text-[var(--theme-colors-text)]"
            style={{ color: 'var(--theme-colors-text)' }}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        )}
      </div>
    </section>
  );
}

export const richTextSection: SectionDefinition = {
  schema: {
    id: 'rich-text',
    label: { en: 'Rich Text', ar: 'نص منسّق' },
    icon: 'text',
    category: 'content',
    description: {
      en: 'Long-form content with optional eyebrow, heading, and surface card style.',
      ar: 'محتوى مطوّل مع تسمية صغيرة وعنوان وخيار البطاقة الملوّنة.',
    },
    translatable: ['eyebrow', 'heading', 'html'],
    schema: [
      { key: 'eyebrow', type: 'text', label: { en: 'Eyebrow (small label)', ar: 'تسمية صغيرة' } },
      { key: 'heading', type: 'text', label: { en: 'Heading', ar: 'العنوان' } },
      { key: 'html', type: 'richtext', label: { en: 'Content', ar: 'المحتوى' } },
      {
        key: 'width',
        type: 'select',
        label: { en: 'Content width', ar: 'عرض المحتوى' },
        defaultValue: 'normal',
        options: [
          { value: 'narrow', label: { en: 'Narrow', ar: 'ضيّق' } },
          { value: 'normal', label: { en: 'Normal', ar: 'عادي' } },
          { value: 'wide', label: { en: 'Wide', ar: 'واسع' } },
        ],
      },
      {
        key: 'alignment',
        type: 'select',
        label: { en: 'Alignment', ar: 'المحاذاة' },
        defaultValue: 'left',
        options: [
          { value: 'left', label: { en: 'Left', ar: 'يسار' } },
          { value: 'center', label: { en: 'Center', ar: 'وسط' } },
        ],
      },
      {
        key: 'padding',
        type: 'select',
        label: { en: 'Vertical padding', ar: 'الحشو العمودي' },
        defaultValue: 'medium',
        options: [
          { value: 'none', label: { en: 'None', ar: 'بدون' } },
          { value: 'small', label: { en: 'Small', ar: 'صغير' } },
          { value: 'medium', label: { en: 'Medium', ar: 'متوسط' } },
          { value: 'large', label: { en: 'Large', ar: 'كبير' } },
        ],
      },
      { key: 'surface', type: 'boolean', label: { en: 'Card background', ar: 'خلفية بطاقة' }, defaultValue: false },
    ],
  },
  Component: RichText,
  defaultSettings: { width: 'normal', alignment: 'left', padding: 'medium', surface: false },
};
