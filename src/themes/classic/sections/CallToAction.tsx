import type { SectionDefinition, SectionRenderProps } from '../../types';

// Classic CTA: warm surface card with thin border and uppercase button.
function CallToAction({ settings, content }: SectionRenderProps) {
  const heading = (content.heading as string) || '';
  const subheading = (content.subheading as string) || '';
  const ctaText = (content.cta_text as string) || '';
  const ctaUrl = (settings.cta_url as string) || '#';

  return (
    <section
      className="my-12 px-8 py-12 text-center"
      style={{
        backgroundColor: 'var(--theme-colors-surface)',
        border: '1px solid var(--theme-colors-border)',
        borderRadius: 'var(--theme-radius-md)',
      }}
    >
      {heading && (
        <h3
          style={{
            fontFamily: 'var(--theme-font-heading)',
            fontSize: 'var(--theme-scale-h2)',
            fontWeight: 'var(--theme-weight-heading)',
            lineHeight: 'var(--theme-line-heading)',
            color: 'var(--theme-colors-primary)',
          }}
        >
          {heading}
        </h3>
      )}
      {subheading && (
        <p
          className="mt-3 mb-6 max-w-2xl mx-auto italic"
          style={{
            color: 'var(--theme-colors-muted)',
            fontFamily: 'var(--theme-font-heading)',
          }}
        >
          {subheading}
        </p>
      )}
      {ctaText && (
        <a
          href={ctaUrl}
          className="inline-block px-10 py-3 transition hover:opacity-90"
          style={{
            backgroundColor: 'var(--theme-colors-primary)',
            color: 'var(--theme-colors-primaryContrast, #fff)',
            borderRadius: 'var(--theme-radius-sm)',
            fontWeight: 'var(--theme-weight-bold)',
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            fontSize: 'var(--theme-scale-small)',
          }}
        >
          {ctaText}
        </a>
      )}
    </section>
  );
}

export const classicCallToActionSection: SectionDefinition = {
  schema: {
    id: 'call-to-action',
    label: { en: 'Call to Action', ar: 'دعوة لإجراء' },
    icon: 'megaphone',
    category: 'showcase',
    translatable: ['heading', 'subheading', 'cta_text'],
    schema: [
      { key: 'heading', type: 'text', label: { en: 'Heading', ar: 'العنوان' } },
      { key: 'subheading', type: 'textarea', label: { en: 'Subheading', ar: 'العنوان الفرعي' } },
      { key: 'cta_text', type: 'text', label: { en: 'Button Text', ar: 'نص الزر' } },
      { key: 'cta_url', type: 'url', label: { en: 'Button URL', ar: 'رابط الزر' } },
    ],
  },
  Component: CallToAction,
};
