'use client';

// Shared slider primitive used by HeroSlider, GallerySlider, ProductSlider.
// Built on native CSS scroll-snap: no library, no virtual DOM trickery,
// touch/swipe works for free. JS only manages: arrow navigation, dot
// indicators, current-slide tracking (via scroll listener), and autoplay.
//
// Each consumer passes its slides as children — the primitive doesn't care
// what's inside them, only how many per view and how wide.

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface SliderProps {
  slides: ReactNode[];
  /** Visible slides on >= 1024px viewports. */
  slidesPerView?: number;
  /** Visible slides on 768–1023px viewports. Defaults to `slidesPerView`. */
  slidesPerViewTablet?: number;
  /** Visible slides on <= 767px viewports. Defaults to `slidesPerViewTablet`. */
  slidesPerViewMobile?: number;
  gapPx?: number;
  /** Autoplay interval in ms. 0 / undefined disables autoplay. */
  autoplayMs?: number;
  showArrows?: boolean;
  showDots?: boolean;
  /** When true, prev/next + autoplay wrap around at the ends. */
  loop?: boolean;
  /** Accessible label announced by screen readers for the carousel region. */
  ariaLabel?: string;
  /** Direction for RTL-aware arrow placement. */
  dir?: 'ltr' | 'rtl';
}

