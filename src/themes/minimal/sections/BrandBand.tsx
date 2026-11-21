// Brand band — a full-width closing band: a photo under a dark overlay with
// the brand mark, a wordmark heading between two thin rules, a tagline and an
// optional link button, all centred. Server component, no client code.
//
// Meant as a root section: like the parallax banner it breaks out of the
// page container to the full viewport width.

import { useId } from 'react';
import { resolveMediaUrl } from '@/lib/api';
import { StoreImage } from '@/components/StoreImage';
import { isSvgSrc } from '@/lib/storeMedia';
import type { SectionDefinition, SectionRenderProps } from '../../types';
import { colorOr, numberOr } from '../../elementStyles';
import { Heading } from './_shared/Heading';
import { headingTag } from './_shared/headingLevel';
import { HeadingAccent } from './_shared/HeadingAccent';
import { HEADING_ACCENT_FIELDS } from './_shared/headingAccentFields';
import { focusPosition } from './_shared/BleedSplit';
import { BUTTON_RADIUS } from './_shared/cta';
import { FOCUS_RING, sectionHref } from './_shared/links';
import { MotionText } from '../../creative/primitives/Motion';
import { hover, line, magnetic, parallax, rise } from '../../creative/recipes';
import { MotionRise } from './_shared/MotionStagger';

type BandHeight = 'sm' | 'md' | 'lg';

// Mobile is one step lower than the chosen height.
const HEIGHT_CLASS: Record<BandHeight, string> = {
  sm: 'min-h-[220px] md:min-h-[280px]',
  md: 'min-h-[280px] md:min-h-[400px]',
  lg: 'min-h-[400px] md:min-h-[560px]',
};

const OVERLAY_DEFAULT = 40;
const OVERLAY_MAX = 80;
const LOGO_HEIGHT_DEFAULT = 72;
const LOGO_HEIGHT_MIN = 32;
const LOGO_HEIGHT_MAX = 160;
// The logo keeps its own proportions under this cap (the natural ratio is
// not known on the server, see chrome/headerLogo.ts).
const LOGO_MAX_ASPECT = 5;

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

// Full viewport width from inside the page container.
const FULL_BLEED = {
  width: '100vw',
  maxWidth: '100vw',
  marginInline: 'calc(50% - 50vw)',
} as const;

function BrandBand({ settings, content, locale, primaryLocale, pathPrefix, builderPreview, motion }: SectionRenderProps) {
  const headingId = useId();
  const image = str(settings.image);
  const resolvedImage = image ? resolveMediaUrl(image) : '';
  const logo = str(settings.logo);
  const resolvedLogo = logo ? resolveMediaUrl(logo) : '';
  const heading = str(content.heading);
  const tagline = str(content.tagline);
  const ctaText = str(content.cta_text);

  const height: BandHeight = settings.height === 'sm' || settings.height === 'lg' ? settings.height : 'md';

  if (!resolvedImage && !resolvedLogo && !heading && !tagline && !ctaText) {
    // Nothing on the live store; an empty band outline in the builder only.
    if (!builderPreview) return null;
    return (
      <section
        className={`relative flex items-center justify-center px-6 py-12 ${HEIGHT_CLASS[height]}`}
        style={{ ...FULL_BLEED, backgroundColor: '#101014', color: '#FFFFFF' }}
        data-brand-band-placeholder=""
      >
        <div
          className="h-24 w-full max-w-md"
          style={{
            backgroundColor: 'color-mix(in srgb, currentColor 6%, transparent)',
            border: '1px dashed color-mix(in srgb, currentColor 35%, transparent)',
          }}
        />
      </section>
    );
  }

  const overlay = clamp(numberOr(settings.overlay_opacity, OVERLAY_DEFAULT), 0, OVERLAY_MAX) / 100;
  const logoHeight = clamp(numberOr(settings.logo_height, LOGO_HEIGHT_DEFAULT), LOGO_HEIGHT_MIN, LOGO_HEIGHT_MAX);
  const textColor = colorOr(settings.text_color, '#FFFFFF');
  const headingLevel = headingTag(settings.heading_level, 'h2');
  const ruled = settings.heading_style !== 'plain';

  // Drawn in the text colour itself: the theme border colour would vanish
  // on a photo.
  const rule = (
    <span
      aria-hidden="true"
      className="hidden h-px min-w-8 flex-1 sm:block"
      style={{ backgroundColor: textColor, opacity: 0.7 }}
      {...line(motion, { d: 2 })}
    />
  );

  const photo = resolvedImage ? (
    <StoreImage
      src={resolvedImage}
      // Empty alt = decorative.
      alt={str(content.alt)}
      fill
      sizes="100vw"
      loading="lazy"
      unoptimized={isSvgSrc(resolvedImage)}
      className="object-cover"
      style={{ objectPosition: focusPosition(settings.image_focus) }}
    />
  ) : null;

  return (
    <section
      aria-labelledby={heading ? headingId : undefined}
      className={`relative flex items-center justify-center overflow-hidden px-6 py-12 ${HEIGHT_CLASS[height]}`}
      style={{
        ...FULL_BLEED,
        // Solid dark ground keeps the text readable while the image loads
        // (and when no image is set).
        backgroundColor: '#101014',
        color: textColor,
      }}
    >
      {photo && motion ? (
        // The photo drifts a little slower than the page (the band clips it).
        <div className="absolute inset-0" {...parallax(motion, -6)}>
          {photo}
        </div>
      ) : (
        photo
      )}
      <div className="absolute inset-0" style={{ backgroundColor: `rgba(0,0,0,${overlay})` }} />

      <div className="relative z-10 flex w-full max-w-3xl flex-col items-center gap-4 text-center">
        {resolvedLogo && (
          <MotionRise motion={motion}>
            <StoreImage
              src={resolvedLogo}
              alt=""
              width={logoHeight}
              height={logoHeight}
              sizes={`${logoHeight * LOGO_MAX_ASPECT}px`}
              loading="lazy"
              unoptimized={isSvgSrc(resolvedLogo)}
              className="object-contain"
              style={{
                height: logoHeight,
                width: 'auto',
                maxWidth: `min(${logoHeight * LOGO_MAX_ASPECT}px, 80vw)`,
              }}
            />
          </MotionRise>
        )}
        {heading && (
          <div className="flex w-full items-center justify-center gap-4 md:gap-6">
            {ruled && rule}
            <Heading
              level={headingLevel}
              id={headingId}
              className="min-w-0 max-w-full"
              style={{
                fontFamily: 'var(--theme-font-heading)',
                fontSize: 'var(--theme-scale-h2)',
                fontWeight: 'var(--theme-weight-heading)',
                lineHeight: 'var(--theme-line-heading)',
                letterSpacing: 'var(--theme-tracking-heading)',
                color: textColor,
              }}
            >
              <MotionText motion={motion} text={heading} />
              <HeadingAccent variant={settings.heading_accent} color={settings.heading_accent_color} align="center" />
            </Heading>
            {ruled && rule}
          </div>
        )}
        {tagline && (
          <p
            className="max-w-prose"
            style={{ fontSize: 'var(--theme-scale-body)', lineHeight: 'var(--theme-line-body)', color: textColor }}
            {...rise(motion, { i: 3 })}
          >
            {tagline}
          </p>
        )}
        {ctaText && (
          <MotionRise motion={motion} i={4}>
            <a
              href={sectionHref(settings.cta_url, { locale, primaryLocale, pathPrefix })}
              className={`mt-2 inline-flex items-center justify-center px-7 py-3 text-sm font-semibold transition-opacity hover:opacity-80 ${FOCUS_RING}`}
              style={{
                color: textColor,
                border: `1.5px solid ${textColor}`,
                borderRadius: BUTTON_RADIUS,
                outlineColor: textColor,
              }}
              {...hover(motion, 'press')}
              {...magnetic(motion)}
            >
              {ctaText}
            </a>
          </MotionRise>
        )}
      </div>
    </section>
  );
}

