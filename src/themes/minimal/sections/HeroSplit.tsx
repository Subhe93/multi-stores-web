// HeroSplit — editorial split hero: image fills one half, content sits on the
// other. `image_side` is logical ('start' / 'end') so it flips naturally under
// RTL. On mobile the image always stacks first for a strong visual open.

import { resolveMediaUrl } from '@/lib/api';
import type { SectionDefinition, SectionRenderProps } from '../../types';
import { buttonStyles, colorOr } from '../../elementStyles';
import { StaggerGroup, StaggerItem } from '../../_motion';

type SplitHeight = 'sm' | 'md' | 'lg';
type ImageSide = 'start' | 'end';

// Applied to the desktop image column so the hero reserves its height and
// nothing shifts once the image loads.
const HEIGHT_CLASS: Record<SplitHeight, string> = {
  sm: 'md:min-h-[400px]',
  md: 'md:min-h-[520px]',
  lg: 'md:min-h-[640px]',
};

function HeroSplit({ settings, content, locale }: SectionRenderProps) {
  const image = (settings.image as string) || '';
  const imageSide = (settings.image_side as ImageSide) || 'start';
  const height = (settings.height as SplitHeight) || 'md';

  const eyebrow = (content.eyebrow as string) || '';
  const heading = (content.heading as string) || '';
  const subheading = (content.subheading as string) || '';
  const ctaText = (content.cta_text as string) || '';
  const ctaUrl = (content.cta_url as string) || (settings.cta_url as string) || '#';
  const ctaSecondaryText = (content.cta_secondary_text as string) || '';
  const ctaSecondaryUrl =
    (content.cta_secondary_url as string) || (settings.cta_secondary_url as string) || '#';

  const resolvedImage = image ? resolveMediaUrl(image) : '';

  // Per-element color overrides — each falls back to a theme token.
  const eyebrowColor = colorOr(settings.eyebrow_color, 'var(--theme-colors-accent)');
  const headingColor = colorOr(settings.heading_color, 'var(--theme-colors-text)');
  const subheadingColor = colorOr(settings.subheading_color, 'var(--theme-colors-muted)');

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
      text: 'var(--theme-colors-text)',
      border: 'var(--theme-colors-border)',
      borderWidth: '1.5px',
      radius: 'var(--theme-radius-full)',
    },
  );

  // Stay visible while empty so creators can see placement in the builder.
  if (!resolvedImage && !heading && !subheading) {
    return (
      <section className="py-12">
        <div
          className="text-center py-16 px-4"
          style={{
            border: '1px dashed var(--theme-colors-border)',
            borderRadius: 'var(--theme-radius-md)',
            color: 'var(--theme-colors-muted)',
          }}
        >
          <p className="text-sm">
            {locale === 'ar'
              ? 'قسم البطل المنقسم فارغ. أضف صورة وعنوانًا من البيلدر.'
              : 'Split hero is empty. Add an image and heading from the builder.'}
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="py-10 md:py-16">
      <div className="grid md:grid-cols-2 gap-8 lg:gap-16 items-center">
        {/* Image column — first in DOM so mobile stacks image-first; the
            md:order utilities move it to the end column when requested.
            Grid columns follow document direction, so 'start'/'end' stay
            logical under RTL for free. */}
        <div className={`relative w-full ${imageSide === 'end' ? 'md:order-2' : ''}`}>
          {resolvedImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={resolvedImage}
              alt={heading || ''}
              className={`w-full aspect-[4/5] object-cover ${HEIGHT_CLASS[height]} md:h-full md:aspect-auto`}
              style={{ borderRadius: 'var(--theme-radius-lg)', boxShadow: 'var(--theme-shadow-lg)' }}
            />
          ) : (
            <div
              className={`w-full aspect-[4/5] ${HEIGHT_CLASS[height]}`}
              style={{
                backgroundColor: 'var(--theme-colors-surface)',
                borderRadius: 'var(--theme-radius-lg)',
              }}
            />
          )}
        </div>

        {/* Content column — generous whitespace, serif-friendly scale. */}
        <div className={imageSide === 'end' ? 'md:order-1' : ''}>
          <StaggerGroup step={0.1} className="flex flex-col gap-5 max-w-xl py-4 md:py-8">
            {eyebrow && (
              <StaggerItem>
                <span
                  className="text-xs font-semibold uppercase tracking-[0.2em]"
                  style={{ color: eyebrowColor }}
                >
                  {eyebrow}
                </span>
              </StaggerItem>
            )}
            {heading && (
              <StaggerItem>
                <h1
                  className="leading-[1.08]"
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
                    lineHeight: 'var(--theme-line-body)',
                    color: subheadingColor,
                  }}
                >
                  {subheading}
                </p>
              </StaggerItem>
            )}
            {(ctaText || ctaSecondaryText) && (
              <StaggerItem className="flex flex-wrap gap-3 mt-2">
                {ctaText && (
                  <a
                    href={ctaUrl}
                    className="inline-flex items-center justify-center px-8 py-3 transition-all duration-300 hover:opacity-90 hover:-translate-y-px"
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
                    className="inline-flex items-center justify-center px-8 py-3 transition duration-300 hover:opacity-80"
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
        </div>
      </div>
    </section>
  );
}

export const heroSplitSection: SectionDefinition = {
  schema: {
    id: 'hero-split',
    label: { en: 'Split Hero', ar: 'بطل منقسم' },
    icon: 'image',
    category: 'showcase',
    description: {
      en: 'Editorial split hero: image on one half, heading + CTAs on the other. Image side honors RTL.',
      ar: 'بطل تحريري منقسم: صورة في نصف وعنوان مع أزرار في النصف الآخر. جهة الصورة تراعي اتجاه اللغة.',
    },
    translatable: ['eyebrow', 'heading', 'subheading', 'cta_text', 'cta_url', 'cta_secondary_text', 'cta_secondary_url'],
    schema: [
      { key: 'image', type: 'image', label: { en: 'Image', ar: 'الصورة' } },
      {
        key: 'image_side',
        type: 'select',
        label: { en: 'Image side', ar: 'جهة الصورة' },
        defaultValue: 'start',
        options: [
          { value: 'start', label: { en: 'Start (left in LTR)', ar: 'البداية (يمين في العربية)' } },
          { value: 'end', label: { en: 'End (right in LTR)', ar: 'النهاية (يسار في العربية)' } },
        ],
      },
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
      { key: 'eyebrow', type: 'text', label: { en: 'Eyebrow (small label)', ar: 'تسمية صغيرة فوق العنوان' }, maxLength: 40 },
      { key: 'heading', type: 'text', label: { en: 'Heading', ar: 'العنوان' }, maxLength: 120 },
      { key: 'subheading', type: 'textarea', label: { en: 'Subheading', ar: 'العنوان الفرعي' }, maxLength: 280 },
      { key: 'cta_text', type: 'text', label: { en: 'Primary button text', ar: 'نص الزر الرئيسي' }, maxLength: 40 },
      { key: 'cta_url', type: 'url', label: { en: 'Primary button URL', ar: 'رابط الزر الرئيسي' } },
      { key: 'cta_secondary_text', type: 'text', label: { en: 'Secondary button text', ar: 'نص الزر الثاني' }, maxLength: 40 },
      { key: 'cta_secondary_url', type: 'url', label: { en: 'Secondary button URL', ar: 'رابط الزر الثاني' } },
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
  Component: HeroSplit,
  defaultSettings: { image_side: 'start', height: 'md' },
  defaultContent: {
    heading: 'Crafted for the way you live',
    subheading: 'Discover a collection designed with intention — quality materials, timeless silhouettes.',
    cta_text: 'Shop the collection',
  },
};
