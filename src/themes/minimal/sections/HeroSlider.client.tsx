'use client';

// HeroSlider — full-width hero carousel. Each slide carries its own image,
// eyebrow, heading, subheading and CTAs. Schema + section definition live in
// HeroSlider.tsx; this file only exists because the slider needs client
// interactivity (autoplay, scroll listener, arrow buttons).

import { resolveMediaUrl } from '@/lib/api';
import { StoreImage } from '@/components/StoreImage';
import { sectionHref } from './_shared/links';
import type { SectionRenderProps } from '../../types';
import { buttonStyles, colorOr } from '../../elementStyles';
import { Slider } from './_shared/Slider.client';
import { headingTag, textTag } from './_shared/headingLevel';
import { Heading } from './_shared/Heading';
import { HeadingAccent } from './_shared/HeadingAccent';
import { isSvgSrc } from '@/lib/storeMedia';
import { MotionMedia, MotionText } from '../../creative/primitives/Motion';
import { hover, magnetic, rise } from '../../creative/recipes';

// Class hooks of the hero rules in creative/css/hero.css.ts. Added only when
// the slide got a motion value, so the markup is unchanged without it.
const withMotion = (motion: unknown, base: string, hook: string) => (motion ? `${base} ${hook}` : base);

type HeroHeight = 'sm' | 'md' | 'lg' | 'full';
type Alignment = 'left' | 'center' | 'right';

interface HeroSlide {
  image?: string;
  eyebrow?: string;
  heading?: string;
  subheading?: string;
  cta_text?: string;
  cta_url?: string;
  alignment?: Alignment;
}

const HEIGHT_CLASS: Record<HeroHeight, string> = {
  sm: 'min-h-[320px]',
  md: 'min-h-[480px]',
  lg: 'min-h-[640px]',
  full: 'min-h-[calc(100vh-80px)]',
};

