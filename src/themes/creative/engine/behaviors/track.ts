// Behaviour "track" (story-pinned): moves the row of cards sideways while
// the CSS-sticky stage holds the section in place. No ScrollTrigger pin: the
// tall track and the sticky stage are pure CSS, present at first paint.
//
// It runs only while the stage really is sticky (desktop, fine pointer, gate
// open, no ancestor that breaks sticky). Otherwise the native swipe row of
// the static page stays as it is.

import type { Behavior, Cleanup } from '../core';
import type { GsapBundle } from '../gsap';

interface LenisLike {
  scrollTo(target: number, options?: { immediate?: boolean; force?: boolean }): void;
}

const track: Behavior = (el, ctx) => {
  const stage = el.querySelector<HTMLElement>('.cx-track-stage');
  const view = el.querySelector<HTMLElement>('.cx-track-view');
  const row = el.querySelector<HTMLElement>('.cx-track-row');
  if (!stage || !view || !row) return;

  const isSticky = () => window.getComputedStyle(stage).position === 'sticky';
  // Touch devices never pin: nothing to do, and GSAP is not loaded.
  if (!isSticky() && !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

  let dead = false;
  let gsap: GsapBundle['gsap'] | null = null;
  let loading = false;
  const current = ctx.scope.querySelector<HTMLElement>('[data-cx-current]');
  const cards = Array.from(row.querySelectorAll<HTMLElement>('[data-cx-card-item]'));
  const initialCount = current?.textContent ?? '';
  // In RTL the row overflows toward the left: it travels the other way.
  const sign = ctx.rtl ? 1 : -1;
  const distance = () => Math.max(0, row.scrollWidth - view.clientWidth);

  let tween: gsap.core.Tween | null = null;

  const write = () => {
    if (!tween) return;
    const p = tween.progress();
    el.style.setProperty('--cx-p', p.toFixed(4));
    if (current && cards.length) {
      const n = Math.min(cards.length, 1 + Math.round(p * (cards.length - 1)));
      const label = String(n).padStart(2, '0');
      if (current.textContent !== label) current.textContent = label;
    }
  };

  const build = () => {
    if (!gsap || tween || !isSticky()) return;
    // The view was natively scrollable until now.
    view.scrollLeft = 0;
    tween = gsap.to(row, {
      x: () => sign * distance(),
      ease: 'none',
      onUpdate: write,
      scrollTrigger: {
        trigger: el,
        // The stage sticks below the store header.
        start: () => `clamp(top ${ctx.headerHeight()}px)`,
        end: 'clamp(bottom bottom)',
        scrub: 0.8,
        invalidateOnRefresh: true,
        onToggle: (self) => {
          // will-change only while the row is travelling.
          row.style.willChange = self.isActive ? 'transform' : '';
        },
      },
    });
    // Only now does the layout depend on JavaScript (overflow: clip).
    el.setAttribute('data-cx-live', '');
    write();
  };

  const teardown = () => {
    if (!gsap || !tween) return;
    tween.scrollTrigger?.kill();
    tween.kill();
    tween = null;
    gsap.set(row, { clearProps: 'transform,willChange' });
    el.removeAttribute('data-cx-live');
    el.style.removeProperty('--cx-p');
    if (current) current.textContent = initialCount;
  };

  // Keyboard: a focused link in a card that is off screen brings the page to
  // that card's position (the clipped view cannot scroll by itself).
  const onFocus = (event: FocusEvent) => {
    const st = tween?.scrollTrigger;
    const target = event.target as HTMLElement | null;
    if (!st || !target || typeof target.closest !== 'function') return;
    if (typeof target.matches === 'function' && !target.matches(':focus-visible')) return;
    const card = target.closest<HTMLElement>('.cx-track-row > li');
    if (!card) return;
    const cardRect = card.getBoundingClientRect();
    const viewRect = view.getBoundingClientRect();
    if (cardRect.left >= viewRect.left && cardRect.right <= viewRect.right) return;
    const max = distance();
    if (max <= 0) return;
    const rowRect = row.getBoundingClientRect();
    const pad = parseFloat(window.getComputedStyle(row).paddingInlineStart) || 0;
    const offset = ctx.rtl ? rowRect.right - cardRect.right : cardRect.left - rowRect.left;
    const progress = Math.min(1, Math.max(0, (offset - pad) / max));
    const top = st.start + progress * (st.end - st.start);
    const lenis = (window as unknown as { __lenis?: LenisLike }).__lenis;
    if (lenis) lenis.scrollTo(top, { immediate: true, force: true });
    // 'instant': the page sets scroll-behavior smooth, which would animate the jump.
    else window.scrollTo({ top, behavior: 'instant' });
  };

  // GSAP is fetched the first time the stage is actually pinned.
  const sync = () => {
    if (dead) return;
    if (!isSticky()) {
      teardown();
      return;
    }
    if (gsap) {
      build();
      return;
    }
    if (loading) return;
    loading = true;
    ctx
      .loadGsap()
      .then((bundle) => {
        gsap = bundle.gsap;
        if (!dead) build();
      })
      // A failed chunk leaves the native horizontal scroll of the view.
      .catch(() => {
        loading = false;
      });
  };

  sync();
  row.addEventListener('focusin', onFocus);

  // The window crossed the desktop breakpoint, or the header changed height.
  const stopResize: Cleanup = ctx.onResize(sync);

  return () => {
    dead = true;
    stopResize();
    row.removeEventListener('focusin', onFocus);
    teardown();
  };
};

export default track;