export function Slider({
  slides,
  slidesPerView = 1,
  slidesPerViewTablet,
  slidesPerViewMobile,
  gapPx = 16,
  autoplayMs,
  showArrows = true,
  showDots = true,
  loop = false,
  ariaLabel,
  dir = 'ltr',
}: SliderProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  // useId gives us a stable, instance-scoped id so the injected <style> block
  // doesn't bleed slide widths across multiple Slider instances on a page.
  const rawId = useId();
  const scopeId = `sl-${rawId.replace(/[^a-zA-Z0-9_-]/g, '')}`;

  const tabletSpv = slidesPerViewTablet ?? slidesPerView;
  const mobileSpv = slidesPerViewMobile ?? tabletSpv;
  const slideCount = slides.length;

  // Track which slide is currently most-left in the viewport. Used to drive
  // dot indicators + arrow disabled state. Reads on every scroll event;
  // throttled implicitly by the browser's passive event delivery.
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    function onScroll() {
      if (!el) return;
      const children = Array.from(el.children).filter(
        (c): c is HTMLElement => c instanceof HTMLElement && c.dataset.slide === 'true',
      );
      const scrollLeft = Math.abs(el.scrollLeft); // RTL browsers report negative
      let closest = 0;
      let minDelta = Infinity;
      for (let i = 0; i < children.length; i++) {
        const delta = Math.abs(children[i].offsetLeft - scrollLeft);
        if (delta < minDelta) {
          minDelta = delta;
          closest = i;
        }
      }
      setActiveIdx(closest);
    }
    el.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => el.removeEventListener('scroll', onScroll);
  }, [slideCount]);

  // Autoplay — respects prefers-reduced-motion + pauses on hover/focus.
  useEffect(() => {
    if (!autoplayMs || autoplayMs < 1000 || paused || slideCount <= 1) return;
    if (
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      return;
    }
    const id = window.setInterval(() => {
      const el = scrollerRef.current;
      if (!el) return;
      const next = activeIdx + 1;
      if (next >= slideCount) {
        if (loop) scrollToIdx(0);
        // else: stop at the end — natural carousel behaviour for non-loop.
        return;
      }
      scrollToIdx(next);
    }, autoplayMs);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoplayMs, activeIdx, slideCount, loop, paused]);

  function scrollToIdx(i: number) {
    const el = scrollerRef.current;
    if (!el) return;
    const idx = ((i % slideCount) + slideCount) % slideCount;
    const children = Array.from(el.children).filter(
      (c): c is HTMLElement => c instanceof HTMLElement && c.dataset.slide === 'true',
    );
    const target = children[idx];
    if (target) {
      el.scrollTo({ left: target.offsetLeft, behavior: 'smooth' });
    }
  }

  function prev() {
    if (loop || activeIdx > 0) scrollToIdx(activeIdx - 1);
  }
  function next() {
    if (loop || activeIdx < slideCount - 1) scrollToIdx(activeIdx + 1);
  }

  // CSS variables drive per-breakpoint slide widths; the injected <style>
  // applies media-query overrides. Inline styles can't carry media queries,
  // so this <style> block is the cleanest place to tie viewport → slidesPerView.
  const styleVars: React.CSSProperties = {
    ['--spv-desktop' as never]: String(slidesPerView),
    ['--spv-tablet' as never]: String(tabletSpv),
    ['--spv-mobile' as never]: String(mobileSpv),
    ['--gap' as never]: `${gapPx}px`,
  };

  const ArrowStart = dir === 'rtl' ? ChevronRight : ChevronLeft;
  const ArrowEnd = dir === 'rtl' ? ChevronLeft : ChevronRight;
  const atStart = !loop && activeIdx === 0;
  const atEnd = !loop && activeIdx >= slideCount - 1;

  return (
    <div
      className={`relative ${scopeId}`}
      role="region"
      aria-label={ariaLabel}
      aria-roledescription="carousel"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      style={styleVars}
    >
      <div
        ref={scrollerRef}
        className={`flex overflow-x-auto snap-x snap-mandatory scroll-smooth ${scopeId}-track`}
        style={{ gap: 'var(--gap)' }}
      >
        {slides.map((s, i) => (
          <div
            key={i}
            data-slide="true"
            className={`snap-start shrink-0 ${scopeId}-slide`}
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1} / ${slideCount}`}
            aria-hidden={i !== activeIdx ? undefined : false}
          >
            {s}
          </div>
        ))}
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
.${scopeId}-track { scrollbar-width: none; -ms-overflow-style: none; }
.${scopeId}-track::-webkit-scrollbar { display: none; }
.${scopeId}-slide { flex-basis: calc((100% - var(--gap) * (var(--spv-desktop) - 1)) / var(--spv-desktop)); }
@media (max-width: 1023px) {
  .${scopeId}-slide { flex-basis: calc((100% - var(--gap) * (var(--spv-tablet) - 1)) / var(--spv-tablet)); }
}
@media (max-width: 767px) {
  .${scopeId}-slide { flex-basis: calc((100% - var(--gap) * (var(--spv-mobile) - 1)) / var(--spv-mobile)); }
}
        `.trim(),
        }}
      />

      {showArrows && slideCount > 1 && (
        <>
          <button
            type="button"
            onClick={prev}
            aria-label="Previous slide"
            disabled={atStart}
            className="absolute left-2 rtl:right-2 rtl:left-auto top-1/2 -translate-y-1/2 z-10 size-9 rounded-full bg-white/85 backdrop-blur shadow-md flex items-center justify-center hover:bg-white transition disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ArrowStart className="size-5 text-zinc-800" />
          </button>
          <button
            type="button"
            onClick={next}
            aria-label="Next slide"
            disabled={atEnd}
            className="absolute right-2 rtl:left-2 rtl:right-auto top-1/2 -translate-y-1/2 z-10 size-9 rounded-full bg-white/85 backdrop-blur shadow-md flex items-center justify-center hover:bg-white transition disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ArrowEnd className="size-5 text-zinc-800" />
          </button>
        </>
      )}

      {showDots && slideCount > 1 && (
        <div className="flex justify-center gap-1.5 mt-4">
          {Array.from({ length: slideCount }).map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => scrollToIdx(i)}
              aria-label={`Go to slide ${i + 1}`}
              aria-current={i === activeIdx ? 'true' : undefined}
              className={`h-2 rounded-full transition-all ${
                i === activeIdx ? 'bg-zinc-900 w-6' : 'bg-zinc-300 hover:bg-zinc-500 w-2'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
