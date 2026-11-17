import { resolveMediaUrl } from '@/lib/api';
import { StoreImage } from '@/components/StoreImage';
import type { SectionDefinition, SectionRenderProps } from '../../types';
import { IMAGE_SOURCE_FIELDS, STATIC_IMAGE_SHOW_IF } from './_shared/dynamicSourceFields';
import { buttonStyles, colorOr, mediaFx } from '../../elementStyles';
import { Reveal } from '../../_motion';
import { headingTag, textTag } from './_shared/headingLevel';
import { Heading } from './_shared/Heading';
import { isSvgSrc } from '@/lib/storeMedia';
import {
  DynamicSourceHint,
  dynamicImageSource,
  isDynamicPreview,
  productHasAnyImage,
  resolveDynamicImage,
  type DynamicImageSource,
} from './_shared/dynamicSource';
import { DynamicProductImage } from './_shared/lazyDynamic';
import { BleedSplit, edgeValue, focusPosition } from './_shared/BleedSplit';
import { ctaDefaults, ctaToneValue } from './_shared/cta';
import { FOCUS_RING, sectionHref } from './_shared/links';
import { toneColors, toneValue } from './_shared/tone';

type Position = 'left' | 'right';
type Aspect = 'square' | 'portrait' | 'landscape' | 'wide';

const ASPECT_CLASS: Record<Aspect, string> = {
  square: 'aspect-square',
  portrait: 'aspect-[3/4]',
  landscape: 'aspect-[4/3]',
  wide: 'aspect-[16/9]',
};

const IMAGE_SIZES = '(min-width: 768px) 50vw, 100vw';

// Edge-to-edge style: min-height of the image column from 768px.
type MinHeight = 'sm' | 'md' | 'lg';
const MIN_HEIGHT_CLASS: Record<MinHeight, string> = {
  sm: 'md:min-h-[360px]',
  md: 'md:min-h-[480px]',
  lg: 'md:min-h-[600px]',
};

/**
 * Image block for a dynamic `image_source` (product image). Null when there
 * is nothing to show on the live store; a hint in the builder preview.
 */
function dynamicImageBlock(
  source: DynamicImageSource,
  { settings, product, locale, builderPreview }: SectionRenderProps,
  aspectClass: string,
) {
  const preview = isDynamicPreview(builderPreview);
  const hint = preview ? (
    <DynamicSourceHint
      source={source}
      locale={locale}
      hasProduct={!!product}
      className={`${aspectClass} flex flex-col items-center justify-center`}
      style={{ borderRadius: 'var(--theme-radius-lg)' }}
    />
  ) : null;
  if (!product) return hint;
  const resolved = resolveDynamicImage(source, product, settings, locale);
  if (source === 'variant_image') {
    if (!productHasAnyImage(product)) return hint;
    // Live store without a featured image: the island would render nothing
    // until a variant with an image is picked, leaving an empty grid column.
    // Collapse to text only instead (the builder keeps the island + hint).
    if (!resolved && !preview) return null;
    return (
      <DynamicProductImage
        mode="fill"
        fallback={resolved}
        placeholder={hint}
        frameClassName={`relative ${aspectClass}`}
        frameStyle={mediaFx()}
        imgClassName="object-cover"
        sizes={IMAGE_SIZES}
      />
    );
  }
  if (!resolved) return hint;
  return (
    <div className={`relative ${aspectClass}`} style={mediaFx()} data-dynamic-image={source}>
      <StoreImage
        src={resolved.url}
        alt={resolved.alt}
        fill
        sizes={IMAGE_SIZES}
        unoptimized={isSvgSrc(resolved.url)}
        className="object-cover"
      />
    </div>
  );
}

