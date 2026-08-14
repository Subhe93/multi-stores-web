import { resolveMediaUrl } from '@/lib/api';
import type { SectionDefinition, SectionRenderProps } from '../../types';
import { buttonStyles, colorOr } from '../../elementStyles';
import { StaggerGroup, StaggerItem } from '../../_motion';

type Height = 'sm' | 'md' | 'lg';
const HEIGHT_CLASS: Record<Height, string> = {
  sm: 'min-h-[280px]',
  md: 'min-h-[420px]',
  lg: 'min-h-[560px]',
};

function ParallaxBanner({ settings, content }: SectionRenderProps) {
  const image = (settings.image as string) || '';
  const height = (settings.height as Height) || 'md';
  const overlayOpacity = typeof settings.overlay_opacity === 'number' ? settings.overlay_opacity : 0.3;

  const eyebrow = (content.eyebrow as string) || '';
  const heading = (content.heading as string) || '';
  const subheading = (content.subheading as string) || '';
  const ctaText = (content.cta_text as string) || '';
  const ctaUrl = (content.cta_url as string) || (settings.cta_url as string) || '#';

  const resolvedImage = image ? resolveMediaUrl(image) : '';

  // Text sits on a dark overlay, so defaults lean light.
  const eyebrowColor = colorOr(settings.eyebrow_color, 'var(--theme-colors-accent)');
  const headingColor = colorOr(settings.heading_color, '#fff');
  const subheadingColor = colorOr(settings.subheading_color, 'rgba(255,255,255,0.85)');

  const ctaBtn = buttonStyles(
    {
      bg: settings.cta_bg_color,
      text: settings.cta_text_color,
      borderColor: settings.cta_border_color,
      borderWidth: settings.cta_border_width,
      borderRadius: settings.cta_border_radius,
    },
    {
      bg: '#fff',
      text: '#111',
      radius: 'var(--theme-radius-full)',
    },
  );

  return (
    <section
      className={`ms-parallax-bg relative flex items-center justify-center overflow-hidden px-6 py-16 ${HEIGHT_CLASS[height]}`}
      style={{
        // Solid dark ground keeps the text readable while the image loads
        // (and when no image is set yet).
        backgroundColor: '#101014',
        backgroundImage: resolvedImage ? `url(${resolvedImage})` : undefined,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        width: '100vw',
        maxWidth: '100vw',
        marginLeft: 'calc(50% - 50vw)',
        marginRight: 'calc(50% - 50vw)',
      }}
    >
      {/* CSS-only parallax: fixed attachment on pointer devices, plain scroll
          on touch/iOS where fixed backgrounds are janky or unsupported. */}
      <style>{`
        .ms-parallax-bg { background-attachment: fixed; }
        @media (hover: none), (pointer: coarse) {
          .ms-parallax-bg { background-attachment: scroll; }
        }
      `}</style>

      <div className="absolute inset-0" style={{ backgroundColor: `rgba(0,0,0,${overlayOpacity})` }} />

      <StaggerGroup step={0.1} className="relative z-10 flex max-w-2xl flex-col items-center gap-4 text-center">
        {eyebrow && (
          <StaggerItem>
            <span className="text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: eyebrowColor }}>
              {eyebrow}
            </span>
          </StaggerItem>
        )}
        {heading && (
          <StaggerItem>
            <h2
              style={{
                fontFamily: 'var(--theme-font-heading)',
                fontSize: 'var(--theme-scale-h2)',
                fontWeight: 'var(--theme-weight-heading)',
                lineHeight: 'var(--theme-line-heading)',
                letterSpacing: 'var(--theme-tracking-heading)',
                color: headingColor,
              }}
            >
              {heading}
            </h2>
          </StaggerItem>
        )}
        {subheading && (
          <StaggerItem>
            <p
              className="max-w-prose"
              style={{
                fontSize: 'var(--theme-scale-body)',
                lineHeight: 'var(--theme-line-body)',
                color: subheadingColor,
              }}
            >
              {subheading}
            </p>
          </StaggerItem>
        )}
        {ctaText && (
          <StaggerItem>
            <a
              href={ctaUrl}
              className="mt-2 inline-flex items-center justify-center px-8 py-3 transition-all duration-300 hover:opacity-90 hover:-translate-y-px"
              style={{ ...ctaBtn, fontWeight: 'var(--theme-weight-bold)', boxShadow: 'var(--theme-shadow-md)' }}
            >
              {ctaText}
            </a>
          </StaggerItem>
        )}
      </StaggerGroup>
    </section>
  );
}

