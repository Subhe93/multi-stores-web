import { resolveMediaUrl } from '@/lib/api';
import { StoreImage } from '@/components/StoreImage';
import type { SectionDefinition, SectionRenderProps } from '../../types';

// Classic hero: framed image with serif heading underneath. More editorial-feel
// than Minimal's centered hero. Schema stays identical so creators can switch
// themes without re-entering content.
function HeroBanner({ settings, content }: SectionRenderProps) {
  const image = settings.image as string | undefined;
  // Storefront stores upload URLs as relative paths like `/uploads/foo.png` —
  // they live on the API host, not the storefront host (which may be on a
  // tenant subdomain). resolveMediaUrl prefixes API_ORIGIN so the <img> hits
  // the right server instead of 404ing on the storefront's own origin.
  const resolvedImage = image ? resolveMediaUrl(image) : '';
  const alignment = (settings.alignment as 'left' | 'center' | 'right') || 'center';
  const heading = (content.heading as string) || '';
  const subheading = (content.subheading as string) || '';
  const ctaText = (content.cta_text as string) || '';
  const ctaUrl = (settings.cta_url as string) || '#';

  const align = alignment === 'left' ? 'text-left' : alignment === 'right' ? 'text-right' : 'text-center';

  return (
    <section className="py-12 md:py-16">
      {resolvedImage && (
        <div
          className="relative h-105 overflow-hidden mb-10"
          style={{
            borderRadius: 'var(--theme-radius-md)',
            border: '1px solid var(--theme-colors-border)',
            boxShadow: 'var(--theme-shadow-md)',
          }}
        >
          <StoreImage
            src={resolvedImage}
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
        </div>
      )}
      <div className={align}>
        {heading && (
          <h1
            className="mb-3"
            style={{
              fontFamily: 'var(--theme-font-heading)',
              fontSize: 'var(--theme-scale-h1)',
              lineHeight: 'var(--theme-line-heading)',
              fontWeight: 'var(--theme-weight-heading)',
              color: 'var(--theme-colors-primary)',
              letterSpacing: '-0.01em',
            }}
          >
            {heading}
          </h1>
        )}
        {subheading && (
          <p
            className="max-w-2xl mx-auto italic"
            style={{
              fontSize: 'var(--theme-scale-body)',
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
            className="inline-block mt-8 px-10 py-3 transition hover:opacity-90"
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
      </div>
    </section>
  );
}

export const classicHeroBannerSection: SectionDefinition = {
  // Schema is intentionally identical to the minimal version so swapping themes
  // doesn't break stored content. Only the Component differs.
  schema: {
    id: 'hero-banner',
    label: { en: 'Hero Banner', ar: 'بانر رئيسي' },
    icon: 'image',
    category: 'showcase',
    description: {
      en: 'Editorial hero with framed image and serif heading.',
      ar: 'بانر تحريري بإطار للصورة وعنوان بخط Serif.',
    },
    translatable: ['heading', 'subheading', 'cta_text'],
    schema: [
      { key: 'image', type: 'image', label: { en: 'Image', ar: 'الصورة' } },
      { key: 'heading', type: 'text', label: { en: 'Heading', ar: 'العنوان' }, maxLength: 100 },
      { key: 'subheading', type: 'textarea', label: { en: 'Subheading', ar: 'العنوان الفرعي' }, maxLength: 240 },
      { key: 'cta_text', type: 'text', label: { en: 'Button Text', ar: 'نص الزر' }, maxLength: 40 },
      { key: 'cta_url', type: 'url', label: { en: 'Button URL', ar: 'رابط الزر' } },
      {
        key: 'alignment',
        type: 'select',
        label: { en: 'Alignment', ar: 'المحاذاة' },
        defaultValue: 'center',
        options: [
          { value: 'left', label: { en: 'Left', ar: 'يسار' } },
          { value: 'center', label: { en: 'Center', ar: 'وسط' } },
          { value: 'right', label: { en: 'Right', ar: 'يمين' } },
        ],
      },
    ],
  },
  Component: HeroBanner,
  defaultSettings: { alignment: 'center' },
};