function ImageWithText(props: SectionRenderProps) {
  const { settings, content, locale, primaryLocale } = props;
  // A missing / 'static' / unknown image_source keeps the uploaded image.
  const imageSource = dynamicImageSource(settings);
  const headingLevel = headingTag(settings.heading_level, 'h2');
  const eyebrowTag = textTag(settings.eyebrow_tag, 'p');
  const position = (settings.image_position as Position) || 'left';
  const aspect = (settings.aspect as Aspect) || 'square';
  const image = (settings.image as string) || '';
  const resolvedImage = image ? resolveMediaUrl(image) : '';
  const eyebrow = (content.eyebrow as string) || '';
  const heading = (content.heading as string) || '';
  const body = (content.body as string) || '';
  const ctaText = (content.cta_text as string) || '';
  const ctaUrl = (settings.cta_url as string) || '#';
  // Optional second button: rendered only when it has a text.
  const ctaSecondaryText = (content.cta_secondary_text as string) || '';
  const ctaSecondaryHref = sectionHref(settings.cta_secondary_url, locale, primaryLocale);
  const altText = (content.alt as string) || '';
  const ctaTone = ctaToneValue(settings.cta_tone);
  const secondaryOverrides = {
    bg: settings.cta_secondary_bg_color,
    text: settings.cta_secondary_text_color,
    borderColor: settings.cta_secondary_border_color,
    borderWidth: settings.cta_secondary_border_width,
    borderRadius: settings.cta_secondary_border_radius,
  };

  // Edge-to-edge style. Honoured for a static image only: a dynamic product
  // image keeps the framed layout. With nothing at all to show the framed
  // path below keeps its upload box.
  if (
    settings.image_style === 'bleed' &&
    !imageSource &&
    (resolvedImage || eyebrow || heading || body || ctaText || ctaSecondaryText)
  ) {
    const tone = toneValue(settings.tone, 'none');
    const colors = toneColors(tone, settings.bg_color);
    const minHeight = MIN_HEIGHT_CLASS[settings.min_height as MinHeight] || MIN_HEIGHT_CLASS.md;
    const buttonClass = `inline-flex items-center px-6 py-2.5 motion-safe:transition-opacity hover:opacity-90 ${FOCUS_RING}`;
    const primaryStyle = buttonStyles(
      {
        bg: settings.cta_bg_color,
        text: settings.cta_text_color,
        borderColor: settings.cta_border_color,
        borderWidth: settings.cta_border_width,
        borderRadius: settings.cta_border_radius,
      },
      ctaDefaults(ctaTone, tone, 'var(--theme-radius-full)'),
    );
    const secondaryStyle = buttonStyles(secondaryOverrides, {
      bg: 'transparent',
      text: colors.text,
      border: colors.text,
      borderWidth: '1.5px',
      radius: 'var(--theme-radius-full)',
    });
    return (
      <BleedSplit
        imageSide={position === 'right' ? 'end' : 'start'}
        edge={edgeValue(settings.edge, 'hard')}
        minHeightClass={minHeight}
        mobileAspectClass={ASPECT_CLASS[aspect] || ASPECT_CLASS.square}
        bg={colors.bg}
        color={colors.text}
        blend={colors.blend}
        media={
          resolvedImage ? (
            <StoreImage
              src={resolvedImage}
              alt={altText}
              fill
              sizes={IMAGE_SIZES}
              unoptimized={isSvgSrc(resolvedImage)}
              className="object-cover"
              style={{ objectPosition: focusPosition(settings.image_focus) }}
            />
          ) : null
        }
      >
        <div className="flex flex-col gap-4">
          {eyebrow && (
            <Heading level={eyebrowTag} look="body"
              className="text-xs font-semibold uppercase tracking-[0.2em]"
              style={{ color: colorOr(settings.eyebrow_color, colors.eyebrow) }}
            >
              {eyebrow}
            </Heading>
          )}
          {heading && (
            <Heading level={headingLevel}
              style={{
                fontFamily: 'var(--theme-font-heading)',
                fontSize: 'calc(var(--theme-scale-h2) * 1.12)',
                fontWeight: 'var(--theme-weight-heading)',
                lineHeight: 'var(--theme-line-heading)',
                letterSpacing: 'var(--theme-tracking-heading)',
                color: colorOr(settings.heading_color, colors.text),
              }}
            >
              {heading}
            </Heading>
          )}
          {body && (
            <p
              className="max-w-prose"
              style={{ color: colorOr(settings.body_color, colors.muted), lineHeight: 'var(--theme-line-body)' }}
            >
              {body}
            </p>
          )}
          {(ctaText || ctaSecondaryText) && (
            <div className="flex flex-wrap gap-3 mt-2">
              {ctaText && (
                <a
                  href={sectionHref(settings.cta_url, locale, primaryLocale)}
                  className={buttonClass}
                  style={{ ...primaryStyle, fontWeight: 'var(--theme-weight-bold)', outlineColor: colors.text }}
                >
                  {ctaText}
                </a>
              )}
              {ctaSecondaryText && (
                <a
                  href={ctaSecondaryHref}
                  className={buttonClass}
                  style={{ ...secondaryStyle, fontWeight: 'var(--theme-weight-bold)', outlineColor: colors.text }}
                >
                  {ctaSecondaryText}
                </a>
              )}
            </div>
          )}
        </div>
      </BleedSplit>
    );
  }

  const ctaStyle = buttonStyles(
    {
      bg: settings.cta_bg_color,
      text: settings.cta_text_color,
      borderColor: settings.cta_border_color,
      borderWidth: settings.cta_border_width,
      borderRadius: settings.cta_border_radius,
    },
    // Soft & Rounded: pill CTA by default. Unset or 'primary' gives the
    // defaults this button always had.
    ctaDefaults(ctaTone, 'none', 'var(--theme-radius-full)'),
  );
  const ctaSecondaryStyle = buttonStyles(secondaryOverrides, {
    bg: 'transparent',
    text: 'var(--theme-colors-text)',
    border: 'var(--theme-colors-border)',
    borderWidth: '1.5px',
    radius: 'var(--theme-radius-full)',
  });

  const text = (
    <div className="flex flex-col justify-center gap-4 py-8 md:py-12">
      {eyebrow && (
        <Heading level={eyebrowTag} look="body"
          className="text-xs font-semibold uppercase tracking-[0.2em]"
          style={{ color: colorOr(settings.eyebrow_color, 'var(--theme-colors-accent)') }}
        >
          {eyebrow}
        </Heading>
      )}
      {heading && (
        <Heading level={headingLevel}
          style={{
            fontFamily: 'var(--theme-font-heading)',
            fontSize: 'calc(var(--theme-scale-h2) * 1.12)',
            fontWeight: 'var(--theme-weight-heading)',
            lineHeight: 'var(--theme-line-heading)',
            letterSpacing: 'var(--theme-tracking-heading)',
            color: colorOr(settings.heading_color, 'var(--theme-colors-text)'),
          }}
        >
          {heading}
        </Heading>
      )}
      {body && (
        <p
          className="max-w-prose"
          style={{ color: colorOr(settings.body_color, 'var(--theme-colors-muted)'), lineHeight: 'var(--theme-line-body)' }}
        >
          {body}
        </p>
      )}
      {ctaSecondaryText ? (
        // Two buttons side by side; the single-button markup below is left
        // exactly as it was.
        <div className="flex flex-wrap gap-3">
          {ctaText && (
            <a
              href={ctaUrl}
              className="inline-flex items-center px-6 py-2.5 mt-2 transition hover:opacity-90"
              style={{ ...ctaStyle, fontWeight: 'var(--theme-weight-bold)' }}
            >
              {ctaText}
            </a>
          )}
          <a
            href={ctaSecondaryHref}
            className={`inline-flex items-center px-6 py-2.5 mt-2 motion-safe:transition-opacity hover:opacity-80 ${FOCUS_RING}`}
            style={{ ...ctaSecondaryStyle, fontWeight: 'var(--theme-weight-bold)' }}
          >
            {ctaSecondaryText}
          </a>
        </div>
      ) : ctaText ? (
        <div>
          <a
            href={ctaUrl}
            className="inline-flex items-center px-6 py-2.5 mt-2 transition hover:opacity-90"
            style={{ ...ctaStyle, fontWeight: 'var(--theme-weight-bold)' }}
          >
            {ctaText}
          </a>
        </div>
      ) : null}
    </div>
  );

  const imageBlock = imageSource ? dynamicImageBlock(imageSource, props, ASPECT_CLASS[aspect]) : resolvedImage ? (
    <div className={`relative ${ASPECT_CLASS[aspect]}`} style={mediaFx()}>
      <StoreImage
        src={resolvedImage}
        alt={altText}
        fill
        sizes="(min-width: 768px) 50vw, 100vw"
        unoptimized={isSvgSrc(resolvedImage)}
        className="object-cover"
      />
    </div>
  ) : (
    <div
      className={`${ASPECT_CLASS[aspect]} flex items-center justify-center`}
      style={{
        backgroundColor: 'var(--theme-colors-surface)',
        border: '1px dashed var(--theme-colors-border)',
        borderRadius: 'var(--theme-radius-lg)',
      }}
    >
      <span className="text-xs" style={{ color: 'var(--theme-colors-muted)' }}>
        Upload an image
      </span>
    </div>
  );

  if (imageSource && !imageBlock) {
    // Live store, product without that image: text only, no empty box.
    if (!eyebrow && !heading && !body && !ctaText && !ctaSecondaryText) return null;
    return (
      <section className="my-12">
        <Reveal direction="up">{text}</Reveal>
      </section>
    );
  }

  return (
    <section className="grid md:grid-cols-2 gap-8 lg:gap-20 my-12 items-center">
      {position === 'left' ? (
        <>
          <Reveal direction="scale">{imageBlock}</Reveal>
          <Reveal direction="up" delay={0.08}>{text}</Reveal>
        </>
      ) : (
        <>
          <Reveal direction="scale" className="md:order-2">{imageBlock}</Reveal>
          <Reveal direction="up" delay={0.08} className="md:order-1">{text}</Reveal>
        </>
      )}
    </section>
  );
}

