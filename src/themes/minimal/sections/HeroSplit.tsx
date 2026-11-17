// HeroSplit — editorial split hero: image fills one half, content sits on the
// other. `image_side` is logical ('start' / 'end') so it flips naturally under
// RTL. On mobile the image always stacks first for a strong visual open.
// `variant: 'bleed'` is the edge-to-edge version (HeroSplitBleed below); the
// framed version keeps the markup it always had.

import { resolveMediaUrl } from '@/lib/api';
import type { SectionDefinition, SectionRenderProps } from '../../types';
import { buttonStyles, colorOr } from '../../elementStyles';
import { StaggerGroup, StaggerItem } from '../../_motion';
import { headingTag, textTag } from './_shared/headingLevel';
import { Heading } from './_shared/Heading';
import { isSvgSrc, responsiveImgProps } from '@/lib/storeMedia';
import { ArrowRight } from 'lucide-react';
import { StoreImage } from '@/components/StoreImage';
import { BleedSplit, edgeValue, focusPosition } from './_shared/BleedSplit';
import { ctaDefaults, ctaToneValue } from './_shared/cta';
import { FOCUS_RING, sectionHref } from './_shared/links';
import { toneColors, toneValue } from './_shared/tone';

type SplitHeight = 'sm' | 'md' | 'lg';
type ImageSide = 'start' | 'end';

// Applied to the desktop image column so the hero reserves its height and
// nothing shifts once the image loads.
const HEIGHT_CLASS: Record<SplitHeight, string> = {
  sm: 'md:min-h-[400px]',
  md: 'md:min-h-[520px]',
  lg: 'md:min-h-[640px]',
};