export function HeroSlider({ settings, content, locale, primaryLocale, pathPrefix, motion }: SectionRenderProps) {
  // First slide carries the section's heading level (default h1: a slider
  // usually opens the page); later slides step down to h2 when it is h1.
  const firstHeading = headingTag(settings.heading_level, 'h1');
  const eyebrowTag = textTag(settings.eyebrow_tag, 'span');
  const subheadingTag = textTag(settings.subheading_tag, 'p');
  const slideHeading = (i: number) => (i === 0 || firstHeading !== 'h1' ? firstHeading : 'h2');
  const slides = ((content.slides as HeroSlide[]) || []).filter(
    (s) => s.image || s.heading || s.subheading,
  );
  const height = (settings.height as HeroHeight) || 'md';
  const overlayOpacity =
    typeof settings.overlay_opacity === 'number' ? settings.overlay_opacity : 0.4;
  const autoplayMs = (settings.autoplay_ms as number) || 0;
  const showArrows = settings.show_arrows !== false;
  const showDots = settings.show_dots !== false;
  const loop = settings.loop !== false;
  const dir: 'ltr' | 'rtl' = locale === 'ar' ? 'rtl' : 'ltr';

  // Section-level per-element style overrides. Applied to every slide so the
  // slider keeps a coherent visual identity.
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

  if (slides.length === 0) {
    return (
      <section
        className="text-center py-16 px-4"
        style={{
          border: '1px dashed var(--theme-colors-border)',
          borderRadius: 'var(--theme-radius-md)',
          color: 'var(--theme-colors-muted)',
        }}
      >
        <p className="text-sm">
          {locale === 'ar'
            ? 'لا توجد شرائح بعد. أضف شريحة من البيلدر.'
            : 'No slides yet. Add a slide from the builder.'}
        </p>
      </section>
    );
  }

  const slideNodes = slides.map((slide, i) => {
    const resolvedImage = slide.image ? resolveMediaUrl(slide.image) : '';
    const alignment = slide.alignment || 'center';
    // Content is a column flex, so `items-*` (cross axis) controls HORIZONTAL
    // placement and `justify-*` (main axis) controls VERTICAL. Alignment must
    // only move the text left/right — keep it vertically centred always, or
    // "left" lands top-left and "right" lands bottom-right.
    const alignClass =
      alignment === 'left'
        ? 'text-left items-start'
        : alignment === 'right'
          ? 'text-right items-end'
          : 'text-center items-center';

    const SlideHeading = slideHeading(i);
    // Store motion style: the first slide enters like any hero; the other
    // slides are already complete when the visitor reaches them, and a slide
    // change keeps the slider's own native transition.
    const m = i === 0 ? motion : undefined;
    const slideImage = resolvedImage ? (
      // First slide is the LCP candidate: preload it. The next slide loads
      // eagerly too (it can sit outside the lazy threshold until autoplay
      // reaches it); the rest lazy-load.
      <StoreImage
        src={resolvedImage}
        alt={slide.heading || ''}
        fill
        sizes="100vw"
        preload={i === 0}
        fetchPriority={i === 0 ? 'high' : undefined}
        loading={i === 0 ? undefined : i === 1 ? 'eager' : 'lazy'}
        unoptimized={isSvgSrc(resolvedImage)}
        className="object-cover"
        style={{ zIndex: 0 }}
      />
    ) : null;
    return (
      <div
        key={i}
        className={`relative overflow-hidden flex px-6 sm:px-12 ${HEIGHT_CLASS[height]}`}
        style={{ color: '#fff' }}
      >
        {m === 'intro' ? (
          // Settles from a slight zoom; never clipped or hidden (LCP).
          slideImage && (
            <MotionMedia motion={m} priority fill>
              {slideImage}
            </MotionMedia>
          )
        ) : (
          slideImage
        )}
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(180deg, rgba(0,0,0,${overlayOpacity * 0.7}) 0%, rgba(0,0,0,${overlayOpacity}) 100%)`,
            zIndex: 1,
          }}
        />
        <div className={`relative w-full max-w-5xl mx-auto flex flex-col justify-center gap-4 ${alignClass}`} style={{ zIndex: 2 }}>
          {slide.eyebrow && (
            <Heading level={eyebrowTag} original="span" look="body"
              className={withMotion(m, 'text-xs font-semibold uppercase tracking-[0.2em] opacity-80', 'cx-hero-t')}
              style={{ color: colorOr(settings.eyebrow_color, 'var(--theme-colors-accent)') }}
              {...rise(m)}
            >
              {slide.eyebrow}
            </Heading>
          )}
          {slide.heading && (
            <Heading level={SlideHeading}
              className={withMotion(m, 'leading-[1.05] tracking-tight max-w-3xl', 'cx-hero-h')}
              style={{
                fontFamily: 'var(--theme-font-heading)',
                fontSize: 'var(--theme-scale-h1)',
                fontWeight: 'var(--theme-weight-heading)',
                color: colorOr(settings.heading_color, '#fff'),
              }}
            >
              <MotionText motion={m} text={slide.heading} />
              <HeadingAccent variant={settings.heading_accent} color={settings.heading_accent_color} align={alignment} />
            </Heading>
          )}
          {slide.subheading && (
            <Heading level={subheadingTag} look="body"
              className={withMotion(m, 'max-w-2xl', 'cx-hero-t')}
              style={{
                fontSize: 'var(--theme-scale-body)',
                color: colorOr(settings.subheading_color, 'rgba(255,255,255,0.88)'),
                lineHeight: 'var(--theme-line-body)',
              }}
              {...rise(m, { i: 2 })}
            >
              {slide.subheading}
            </Heading>
          )}
          {slide.cta_text && (
            <a
              href={sectionHref(slide.cta_url, { locale, primaryLocale, pathPrefix })}
              className={withMotion(
                m,
                'inline-flex items-center justify-center px-8 py-3 mt-2 transition-all hover:opacity-90 hover:-translate-y-px self-start',
                'cx-hero-t cx-hero-btn',
              )}
              style={{
                ...ctaStyle,
                fontWeight: 'var(--theme-weight-bold)',
                boxShadow: 'var(--theme-shadow-md)',
                alignSelf:
                  alignment === 'center' ? 'center' : alignment === 'right' ? 'flex-end' : 'flex-start',
              }}
              {...rise(m, { i: 3 })}
              {...hover(m, 'press')}
              {...magnetic(m)}
            >
              {slide.cta_text}
            </a>
          )}
        </div>
      </div>
    );
  });

  return (
    <Slider
      slides={slideNodes}
      slidesPerView={1}
      gapPx={0}
      autoplayMs={autoplayMs > 0 ? autoplayMs : undefined}
      showArrows={showArrows}
      showDots={showDots}
      loop={loop}
      dir={dir}
      ariaLabel={locale === 'ar' ? 'سلايدر البانر الرئيسي' : 'Hero slider'}
    />
  );
}