// Fields of the edge-to-edge style only.
const BLEED_ONLY = { key: 'image_style', in: ['bleed'] };

export const imageWithTextSection: SectionDefinition = {
  schema: {
    id: 'image-with-text',
    label: { en: 'Image with Text', ar: 'صورة مع نص' },
    icon: 'columns',
    category: 'content',
    description: {
      en: '50/50 image and text. Common for "About", "Story", or feature spotlights.',
      ar: 'صورة 50/50 مع نص. مناسب لـ "من نحن"، "قصتنا"، أو تسليط الضوء على ميزة.',
    },
    translatable: ['eyebrow', 'heading', 'body', 'cta_text', 'cta_secondary_text', 'alt'],
    schema: [
      { key: 'image', type: 'image', label: { en: 'Image', ar: 'الصورة' }, showIf: STATIC_IMAGE_SHOW_IF },
      {
        key: 'alt',
        type: 'text',
        label: { en: 'Image description (alt text)', ar: 'وصف الصورة (النص البديل)' },
        description: {
          en: 'Read by screen readers and search engines. Leave empty for a purely decorative image.',
          ar: 'يقرؤه قارئ الشاشة ومحركات البحث. اتركه فارغاً إن كانت الصورة للزينة فقط.',
        },
        maxLength: 160,
        showIf: STATIC_IMAGE_SHOW_IF,
      },
      ...IMAGE_SOURCE_FIELDS,
      {
        key: 'image_position',
        type: 'select',
        label: { en: 'Image position', ar: 'موقع الصورة' },
        defaultValue: 'left',
        options: [
          // Stored values are kept; they follow the reading direction.
          { value: 'left', label: { en: 'Start', ar: 'البداية' } },
          { value: 'right', label: { en: 'End', ar: 'النهاية' } },
        ],
      },
      {
        key: 'image_style',
        type: 'select',
        label: { en: 'Image style', ar: 'نمط الصورة' },
        description: {
          en: 'Edge to edge applies to an uploaded image, not to a product image source.',
          ar: 'نمط «من الحافة إلى الحافة» يعمل مع الصورة المرفوعة فقط، لا مع صورة المنتج.',
        },
        defaultValue: 'framed',
        options: [
          { value: 'framed', label: { en: 'Framed', ar: 'داخل إطار' } },
          { value: 'bleed', label: { en: 'Edge to edge', ar: 'من الحافة إلى الحافة' } },
        ],
      },
      {
        key: 'min_height',
        type: 'select',
        label: { en: 'Minimum height', ar: 'أدنى ارتفاع' },
        defaultValue: 'md',
        showIf: BLEED_ONLY,
        options: [
          { value: 'sm', label: { en: 'Small', ar: 'صغير' } },
          { value: 'md', label: { en: 'Medium', ar: 'متوسط' } },
          { value: 'lg', label: { en: 'Large', ar: 'كبير' } },
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
        defaultValue: 'none',
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
        defaultValue: 'hard',
        showIf: BLEED_ONLY,
        options: [
          { value: 'soft', label: { en: 'Soft (fades into the background)', ar: 'ناعمة (تتلاشى في الخلفية)' } },
          { value: 'hard', label: { en: 'Hard', ar: 'حادّة' } },
        ],
      },
      {
        key: 'aspect',
        type: 'select',
        label: { en: 'Image aspect', ar: 'نسبة الصورة' },
        defaultValue: 'square',
        options: [
          { value: 'square', label: { en: 'Square', ar: 'مربّع' } },
          { value: 'portrait', label: { en: 'Portrait', ar: 'طولي' } },
          { value: 'landscape', label: { en: 'Landscape', ar: 'عرضي' } },
          { value: 'wide', label: { en: 'Wide 16:9', ar: 'عريض 16:9' } },
        ],
      },
      { key: 'eyebrow', type: 'text', label: { en: 'Eyebrow', ar: 'تسمية صغيرة' } },
      { key: 'heading', type: 'text', label: { en: 'Heading', ar: 'العنوان' } },
      { key: 'body', type: 'textarea', label: { en: 'Body text', ar: 'النص' } },
      { key: 'cta_text', type: 'text', label: { en: 'Button text', ar: 'نص الزر' } },
      { key: 'cta_url', type: 'url', label: { en: 'Button URL', ar: 'رابط الزر' } },
      { key: 'cta_secondary_text', type: 'text', label: { en: 'Second button text', ar: 'نص الزر الثاني' }, maxLength: 40 },
      { key: 'cta_secondary_url', type: 'url', label: { en: 'Second button URL', ar: 'رابط الزر الثاني' } },
      {
        key: 'cta_tone',
        type: 'select',
        label: { en: 'Button colour', ar: 'لون الزر' },
        defaultValue: 'primary',
        options: [
          { value: 'primary', label: { en: 'Primary colour', ar: 'اللون الأساسي' } },
          { value: 'accent', label: { en: 'Accent colour', ar: 'لون التمييز' } },
        ],
      },
      { key: 'eyebrow_color', type: 'color', label: { en: 'Eyebrow color', ar: 'لون التسمية الصغيرة' } },
      { key: 'heading_color', type: 'color', label: { en: 'Heading color', ar: 'لون العنوان' } },
      { key: 'body_color', type: 'color', label: { en: 'Body color', ar: 'لون النص' } },
      { key: 'cta_bg_color', type: 'color', label: { en: 'Button background', ar: 'خلفية الزر' } },
      { key: 'cta_text_color', type: 'color', label: { en: 'Button text color', ar: 'لون نص الزر' } },
      { key: 'cta_border_color', type: 'color', label: { en: 'Button border color', ar: 'لون حدود الزر' } },
      { key: 'cta_border_width', type: 'number', label: { en: 'Button border width (px)', ar: 'سماكة حدود الزر (px)' }, min: 0, max: 8, defaultValue: 0 },
      { key: 'cta_border_radius', type: 'number', label: { en: 'Button corner radius (px)', ar: 'انحناء زوايا الزر (px)' }, min: 0, max: 100 },
      { key: 'cta_secondary_bg_color', type: 'color', label: { en: 'Button background (second)', ar: 'خلفية الزر (الثاني)' } },
      { key: 'cta_secondary_text_color', type: 'color', label: { en: 'Button text color (second)', ar: 'لون نص الزر (الثاني)' } },
      { key: 'cta_secondary_border_color', type: 'color', label: { en: 'Button border color (second)', ar: 'لون حدود الزر (الثاني)' } },
      { key: 'cta_secondary_border_width', type: 'number', label: { en: 'Button border width (px) (second)', ar: 'سماكة حدود الزر (px) (الثاني)' }, min: 0, max: 8, defaultValue: 0 },
      { key: 'cta_secondary_border_radius', type: 'number', label: { en: 'Button corner radius (px) (second)', ar: 'انحناء زوايا الزر (px) (الثاني)' }, min: 0, max: 100 },
    ],
  },
  Component: ImageWithText,
  defaultSettings: { image_position: 'left', aspect: 'square' },
};