export const parallaxBannerSection: SectionDefinition = {
  schema: {
    id: 'parallax-banner',
    label: { en: 'Parallax Banner', ar: 'بانر باللاكس' },
    icon: 'image',
    category: 'showcase',
    description: {
      en: 'An elegant full-width strip whose background image stays fixed while the page scrolls past — with overlay, headline and button.',
      ar: 'شريط أنيق بعرض كامل تبقى صورته ثابتة أثناء تمرير الصفحة — مع طبقة داكنة وعنوان وزر.',
    },
    translatable: ['eyebrow', 'heading', 'subheading', 'cta_text', 'cta_url'],
    schema: [
      { key: 'image', type: 'image', label: { en: 'Background image', ar: 'صورة الخلفية' } },
      {
        key: 'height',
        type: 'select',
        label: { en: 'Height', ar: 'الارتفاع' },
        defaultValue: 'md',
        options: [
          { value: 'sm', label: { en: 'Small', ar: 'صغير' } },
          { value: 'md', label: { en: 'Medium', ar: 'متوسط' } },
          { value: 'lg', label: { en: 'Large', ar: 'كبير' } },
        ],
      },
      { key: 'overlay_opacity', type: 'number', label: { en: 'Overlay darkness (0–1)', ar: 'شفافية الطبقة (0-1)' }, min: 0, max: 1, defaultValue: 0.3 },
      { key: 'eyebrow', type: 'text', label: { en: 'Eyebrow (small label)', ar: 'تسمية صغيرة فوق العنوان' }, maxLength: 40 },
      { key: 'heading', type: 'text', label: { en: 'Heading', ar: 'العنوان' }, maxLength: 120 },
      { key: 'subheading', type: 'textarea', label: { en: 'Subheading', ar: 'العنوان الفرعي' }, maxLength: 280 },
      { key: 'cta_text', type: 'text', label: { en: 'Button text', ar: 'نص الزر' }, maxLength: 40 },
      { key: 'cta_url', type: 'url', label: { en: 'Button URL', ar: 'رابط الزر' } },
      // Per-element styling — every override is optional.
      { key: 'eyebrow_color', type: 'color', label: { en: 'Eyebrow color', ar: 'لون التسمية الصغيرة' } },
      { key: 'heading_color', type: 'color', label: { en: 'Heading color', ar: 'لون العنوان' } },
      { key: 'subheading_color', type: 'color', label: { en: 'Subheading color', ar: 'لون العنوان الفرعي' } },
      { key: 'cta_bg_color', type: 'color', label: { en: 'Button background', ar: 'خلفية الزر' } },
      { key: 'cta_text_color', type: 'color', label: { en: 'Button text color', ar: 'لون نص الزر' } },
      { key: 'cta_border_color', type: 'color', label: { en: 'Button border color', ar: 'لون حدود الزر' } },
      { key: 'cta_border_width', type: 'number', label: { en: 'Button border width (px)', ar: 'سماكة حدود الزر (px)' }, min: 0, max: 8, defaultValue: 0 },
      { key: 'cta_border_radius', type: 'number', label: { en: 'Button corner radius (px)', ar: 'انحناء زوايا الزر (px)' }, min: 0, max: 100 },
    ],
  },
  Component: ParallaxBanner,
  defaultSettings: { height: 'md', overlay_opacity: 0.3 },
  defaultContent: {
    eyebrow: 'The collection',
    heading: 'Crafted to last',
    subheading: 'Materials and details chosen with intention.',
    cta_text: 'Explore',
  },
};