export const brandBandSection: SectionDefinition = {
  needsBuilderPreview: true,
  schema: {
    id: 'brand-band',
    label: { en: 'Brand band', ar: 'شريط العلامة' },
    icon: 'image',
    category: 'showcase',
    description: {
      en: 'A full-width closing band: a photo with your logo, the brand name between two thin rules, a tagline and an optional button.',
      ar: 'شريط ختامي بعرض كامل: صورة مع شعارك واسم العلامة بين خطين رفيعين وعبارة قصيرة وزر اختياري.',
    },
    pageTypes: ['HOME', 'STATIC', 'LANDING', 'FOOTER'],
    translatable: ['alt', 'heading', 'tagline', 'cta_text'],
    schema: [
      { key: 'image', type: 'image', label: { en: 'Image', ar: 'الصورة' } },
      {
        key: 'alt',
        type: 'text',
        label: { en: 'Image description (alt text)', ar: 'وصف الصورة (النص البديل)' },
        description: { en: 'Leave empty when the image is decorative.', ar: 'اتركه فارغاً إذا كانت الصورة للزينة فقط.' },
        maxLength: 160,
      },
      {
        key: 'image_focus',
        type: 'select',
        label: { en: 'Image focus', ar: 'تركيز الصورة' },
        defaultValue: 'center',
        options: [
          { value: 'center', label: { en: 'Center', ar: 'الوسط' } },
          { value: 'top', label: { en: 'Top', ar: 'الأعلى' } },
          { value: 'bottom', label: { en: 'Bottom', ar: 'الأسفل' } },
        ],
      },
      {
        key: 'overlay_opacity',
        type: 'number',
        label: { en: 'Overlay darkness (%)', ar: 'قتامة الطبقة (%)' },
        min: 0,
        max: 80,
        defaultValue: 40,
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
      { key: 'logo', type: 'image', label: { en: 'Logo (optional)', ar: 'الشعار (اختياري)' } },
      {
        key: 'logo_height',
        type: 'number',
        label: { en: 'Logo height (px)', ar: 'ارتفاع الشعار (px)' },
        min: 32,
        max: 160,
        defaultValue: 72,
      },
      { key: 'heading', type: 'text', label: { en: 'Heading', ar: 'العنوان' }, maxLength: 80 },
      ...HEADING_ACCENT_FIELDS,
      {
        key: 'heading_style',
        type: 'select',
        label: { en: 'Heading style', ar: 'نمط العنوان' },
        defaultValue: 'ruled',
        options: [
          { value: 'ruled', label: { en: 'Between two rules', ar: 'بين خطين' } },
          { value: 'plain', label: { en: 'Plain', ar: 'بسيط' } },
        ],
      },
      { key: 'tagline', type: 'text', label: { en: 'Tagline', ar: 'العبارة' }, maxLength: 160 },
      { key: 'text_color', type: 'color', label: { en: 'Text colour', ar: 'لون النص' } },
      { key: 'cta_text', type: 'text', label: { en: 'Button text', ar: 'نص الزر' }, maxLength: 40 },
      { key: 'cta_url', type: 'url', label: { en: 'Button URL', ar: 'رابط الزر' } },
    ],
  },
  Component: BrandBand,
  defaultSettings: { image_focus: 'center', overlay_opacity: 40, height: 'md', logo_height: 72, heading_style: 'ruled' },
  defaultContent: { heading: 'Your brand', tagline: 'A short line about what you stand for' },
};