function HeroSplit(props: SectionRenderProps) {
  const { settings, content, locale } = props;
  const headingLevel = headingTag(settings.heading_level, 'h1');
  const eyebrowTag = textTag(settings.eyebrow_tag, 'span');
  const subheadingTag = textTag(settings.subheading_tag, 'p');
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
    // Unset or 'primary' gives the defaults this button always had.
    ctaDefaults(ctaToneValue(settings.cta_tone), 'none', 'var(--theme-radius-full)'),
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

  if (settings.variant === 'bleed') return <HeroSplitBleed {...props} />;

  return (
    <section className="py-10 md:py-16">
      <div className="grid md:grid-cols-2 gap-8 lg:gap-16 items-center">
        {/* Image column — first in DOM so mobile stacks image-first; the
            md:order utilities move it to the end column when requested.
            Grid columns follow document direction, so 'start'/'end' stay
            logical under RTL for free. */}
        <div className={`relative w-full ${imageSide === 'end' ? 'md:order-2' : ''}`}>
          {resolvedImage ? (
            // Plain <img> keeps the natural-ratio desktop sizing; optimized
            // srcset + high priority since the hero sits above the fold.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              {...responsiveImgProps(resolvedImage, '(min-width: 768px) 50vw, 100vw')}
              alt={(content.alt as string) || heading || ''}
              fetchPriority="high"
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
          <StaggerGroup immediate step={0.1} className="flex flex-col gap-5 max-w-xl py-4 md:py-8">
            {eyebrow && (
              <StaggerItem>
                <Heading level={eyebrowTag} original="span" look="body"
                  className="text-xs font-semibold uppercase tracking-[0.2em]"
                  style={{ color: eyebrowColor }}
                >
                  {eyebrow}
                </Heading>
              </StaggerItem>
            )}
            {heading && (
              <StaggerItem>
                <Heading level={headingLevel}
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
                </Heading>
              </StaggerItem>
            )}
            {subheading && (
              <StaggerItem>
                <Heading level={subheadingTag} look="body"
                  className="max-w-prose"
                  style={{
                    fontSize: 'var(--theme-scale-body)',
                    lineHeight: 'var(--theme-line-body)',
                    color: subheadingColor,
                  }}
                >
                  {subheading}
                </Heading>
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

/**
 * Edge-to-edge variant: the image fills its half up to the viewport edge with
 * no radius or shadow, the text lines up with the page container. Rendered
 * only when there is something to show (the caller keeps the empty state).
 */
function HeroSplitBleed({ settings, content, locale, primaryLocale }: SectionRenderProps) {
  const headingLevel = headingTag(settings.heading_level, 'h1');
  const eyebrowTag = textTag(settings.eyebrow_tag, 'span');
  const subheadingTag = textTag(settings.subheading_tag, 'p');
  const image = (settings.image as string) || '';
  const resolvedImage = image ? resolveMediaUrl(image) : '';
  const imageSide = (settings.image_side as ImageSide) === 'end' ? 'end' : 'start';
  const height = HEIGHT_CLASS[settings.height as SplitHeight] ? (settings.height as SplitHeight) : 'md';
  const wide = settings.image_width === 'wide';
  const tone = toneValue(settings.tone, 'surface');
  const colors = toneColors(tone, settings.bg_color);

  const eyebrow = (content.eyebrow as string) || '';
  const heading = (content.heading as string) || '';
  const subheading = (content.subheading as string) || '';
  const ctaText = (content.cta_text as string) || '';
  const ctaSecondaryText = (content.cta_secondary_text as string) || '';
  const alt = (content.alt as string) || heading || '';
  const ctaHref = sectionHref(content.cta_url || settings.cta_url, locale, primaryLocale);
  const ctaSecondaryHref = sectionHref(
    content.cta_secondary_url || settings.cta_secondary_url,
    locale,
    primaryLocale,
  );

  const primaryBtn = buttonStyles(
    {
      bg: settings.cta_bg_color,
      text: settings.cta_text_color,
      borderColor: settings.cta_border_color,
      borderWidth: settings.cta_border_width,
      borderRadius: settings.cta_border_radius,
    },
    ctaDefaults(ctaToneValue(settings.cta_tone), tone, 'var(--theme-radius-full)'),
  );
  // Outlined by default; text and border follow the text colour of the tone.
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
      text: colors.text,
      border: colors.text,
      borderWidth: '1.5px',
      radius: 'var(--theme-radius-full)',
    },
  );
  const buttonClass = `inline-flex items-center justify-center gap-2 px-8 py-3 motion-safe:transition-opacity motion-safe:duration-300 hover:opacity-90 ${FOCUS_RING}`;

  return (
    <BleedSplit
      imageSide={imageSide}
      wide={wide}
      edge={edgeValue(settings.edge, 'soft')}
      mobileOrder={settings.mobile_order === 'text-first' ? 'text-first' : 'image-first'}
      minHeightClass={HEIGHT_CLASS[height]}
      mobileAspectClass="aspect-[4/3]"
      bg={colors.bg}
      color={colors.text}
      blend={colors.blend}
      media={
        resolvedImage ? (
          // The hero sits above the fold: this image is the LCP candidate.
          <StoreImage
            src={resolvedImage}
            alt={alt}
            fill
            preload
            fetchPriority="high"
            sizes={wide ? '(min-width: 768px) 58vw, 100vw' : '(min-width: 768px) 50vw, 100vw'}
            unoptimized={isSvgSrc(resolvedImage)}
            className="object-cover"
            style={{ objectPosition: focusPosition(settings.image_focus) }}
          />
        ) : null
      }
    >
      <StaggerGroup immediate step={0.1} className="flex flex-col gap-5">
        {eyebrow && (
          <StaggerItem>
            <Heading level={eyebrowTag} original="span" look="body"
              className="text-xs font-semibold uppercase tracking-[0.2em]"
              style={{ color: colorOr(settings.eyebrow_color, colors.eyebrow) }}
            >
              {eyebrow}
            </Heading>
          </StaggerItem>
        )}
        {heading && (
          <StaggerItem>
            <Heading level={headingLevel}
              className="leading-[1.08]"
              style={{
                fontFamily: 'var(--theme-font-heading)',
                fontSize: 'var(--theme-scale-h1)',
                fontWeight: 'var(--theme-weight-heading)',
                letterSpacing: 'var(--theme-tracking-heading)',
                color: colorOr(settings.heading_color, colors.text),
              }}
            >
              {heading}
            </Heading>
          </StaggerItem>
        )}
        {subheading && (
          <StaggerItem>
            <Heading level={subheadingTag} look="body"
              className="max-w-prose"
              style={{
                fontSize: 'var(--theme-scale-body)',
                lineHeight: 'var(--theme-line-body)',
                color: colorOr(settings.subheading_color, colors.muted),
              }}
            >
              {subheading}
            </Heading>
          </StaggerItem>
        )}
        {(ctaText || ctaSecondaryText) && (
          <StaggerItem className="flex flex-wrap gap-3 mt-2">
            {ctaText && (
              <a
                href={ctaHref}
                className={buttonClass}
                style={{ ...primaryBtn, fontWeight: 'var(--theme-weight-bold)', outlineColor: colors.text }}
              >
                {ctaText}
                {settings.cta_arrow === true && <ArrowRight className="size-4 rtl:-scale-x-100" aria-hidden />}
              </a>
            )}
            {ctaSecondaryText && (
              <a
                href={ctaSecondaryHref}
                className={buttonClass}
                style={{ ...secondaryBtn, fontWeight: 'var(--theme-weight-bold)', outlineColor: colors.text }}
              >
                {ctaSecondaryText}
              </a>
            )}
          </StaggerItem>
        )}
      </StaggerGroup>
    </BleedSplit>
  );
}

// Fields of the edge-to-edge variant only.
const BLEED_ONLY = { key: 'variant', in: ['bleed'] };

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
    translatable: ['eyebrow', 'heading', 'subheading', 'cta_text', 'cta_url', 'cta_secondary_text', 'cta_secondary_url', 'alt'],
    schema: [
      {
        key: 'variant',
        type: 'select',
        label: { en: 'Style', ar: 'النمط' },
        defaultValue: 'framed',
        options: [
          { value: 'framed', label: { en: 'Framed image', ar: 'صورة داخل إطار' } },
          { value: 'bleed', label: { en: 'Edge to edge', ar: 'من الحافة إلى الحافة' } },
        ],
      },
      { key: 'image', type: 'image', label: { en: 'Image', ar: 'الصورة' } },
      {
        key: 'alt',
        type: 'text',
        label: { en: 'Image description (alt text)', ar: 'وصف الصورة (النص البديل)' },
        description: {
          en: 'Read by screen readers and search engines. Left empty, the heading is used.',
          ar: 'يقرؤه قارئ الشاشة ومحركات البحث. إن تُرك فارغاً يُستخدم العنوان.',
        },
        maxLength: 160,
      },
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
      {
        key: 'image_width',
        type: 'select',
        label: { en: 'Image width', ar: 'عرض الصورة' },
        defaultValue: 'half',
        showIf: BLEED_ONLY,
        options: [
          { value: 'half', label: { en: 'Half', ar: 'النصف' } },
          { value: 'wide', label: { en: 'Wide (58%)', ar: 'عريض (58%)' } },
        ],
      },
      {
        key: 'image_focus',
        type: 'select',
        label: { en: 'Image focus', ar: 'نقطة تركيز الصورة' },
        description: {
          en: 'The part of the image kept in view when it is cropped.',
          ar: 'الجزء الذي يبقى ظاهراً من الصورة عند اقتصاصها.',
        },
        defaultValue: 'center',
        showIf: BLEED_ONLY,
        options: [
          { value: 'center', label: { en: 'Centre', ar: 'الوسط' } },
          { value: 'top', label: { en: 'Top', ar: 'الأعلى' } },
          { value: 'bottom', label: { en: 'Bottom', ar: 'الأسفل' } },
        ],
      },
      {
        key: 'tone',
        type: 'select',
        label: { en: 'Background', ar: 'الخلفية' },
        defaultValue: 'surface',
        showIf: BLEED_ONLY,
        options: [
          { value: 'none', label: { en: 'None', ar: 'بدون' } },
          { value: 'surface', label: { en: 'Surface', ar: 'لون السطح' } },
          { value: 'primary', label: { en: 'Primary colour', ar: 'اللون الأساسي' } },
          { value: 'accent', label: { en: 'Accent colour', ar: 'لون التمييز' } },
        ],
      },
      { key: 'bg_color', type: 'color', label: { en: 'Background colour', ar: 'لون الخلفية' }, showIf: BLEED_ONLY },
      {
        key: 'edge',
        type: 'select',
        label: { en: 'Image edge', ar: 'حافة الصورة' },
        defaultValue: 'soft',
        showIf: BLEED_ONLY,
        options: [
          { value: 'soft', label: { en: 'Soft (fades into the background)', ar: 'ناعمة (تتلاشى في الخلفية)' } },
          { value: 'hard', label: { en: 'Hard', ar: 'حادّة' } },
        ],
      },
      {
        key: 'mobile_order',
        type: 'select',
        label: { en: 'Order on mobile', ar: 'الترتيب على الجوال' },
        defaultValue: 'image-first',
        showIf: BLEED_ONLY,
        options: [
          { value: 'image-first', label: { en: 'Image first', ar: 'الصورة أولاً' } },
          { value: 'text-first', label: { en: 'Text first', ar: 'النص أولاً' } },
        ],
      },
      {
        key: 'cta_tone',
        type: 'select',
        label: { en: 'Primary button colour', ar: 'لون الزر الرئيسي' },
        defaultValue: 'primary',
        options: [
          { value: 'primary', label: { en: 'Primary colour', ar: 'اللون الأساسي' } },
          { value: 'accent', label: { en: 'Accent colour', ar: 'لون التمييز' } },
        ],
      },
      {
        key: 'cta_arrow',
        type: 'boolean',
        label: { en: 'Arrow on the primary button', ar: 'سهم على الزر الرئيسي' },
        defaultValue: false,
        showIf: BLEED_ONLY,
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
