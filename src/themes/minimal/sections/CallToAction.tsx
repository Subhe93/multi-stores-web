import { resolveMediaUrl } from '@/lib/api';
import { StoreImage } from '@/components/StoreImage';
import { isSvgSrc } from '@/lib/storeMedia';
import { sectionHref } from './_shared/links';
import type { SectionDefinition, SectionRenderProps } from '../../types';
import { buttonStyles, colorOr } from '../../elementStyles';
import { MotionMedia, MotionText } from '../../creative/primitives/Motion';
import { hover, magnetic, parallax, rise } from '../../creative/recipes';
import { MotionRise } from './_shared/MotionStagger';

type CtaStyle = 'solid' | 'gradient' | 'image-bg' | 'split';

function CallToAction({ settings, content, locale, primaryLocale, pathPrefix, motion }: SectionRenderProps) {
  const style = (settings.style as CtaStyle) || 'solid';
  const heading = (content.heading as string) || '';
  const subheading = (content.subheading as string) || '';
  const ctaText = (content.cta_text as string) || '';
  const ctaUrl = sectionHref(settings.cta_url, { locale, primaryLocale, pathPrefix });
  const image = (settings.image as string) || '';
  const resolvedImage = image ? resolveMediaUrl(image) : '';

  const isLightOnDark = style === 'solid' || style === 'gradient' || style === 'image-bg';

  // Per-element style overrides — colors and button shape are user-configurable
  // and fall back to the theme tokens used by the original solid/gradient/image
  // designs. Heading and subheading inherit the on-dark contrast when the
  // style places them over a colored backdrop.
  const headingColor = colorOr(
    settings.heading_color,
    isLightOnDark ? 'currentColor' : 'var(--theme-colors-text)',
  );
  const subheadingColor = colorOr(
    settings.subheading_color,
    isLightOnDark ? 'rgba(255,255,255,0.9)' : 'var(--theme-colors-muted)',
  );

  const ctaStyle = buttonStyles(
    {
      bg: settings.cta_bg_color,
      text: settings.cta_text_color,
      borderColor: settings.cta_border_color,
      borderWidth: settings.cta_border_width,
      borderRadius: settings.cta_border_radius,
    },
    {
      bg: isLightOnDark ? 'var(--theme-colors-background)' : 'var(--theme-colors-primary)',
      text: isLightOnDark ? 'var(--theme-colors-primary)' : 'var(--theme-colors-primaryContrast, #fff)',
      // Soft & Rounded: CTA defaults to a pill (creator can still override radius).
      radius: 'var(--theme-radius-full)',
    },
  );

  // The CTA pill — same chip across styles so creators learn the visual cue.
  // Motion style: the button rises last, sinks a little when pressed and
  // leans towards the pointer (a link, never a buy control).
  const button = ctaText ? (
    <MotionRise motion={motion} i={3}>
      <a
        href={ctaUrl}
        className="inline-flex items-center px-8 py-3 transition-all hover:opacity-90 hover:-translate-y-px"
        style={{
          ...ctaStyle,
          fontWeight: 'var(--theme-weight-bold)',
          boxShadow: 'var(--theme-shadow-md)',
        }}
        {...hover(motion, 'press')}
        {...magnetic(motion)}
      >
        {ctaText}
      </a>
    </MotionRise>
  ) : null;

  const headingStyle = {
    fontFamily: 'var(--theme-font-heading)',
    fontSize: 'var(--theme-scale-h2)',
    fontWeight: 'var(--theme-weight-heading)',
    lineHeight: 'var(--theme-line-heading)',
    color: headingColor,
  } as const;

  // Style A: gradient — diagonal accent → primary.
  if (style === 'gradient') {
    return (
      <section
        className="my-10 py-14 px-8 text-center text-white"
        style={{
          background: 'linear-gradient(135deg, var(--theme-colors-accent) 0%, var(--theme-colors-primary) 100%)',
          borderRadius: 'var(--theme-radius-lg)',
          boxShadow: 'var(--theme-shadow-lg)',
        }}
      >
        {heading && <h3 className="mb-3" style={headingStyle}><MotionText motion={motion} text={heading} /></h3>}
        {subheading && <p className="mb-6 max-w-2xl mx-auto" style={{ color: subheadingColor }} {...rise(motion, { i: 2 })}>{subheading}</p>}
        {button}
      </section>
    );
  }

  // Style B: image background with overlay.
  if (style === 'image-bg') {
    return (
      <section
        className="relative my-10 px-8 py-16 text-center text-white overflow-hidden"
        style={{ borderRadius: 'var(--theme-radius-lg)' }}
      >
        {resolvedImage && motion ? (
          // The photo drifts a little slower than the page (the panel clips it).
          <div className="absolute inset-0" {...parallax(motion, -6)}>
            <StoreImage src={resolvedImage} alt="" fill sizes="100vw" unoptimized={isSvgSrc(resolvedImage)} className="object-cover" />
          </div>
        ) : resolvedImage ? (
          <StoreImage src={resolvedImage} alt="" fill sizes="100vw" unoptimized={isSvgSrc(resolvedImage)} className="object-cover" />
        ) : null}
        <div className="absolute inset-0" style={{ backgroundColor: 'rgba(0,0,0,0.45)' }} />
        <div className="relative">
          {heading && <h3 className="mb-3" style={headingStyle}><MotionText motion={motion} text={heading} /></h3>}
          {subheading && <p className="mb-6 max-w-2xl mx-auto" style={{ color: subheadingColor }} {...rise(motion, { i: 2 })}>{subheading}</p>}
          {button}
        </div>
      </section>
    );
  }

  // Style C: split — text on the left, image on the right (or stacked on mobile).
  if (style === 'split') {
    return (
      <section
        className="my-10 grid md:grid-cols-2 items-center overflow-hidden"
        style={{
          borderRadius: 'var(--theme-radius-lg)',
          border: '1px solid var(--theme-colors-border)',
          backgroundColor: 'var(--theme-colors-surface)',
        }}
      >
        <div className="p-8 md:p-12 space-y-4">
          {heading && <h3 style={headingStyle}><MotionText motion={motion} text={heading} /></h3>}
          {subheading && <p style={{ color: subheadingColor }} {...rise(motion, { i: 2 })}>{subheading}</p>}
          {button}
        </div>
        {resolvedImage && (
          <div className="relative h-64 md:h-full min-h-70">
            <MotionMedia motion={motion} fill dir="end">
              <StoreImage src={resolvedImage} alt="" fill sizes="(min-width: 768px) 50vw, 100vw" unoptimized={isSvgSrc(resolvedImage)} className="object-cover" />
            </MotionMedia>
          </div>
        )}
      </section>
    );
  }

  // Style D (default): solid primary background.
  return (
    <section
      className="my-10 py-14 px-8 text-center text-white"
      style={{
        backgroundColor: 'var(--theme-colors-primary)',
        color: 'var(--theme-colors-primaryContrast, #fff)',
        borderRadius: 'var(--theme-radius-lg)',
      }}
    >
      {heading && <h3 className="mb-3" style={headingStyle}><MotionText motion={motion} text={heading} /></h3>}
      {subheading && <p className="mb-6 max-w-2xl mx-auto" style={{ color: subheadingColor }} {...rise(motion, { i: 2 })}>{subheading}</p>}
      {button}
    </section>
  );
}

