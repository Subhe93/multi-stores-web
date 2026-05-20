import { resolveMediaUrl } from '@/lib/api';
import type { SectionDefinition, SectionRenderProps } from '../../types';
import { buttonStyles, colorOr, mediaFx } from '../../elementStyles';
import { Reveal } from '../../_motion';

type Position = 'left' | 'right';
type Aspect = 'square' | 'portrait' | 'landscape' | 'wide';

const ASPECT_CLASS: Record<Aspect, string> = {
  square: 'aspect-square',
  portrait: 'aspect-[3/4]',
  landscape: 'aspect-[4/3]',
  wide: 'aspect-[16/9]',
};

function ImageWithText({ settings, content }: SectionRenderProps) {
  const position = (settings.image_position as Position) || 'left';
  const aspect = (settings.aspect as Aspect) || 'square';
  const image = (settings.image as string) || '';
  const resolvedImage = image ? resolveMediaUrl(image) : '';
  const eyebrow = (content.eyebrow as string) || '';
  const heading = (content.heading as string) || '';
  const body = (content.body as string) || '';
  const ctaText = (content.cta_text as string) || '';
  const ctaUrl = (settings.cta_url as string) || '#';

  const ctaStyle = buttonStyles(
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
      // Soft & Rounded: pill CTA by default.
      radius: 'var(--theme-radius-full)',
    },
  );

  const text = (
    <div className="flex flex-col justify-center gap-4 py-8 md:py-12">
      {eyebrow && (
        <p
          className="text-xs font-semibold uppercase tracking-[0.2em]"
          style={{ color: colorOr(settings.eyebrow_color, 'var(--theme-colors-accent)') }}
        >
          {eyebrow}
        </p>
      )}
      {heading && (
        <h2
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
        </h2>
      )}
      {body && (
        <p
          className="max-w-prose"
          style={{ color: colorOr(settings.body_color, 'var(--theme-colors-muted)'), lineHeight: 'var(--theme-line-body)' }}
        >
          {body}
        </p>
      )}
      {ctaText && (
        <div>
          <a
            href={ctaUrl}
            className="inline-flex items-center px-6 py-2.5 mt-2 transition hover:opacity-90"
            style={{ ...ctaStyle, fontWeight: 'var(--theme-weight-bold)' }}
          >
            {ctaText}
          </a>
        </div>
      )}
    </div>
  );

  const imageBlock = resolvedImage ? (
    <div className={ASPECT_CLASS[aspect]} style={mediaFx()}>
      <img src={resolvedImage} alt="" className="w-full h-full object-cover" />
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
    translatable: ['eyebrow', 'heading', 'body', 'cta_text'],
    schema: [
      { key: 'image', type: 'image', label: { en: 'Image', ar: 'الصورة' } },
      {
        key: 'image_position',
        type: 'select',
        label: { en: 'Image position', ar: 'موقع الصورة' },
        defaultValue: 'left',
        options: [
          { value: 'left', label: { en: 'Left', ar: 'يسار' } },
          { value: 'right', label: { en: 'Right', ar: 'يمين' } },
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
      { key: 'eyebrow_color', type: 'color', label: { en: 'Eyebrow color', ar: 'لون التسمية الصغيرة' } },
      { key: 'heading_color', type: 'color', label: { en: 'Heading color', ar: 'لون العنوان' } },
      { key: 'body_color', type: 'color', label: { en: 'Body color', ar: 'لون النص' } },
      { key: 'cta_bg_color', type: 'color', label: { en: 'Button background', ar: 'خلفية الزر' } },
      { key: 'cta_text_color', type: 'color', label: { en: 'Button text color', ar: 'لون نص الزر' } },
      { key: 'cta_border_color', type: 'color', label: { en: 'Button border color', ar: 'لون حدود الزر' } },
      { key: 'cta_border_width', type: 'number', label: { en: 'Button border width (px)', ar: 'سماكة حدود الزر (px)' }, min: 0, max: 8, defaultValue: 0 },
      { key: 'cta_border_radius', type: 'number', label: { en: 'Button corner radius (px)', ar: 'انحناء زوايا الزر (px)' }, min: 0, max: 100 },
    ],
  },
  Component: ImageWithText,
  defaultSettings: { image_position: 'left', aspect: 'square' },
};
