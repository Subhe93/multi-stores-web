'use client';

// HeroSlider — full-width hero carousel. Each slide carries its own image,
// eyebrow, heading, subheading and CTAs. Schema + section definition live in
// HeroSlider.tsx; this file only exists because the slider needs client
// interactivity (autoplay, scroll listener, arrow buttons).

import { resolveMediaUrl } from '@/lib/api';
import type { SectionRenderProps } from '../../types';
import { buttonStyles, colorOr } from '../../elementStyles';
import { Slider } from './_shared/Slider.client';

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

export function HeroSlider({ settings, content, locale }: SectionRenderProps) {
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

    return (
      <div
        key={i}
        className={`relative overflow-hidden flex px-6 sm:px-12 ${HEIGHT_CLASS[height]}`}
        style={{ color: '#fff' }}
      >
        {resolvedImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={resolvedImage}
            alt={slide.heading || ''}
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
        <div className={`relative w-full max-w-5xl mx-auto flex flex-col justify-center gap-4 ${alignClass}`} style={{ zIndex: 2 }}>
          {slide.eyebrow && (
            <span
              className="text-xs font-semibold uppercase tracking-[0.2em] opacity-80"
              style={{ color: colorOr(settings.eyebrow_color, 'var(--theme-colors-accent)') }}
            >
              {slide.eyebrow}
            </span>
          )}
          {slide.heading && (
            <h2
              className="leading-[1.05] tracking-tight max-w-3xl"
              style={{
                fontFamily: 'var(--theme-font-heading)',
                fontSize: 'var(--theme-scale-h1)',
                fontWeight: 'var(--theme-weight-heading)',
                color: colorOr(settings.heading_color, '#fff'),
              }}
            >
              {slide.heading}
            </h2>
          )}
          {slide.subheading && (
            <p
              className="max-w-2xl"
              style={{
                fontSize: 'var(--theme-scale-body)',
                color: colorOr(settings.subheading_color, 'rgba(255,255,255,0.88)'),
                lineHeight: 'var(--theme-line-body)',
              }}
            >
              {slide.subheading}
            </p>
          )}
          {slide.cta_text && (
            <a
              href={slide.cta_url || '#'}
              className="inline-flex items-center justify-center px-8 py-3 mt-2 transition-all hover:opacity-90 hover:-translate-y-px self-start"
              style={{
                ...ctaStyle,
                fontWeight: 'var(--theme-weight-bold)',
                boxShadow: 'var(--theme-shadow-md)',
                alignSelf:
                  alignment === 'center' ? 'center' : alignment === 'right' ? 'flex-end' : 'flex-start',
              }}
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
