import { resolveMediaUrl } from '@/lib/api';
import type { SectionDefinition, SectionRenderProps } from '../../types';
import { buttonStyles, colorOr } from '../../elementStyles';
import { StaggerGroup, StaggerItem } from '../../_motion';

type HeroLayout = 'centered' | 'image-background' | 'side-by-side';
type HeroHeight = 'sm' | 'md' | 'lg' | 'full';

const HEIGHT_CLASS: Record<HeroHeight, string> = {
  sm: 'min-h-[320px]',
  md: 'min-h-[480px]',
  lg: 'min-h-[640px]',
  full: 'min-h-[calc(100vh-80px)]',
};

function HeroBanner({ settings, content }: SectionRenderProps) {
  const layout = (settings.layout as HeroLayout) || 'centered';
  const alignment = (settings.alignment as 'left' | 'center' | 'right') || 'center';
  const height = (settings.height as HeroHeight) || 'md';
  const overlayOpacity = typeof settings.overlay_opacity === 'number' ? settings.overlay_opacity : 0.35;
  const image = (settings.image as string) || '';
  const heading = (content.heading as string) || '';
  const subheading = (content.subheading as string) || '';
  const ctaText = (content.cta_text as string) || '';
  const ctaUrl = (settings.cta_url as string) || '#';
  const ctaSecondaryText = (content.cta_secondary_text as string) || '';
  const ctaSecondaryUrl = (settings.cta_secondary_url as string) || '#';
  const eyebrow = (content.eyebrow as string) || '';
  const resolvedImage = image ? resolveMediaUrl(image) : '';

  const alignClass = alignment === 'left' ? 'text-left items-start' : alignment === 'right' ? 'text-right items-end' : 'text-center items-center';

  const onDark = layout === 'image-background';

  // Pre-compute per-element style overrides so the JSX stays clean.
  const eyebrowColor = colorOr(settings.eyebrow_color, 'var(--theme-colors-accent)');
  const headingColor = colorOr(settings.heading_color, onDark ? '#fff' : 'var(--theme-colors-text)');
  const subheadingColor = colorOr(
    settings.subheading_color,
    onDark ? 'rgba(255,255,255,0.85)' : 'var(--theme-colors-muted)',
  );

  const primaryBtn = buttonStyles(
    {
      bg: settings.cta_bg_color,
      text: settings.cta_text_color,
      borderColor: settings.cta_border_color,
      borderWidth: settings.cta_border_width,
      borderRadius: settings.cta_border_radius,
    },
    {
      bg: 'var(--theme-colors-primary)',
      text: 'var(--theme-colors-primaryContrast, #fff)',
      // Soft & Rounded: pill CTA by default (overridable via cta_border_radius).
      radius: 'var(--theme-radius-full)',
    },
  );

  const secondaryBtn = buttonStyles(
    {
      bg: settings.cta_secondary_bg_color,
      text: settings.cta_secondary_text_color,
      borderColor: settings.cta_secondary_border_color,
      borderWidth: settings.cta_secondary_border_width,
      borderRadius: settings.cta_secondary_border_radius,
    },
    {
      bg: 'transparent',
      text: onDark ? '#fff' : 'var(--theme-colors-text)',
      border: onDark ? 'rgba(255,255,255,0.5)' : 'var(--theme-colors-border)',
      borderWidth: '1.5px',
      radius: 'var(--theme-radius-full)',
    },
  );

  // Shared text block — keeps the heading/subheading/CTAs visually consistent
  // across the three layouts.
  const textBlock = (
    <StaggerGroup step={0.1} className={`flex flex-col gap-4 max-w-2xl ${alignClass}`}>
      {eyebrow && (
        <StaggerItem>
          <span
            className="text-xs font-semibold uppercase tracking-[0.2em] opacity-70"
            style={{ color: eyebrowColor }}
          >
            {eyebrow}
          </span>
        </StaggerItem>
      )}
      {heading && (
        <StaggerItem>
          <h1
            className="leading-[1.05]"
            style={{
              fontFamily: 'var(--theme-font-heading)',
              fontSize: 'var(--theme-scale-h1)',
              fontWeight: 'var(--theme-weight-heading)',
              letterSpacing: 'var(--theme-tracking-heading)',
              color: headingColor,
            }}
          >
            {heading}
          </h1>
        </StaggerItem>
      )}
      {subheading && (
        <StaggerItem>
          <p
            className="max-w-prose"
            style={{
              fontSize: 'var(--theme-scale-body)',
              color: subheadingColor,
              lineHeight: 'var(--theme-line-body)',
            }}
          >
            {subheading}
          </p>
        </StaggerItem>
      )}
      {(ctaText || ctaSecondaryText) && (
        <StaggerItem className={`flex flex-wrap gap-3 ${alignment === 'center' ? 'justify-center' : alignment === 'right' ? 'justify-end' : 'justify-start'}`}>
          {ctaText && (
            <a
              href={ctaUrl}
              className="inline-flex items-center justify-center px-8 py-3 transition-all hover:opacity-90 hover:-translate-y-px"
              style={{
                ...primaryBtn,
                fontWeight: 'var(--theme-weight-bold)',
                boxShadow: 'var(--theme-shadow-md)',
              }}
            >
              {ctaText}
            </a>
          )}
          {ctaSecondaryText && (
            <a
              href={ctaSecondaryUrl}
              className="inline-flex items-center justify-center px-8 py-3 transition hover:opacity-90"
              style={{
                ...secondaryBtn,
                fontWeight: 'var(--theme-weight-bold)',
              }}
            >
              {ctaSecondaryText}
            </a>
          )}
        </StaggerItem>
      )}
    </StaggerGroup>
  );

  // Layout A: full-bleed image background with overlay + centered text.
  // Uses the modern 100vw escape trick so it reaches viewport edges no matter
  // how it's nested inside the SectionRenderer's wrapper/inner divs. The old
  // `-mx-*` trick assumed the section sat directly inside the Layout's padded
  // container — that's no longer true.
  if (layout === 'image-background') {
    return (
      <section
        className={`relative overflow-hidden flex items-center justify-center px-6 sm:px-12 ${HEIGHT_CLASS[height]}`}
        style={{
          color: '#fff',
          width: '100vw',
          maxWidth: '100vw',
          marginLeft: 'calc(50% - 50vw)',
          marginRight: 'calc(50% - 50vw)',
        }}
      >
        {resolvedImage && (
          <img
            src={resolvedImage}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
            style={{ zIndex: 0 }}
          />
        )}
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(180deg, rgba(0,0,0,${overlayOpacity * 0.7}) 0%, rgba(0,0,0,${overlayOpacity}) 100%)`,
            zIndex: 1,
          }}
        />
        <div className="relative max-w-7xl mx-auto w-full flex" style={{ zIndex: 2 }}>
          <div className={`w-full flex ${alignment === 'center' ? 'justify-center' : alignment === 'right' ? 'justify-end' : 'justify-start'}`}>
            {textBlock}
          </div>
        </div>
      </section>
    );
  }

  // Layout B: image on one side, text on the other.
  if (layout === 'side-by-side') {
    const imageOnLeft = alignment !== 'right';
    return (
      <section className="grid md:grid-cols-2 gap-8 lg:gap-12 py-10 items-center">
        {imageOnLeft && resolvedImage && (
          <div className="order-1">
            <img
              src={resolvedImage}
              alt=""
              className="w-full h-full max-h-150 object-cover"
              style={{ borderRadius: 'var(--theme-radius-lg)', boxShadow: 'var(--theme-shadow-lg)' }}
            />
          </div>
        )}
        <div className={`flex ${imageOnLeft ? 'order-2' : 'order-1 md:order-2'}`}>
          {textBlock}
        </div>
        {!imageOnLeft && resolvedImage && (
          <div className="order-2 md:order-1">
            <img
              src={resolvedImage}
              alt=""
              className="w-full h-full max-h-150 object-cover"
              style={{ borderRadius: 'var(--theme-radius-lg)', boxShadow: 'var(--theme-shadow-lg)' }}
            />
          </div>
        )}
      </section>
    );
  }

  // Layout C (default): centered classic hero with optional image above.
  return (
    <section className="py-16 md:py-24 flex flex-col items-center text-center gap-8">
      {resolvedImage && (
        <img
          src={resolvedImage}
          alt=""
          className="max-h-96 object-cover w-full max-w-3xl"
          style={{ borderRadius: 'var(--theme-radius-lg)', boxShadow: 'var(--theme-shadow-md)' }}
        />
      )}
      <div className="w-full flex justify-center">{textBlock}</div>
    </section>
  );
}

export const heroBannerSection: SectionDefinition = {
  schema: {
    id: 'hero-banner',
    label: { en: 'Hero Banner', ar: 'بانر رئيسي' },
    icon: 'image',
    category: 'showcase',
    description: {
      en: 'Top-of-page banner. Three layouts: centered, full-bleed image background, or side-by-side image+text.',
      ar: 'بانر أعلى الصفحة. ثلاث تخطيطات: في الوسط، خلفية صورة كاملة، أو صورة بجانب نص.',
    },
    translatable: ['eyebrow', 'heading', 'subheading', 'cta_text', 'cta_secondary_text'],
    schema: [
      {
        key: 'layout',
        type: 'select',
        label: { en: 'Layout', ar: 'التخطيط' },
        defaultValue: 'centered',
        options: [
          { value: 'centered', label: { en: 'Centered', ar: 'وسط' } },
          { value: 'image-background', label: { en: 'Image background', ar: 'صورة كخلفية' } },
          { value: 'side-by-side', label: { en: 'Side-by-side', ar: 'جنبًا إلى جنب' } },
        ],
      },
      {
        key: 'height',
        type: 'select',
        label: { en: 'Height (for image background)', ar: 'الارتفاع (لخلفية الصورة)' },
        defaultValue: 'md',
        options: [
          { value: 'sm', label: { en: 'Small', ar: 'صغير' } },
          { value: 'md', label: { en: 'Medium', ar: 'متوسط' } },
          { value: 'lg', label: { en: 'Large', ar: 'كبير' } },
          { value: 'full', label: { en: 'Full screen', ar: 'شاشة كاملة' } },
        ],
      },
      { key: 'image', type: 'image', label: { en: 'Image', ar: 'الصورة' } },
      { key: 'overlay_opacity', type: 'number', label: { en: 'Overlay darkness (0–1)', ar: 'شفافية الطبقة (0-1)' }, min: 0, max: 1, defaultValue: 0.35 },
      { key: 'eyebrow', type: 'text', label: { en: 'Eyebrow (small label)', ar: 'تسمية صغيرة فوق العنوان' }, maxLength: 40 },
      { key: 'heading', type: 'text', label: { en: 'Heading', ar: 'العنوان' }, maxLength: 120 },
      { key: 'subheading', type: 'textarea', label: { en: 'Subheading', ar: 'العنوان الفرعي' }, maxLength: 280 },
      { key: 'cta_text', type: 'text', label: { en: 'Primary button text', ar: 'نص الزر الرئيسي' }, maxLength: 40 },
      { key: 'cta_url', type: 'url', label: { en: 'Primary button URL', ar: 'رابط الزر الرئيسي' } },
      { key: 'cta_secondary_text', type: 'text', label: { en: 'Secondary button text', ar: 'نص الزر الثاني' }, maxLength: 40 },
      { key: 'cta_secondary_url', type: 'url', label: { en: 'Secondary button URL', ar: 'رابط الزر الثاني' } },
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
      // Per-element styling — every override is optional.
      { key: 'eyebrow_color', type: 'color', label: { en: 'Eyebrow color', ar: 'لون التسمية الصغيرة' } },
      { key: 'heading_color', type: 'color', label: { en: 'Heading color', ar: 'لون العنوان' } },
      { key: 'subheading_color', type: 'color', label: { en: 'Subheading color', ar: 'لون العنوان الفرعي' } },
      { key: 'cta_bg_color', type: 'color', label: { en: 'Button background (primary)', ar: 'خلفية الزر (رئيسي)' } },
      { key: 'cta_text_color', type: 'color', label: { en: 'Button text color (primary)', ar: 'لون نص الزر (رئيسي)' } },
      { key: 'cta_border_color', type: 'color', label: { en: 'Button border color (primary)', ar: 'لون حدود الزر (رئيسي)' } },
      { key: 'cta_border_width', type: 'number', label: { en: 'Button border width (px) (primary)', ar: 'سماكة حدود الزر (px) (رئيسي)' }, min: 0, max: 8, defaultValue: 0 },
      { key: 'cta_border_radius', type: 'number', label: { en: 'Button corner radius (px) (primary)', ar: 'انحناء زوايا الزر (px) (رئيسي)' }, min: 0, max: 100 },
      { key: 'cta_secondary_bg_color', type: 'color', label: { en: 'Button background (secondary)', ar: 'خلفية الزر (ثانوي)' } },
      { key: 'cta_secondary_text_color', type: 'color', label: { en: 'Button text color (secondary)', ar: 'لون نص الزر (ثانوي)' } },
      { key: 'cta_secondary_border_color', type: 'color', label: { en: 'Button border color (secondary)', ar: 'لون حدود الزر (ثانوي)' } },
      { key: 'cta_secondary_border_width', type: 'number', label: { en: 'Button border width (px) (secondary)', ar: 'سماكة حدود الزر (px) (ثانوي)' }, min: 0, max: 8, defaultValue: 0 },
      { key: 'cta_secondary_border_radius', type: 'number', label: { en: 'Button corner radius (px) (secondary)', ar: 'انحناء زوايا الزر (px) (ثانوي)' }, min: 0, max: 100 },
    ],
  },
  Component: HeroBanner,
  defaultSettings: { layout: 'centered', alignment: 'center', height: 'md', overlay_opacity: 0.35 },
};
