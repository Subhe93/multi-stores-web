'use client';

// TestimonialCarousel — one large spotlight quote at a time with a crossfade
// transition. Schema + section definition live in TestimonialCarousel.tsx;
// this file only exists because the carousel needs client interactivity
// (autoplay, crossfade state, arrow/dot navigation).

import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Quote, Star } from 'lucide-react';
import { resolveMediaUrl } from '@/lib/api';
import type { SectionRenderProps } from '../../types';
import { colorOr } from '../../elementStyles';
import { SectionHeading } from './_shared/SectionHeading';

interface CarouselItem {
  quote?: string;
  author?: string;
  role?: string;
  avatar?: string;
  rating?: number;
}

export function TestimonialCarousel({ settings, content, locale }: SectionRenderProps) {
  const heading = (content.heading as string) || '';
  const items = ((content.items as CarouselItem[]) || []).filter((t) => t.quote || t.author);
  const autoplayMs = typeof settings.autoplay_ms === 'number' ? settings.autoplay_ms : 6000;
  const showRating = settings.show_rating !== false;
  const showArrows = settings.show_arrows !== false;
  const isRtl = locale === 'ar';

  const [activeIdx, setActiveIdx] = useState(0);
  const [paused, setPaused] = useState(false);

  const count = items.length;

  // Autoplay — respects prefers-reduced-motion + pauses on hover/focus.
  useEffect(() => {
    if (!autoplayMs || autoplayMs < 1000 || paused || count <= 1) return;
    if (
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      return;
    }
    const id = window.setInterval(() => {
      setActiveIdx((i) => (i + 1) % count);
    }, autoplayMs);
    return () => window.clearInterval(id);
  }, [autoplayMs, paused, count]);

  // Per-element color overrides — each falls back to the active theme token.
  const quoteIconColor = colorOr(settings.quote_icon_color, 'var(--theme-colors-primary)');
  const quoteColor = colorOr(settings.quote_color, 'var(--theme-colors-text)');
  const authorColor = colorOr(settings.author_color, 'var(--theme-colors-text)');
  const roleColor = colorOr(settings.role_color, 'var(--theme-colors-muted)');
  const starColor = colorOr(settings.star_color, 'var(--theme-colors-primary)');
  const starEmptyColor = colorOr(settings.star_empty_color, 'var(--theme-colors-border)');

  // Stay visible while empty so creators can see placement in the builder.
  if (count === 0) {
    return (
      <section className="py-12">
        <div
          className="text-center py-10 px-4"
          style={{
            border: '1px dashed var(--theme-colors-border)',
            borderRadius: 'var(--theme-radius-md)',
            color: 'var(--theme-colors-muted)',
          }}
        >
          <p className="text-sm">
            {isRtl ? 'لا توجد آراء بعد. أضف عناصر من البيلدر.' : 'No testimonials yet. Add some from the builder.'}
          </p>
        </div>
      </section>
    );
  }

  function prev() {
    setActiveIdx((i) => (i - 1 + count) % count);
  }
  function next() {
    setActiveIdx((i) => (i + 1) % count);
  }

  // In RTL the "previous" arrow visually points to the right and sits at the
  // physical right edge, so swap the glyphs.
  const PrevIcon = isRtl ? ChevronRight : ChevronLeft;
  const NextIcon = isRtl ? ChevronLeft : ChevronRight;

  return (
    <section className="py-14 md:py-20">
      {heading && (
        <div className="mb-10">
          <SectionHeading heading={heading} align="center" headingColor={settings.heading_color} />
        </div>
      )}

      <div
        className="relative max-w-3xl mx-auto px-10 sm:px-14"
        role="region"
        aria-roledescription="carousel"
        aria-label={isRtl ? 'آراء العملاء' : 'Customer testimonials'}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocusCapture={() => setPaused(true)}
        onBlurCapture={() => setPaused(false)}
      >
        {/* Crossfade stack: every slide occupies the same grid cell so the
            container reserves the tallest slide's height — no layout shift
            between quotes of different lengths. */}
        <div className="grid">
          {items.map((t, i) => {
            const rating = Math.max(0, Math.min(5, Number(t.rating) || 0));
            const active = i === activeIdx;
            return (
              <figure
                key={i}
                aria-hidden={!active}
                className={`col-start-1 row-start-1 flex flex-col items-center text-center gap-6 transition-opacity duration-500 ease-out ${
                  active ? 'opacity-100' : 'opacity-0 pointer-events-none'
                }`}
              >
                <Quote className="size-8 shrink-0" style={{ color: quoteIconColor, opacity: 0.5 }} />
                {showRating && rating > 0 && (
                  <div className="flex gap-1">
                    {Array.from({ length: 5 }).map((_, s) => (
                      <Star
                        key={s}
                        className="size-5"
                        style={{
                          color: s < rating ? starColor : starEmptyColor,
                          fill: s < rating ? starColor : 'transparent',
                        }}
                      />
                    ))}
                  </div>
                )}
                {t.quote && (
                  <blockquote
                    className="leading-relaxed"
                    style={{
                      fontFamily: 'var(--theme-font-heading)',
                      fontSize: 'clamp(1.15rem, 2.2vw, 1.55rem)',
                      color: quoteColor,
                    }}
                  >
                    {t.quote}
                  </blockquote>
                )}
                <figcaption className="flex flex-col items-center gap-3 mt-2">
                  {t.avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={resolveMediaUrl(t.avatar)}
                      alt={t.author || ''}
                      loading="lazy"
                      className="size-14 rounded-full object-cover"
                      style={{ boxShadow: 'var(--theme-shadow-sm)' }}
                    />
                  ) : (
                    <div
                      className="size-14 rounded-full"
                      style={{ backgroundColor: 'var(--theme-colors-border)' }}
                    />
                  )}
                  <div>
                    {t.author && (
                      <div className="text-sm font-semibold leading-tight" style={{ color: authorColor }}>
                        {t.author}
                      </div>
                    )}
                    {t.role && (
                      <div className="text-xs mt-1" style={{ color: roleColor }}>
                        {t.role}
                      </div>
                    )}
                  </div>
                </figcaption>
              </figure>
            );
          })}
        </div>

        {showArrows && count > 1 && (
          <>
            <button
              type="button"
              onClick={prev}
              aria-label={isRtl ? 'الرأي السابق' : 'Previous testimonial'}
              className="absolute start-0 top-1/2 -translate-y-1/2 z-10 size-9 rounded-full flex items-center justify-center transition-all duration-200 hover:-translate-y-[calc(50%+2px)]"
              style={{
                backgroundColor: 'var(--theme-colors-surface)',
                border: '1px solid var(--theme-colors-border)',
                color: 'var(--theme-colors-text)',
                boxShadow: 'var(--theme-shadow-sm)',
              }}
            >
              <PrevIcon className="size-5" />
            </button>
            <button
              type="button"
              onClick={next}
              aria-label={isRtl ? 'الرأي التالي' : 'Next testimonial'}
              className="absolute end-0 top-1/2 -translate-y-1/2 z-10 size-9 rounded-full flex items-center justify-center transition-all duration-200 hover:-translate-y-[calc(50%+2px)]"
              style={{
                backgroundColor: 'var(--theme-colors-surface)',
                border: '1px solid var(--theme-colors-border)',
                color: 'var(--theme-colors-text)',
                boxShadow: 'var(--theme-shadow-sm)',
              }}
            >
              <NextIcon className="size-5" />
            </button>
          </>
        )}

        {count > 1 && (
          <div className="flex justify-center gap-1.5 mt-8">
            {items.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setActiveIdx(i)}
                aria-label={isRtl ? `الانتقال إلى الرأي ${i + 1}` : `Go to testimonial ${i + 1}`}
                aria-current={i === activeIdx ? 'true' : undefined}
                className="h-2 rounded-full transition-all duration-300"
                style={{
                  width: i === activeIdx ? '1.5rem' : '0.5rem',
                  backgroundColor:
                    i === activeIdx ? 'var(--theme-colors-primary)' : 'var(--theme-colors-border)',
                }}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
