// Behaviour "draw": the line-draw of "ornament-line" (contract 4.8).
//
// The host carries data-cx-draw="once" | "scroll". The ornament is fully
// drawn by default; this behaviour only takes it back to "not drawn yet"
// when the host is still BELOW the viewport, so nothing that the visitor
// already sees ever disappears.
//
// - once:   marks the host data-cx-armed (CSS hides the strokes), then one
//           IntersectionObserver sets data-cx-drawn and a CSS transition
//           draws it. No GSAP.
// - scroll: loads GSAP and scrubs --cx-p (0..1) on the host between
//           "top 85%" and "top 45%"; data-cx-live switches the CSS to it.

import { observeOnce } from '../../../_motion/inView';
import type { Behavior } from '../core';

// The drawing starts when the host's top passes 88 % of the viewport.
const ONCE_MARGIN = '0px 0px -12% 0px';

const draw: Behavior = async (el, ctx) => {
  const mode = el.getAttribute('data-cx-draw');
  if (mode !== 'once' && mode !== 'scroll') return;

  const vh = window.innerHeight || document.documentElement.clientHeight;
  const top = el.getBoundingClientRect().top;
  // On screen or already scrolled past: stays drawn.
  if (top < vh) return;

  if (mode === 'once') {
    el.setAttribute('data-cx-armed', '');
    // A host near the end of the page may never reach the 88 % line.
    const maxScroll = Math.max(0, document.documentElement.scrollHeight - vh);
    const topAtEnd = top + window.scrollY - maxScroll;
    const rootMargin = topAtEnd > vh * 0.88 ? '0px' : ONCE_MARGIN;
    const stop = observeOnce(el, () => el.setAttribute('data-cx-drawn', ''), { rootMargin });
    return () => {
      stop();
      el.removeAttribute('data-cx-armed');
      el.removeAttribute('data-cx-drawn');
    };
  }

  const { gsap } = await ctx.loadGsap();
  // The scope may have unregistered while the chunk loaded; the core then
  // calls the cleanup returned below at once.
  el.style.setProperty('--cx-p', '0');
  const tween = gsap.fromTo(
    el,
    { '--cx-p': 0 },
    {
      '--cx-p': 1,
      ease: 'none',
      scrollTrigger: {
        trigger: el,
        start: 'clamp(top 85%)',
        end: 'clamp(top 45%)',
        scrub: 0.6,
        invalidateOnRefresh: true,
      },
    },
  );
  // Only now: the strokes follow --cx-p instead of being fully drawn.
  el.setAttribute('data-cx-live', '');

  return () => {
    tween.scrollTrigger?.kill();
    tween.kill();
    el.removeAttribute('data-cx-live');
    el.style.removeProperty('--cx-p');
  };
};

export default draw;