export const callToActionSection: SectionDefinition = {
  schema: {
    id: 'call-to-action',
    label: { en: 'Call to Action', ar: 'دعوة لإجراء' },
    icon: 'megaphone',
    category: 'showcase',
    description: {
      en: 'Highlighted block with a button. Four styles: solid, gradient, image background, or split.',
      ar: 'بطاقة بارزة مع زر. أربعة أنماط: صلب، تدرّج، صورة كخلفية، أو منقسم.',
    },
    translatable: ['heading', 'subheading', 'cta_text'],
    schema: [
      {
        key: 'style',
        type: 'select',
        label: { en: 'Style', ar: 'النمط' },
        defaultValue: 'solid',
        options: [
          { value: 'solid', label: { en: 'Solid color', ar: 'لون صلب' } },
          { value: 'gradient', label: { en: 'Gradient', ar: 'تدرّج' } },
          { value: 'image-bg', label: { en: 'Image background', ar: 'صورة كخلفية' } },
          { value: 'split', label: { en: 'Split (text + image)', ar: 'منقسم (نص + صورة)' } },
        ],
      },
      { key: 'image', type: 'image', label: { en: 'Image (for image/split styles)', ar: 'الصورة' } },
      { key: 'heading', type: 'text', label: { en: 'Heading', ar: 'العنوان' }, maxLength: 100 },
      { key: 'subheading', type: 'textarea', label: { en: 'Subheading', ar: 'العنوان الفرعي' }, maxLength: 280 },
      { key: 'cta_text', type: 'text', label: { en: 'Button text', ar: 'نص الزر' }, maxLength: 40 },
      { key: 'cta_url', type: 'url', label: { en: 'Button URL', ar: 'رابط الزر' } },
      { key: 'heading_color', type: 'color', label: { en: 'Heading color', ar: 'لون العنوان' } },
      { key: 'subheading_color', type: 'color', label: { en: 'Subheading color', ar: 'لون العنوان الفرعي' } },
      { key: 'cta_bg_color', type: 'color', label: { en: 'Button background', ar: 'خلفية الزر' } },
      { key: 'cta_text_color', type: 'color', label: { en: 'Button text color', ar: 'لون نص الزر' } },
      { key: 'cta_border_color', type: 'color', label: { en: 'Button border color', ar: 'لون حدود الزر' } },
      { key: 'cta_border_width', type: 'number', label: { en: 'Button border width (px)', ar: 'سماكة حدود الزر (px)' }, min: 0, max: 8, defaultValue: 0 },
      { key: 'cta_border_radius', type: 'number', label: { en: 'Button corner radius (px)', ar: 'انحناء زوايا الزر (px)' }, min: 0, max: 100 },
    ],
  },
  Component: CallToAction,
  defaultSettings: { style: 'solid' },
};
