// Behaviour "steps" (sticky-steps): one scrubbed ScrollTrigger over the list
// writes the progress of the line (--cx-p, 0..1) and marks every step whose
// marker the line has reached (`data-cx-passed`). The static page (line
// full, every step at full strength) is the default; the dimmed look of the
// steps still ahead exists only under `data-cx-live`, set here first.

import type { Behavior } from '../core';

const steps: Behavior = async (el, ctx) => {
  const items = Array.from(el.querySelectorAll<HTMLElement>('.cx-st-step'));
  if (!items.length) return;

  const { gsap } = await ctx.loadGsap();

  // Position of each marker along the list, 0..1. offsetTop ignores the
  // transform of a step that is still waiting for its reveal.
  let marks: number[] = [];
  const measure = () => {
    const height = el.offsetHeight || 1;
    marks = items.map((item) => {
      const dot = item.querySelector<HTMLElement>('.cx-st-dot');
      const inner = dot && dot.offsetParent === item ? dot.offsetTop + dot.offsetHeight / 2 : 0;
      return (item.offsetTop + inner) / height;
    });
  };

  const state = { p: 0 };
  const write = () => {
    el.style.setProperty('--cx-p', state.p.toFixed(4));
    for (let i = 0; i < items.length; i++) {
      // The last step counts as reached at the very end, whatever its mark.
      const passed = state.p >= marks[i] - 0.0005 || state.p >= 0.9995;
      if (passed !== items[i].hasAttribute('data-cx-passed')) items[i].toggleAttribute('data-cx-passed', passed);
    }
  };

  measure();
  el.setAttribute('data-cx-live', '');
  write();

  const tween = gsap.to(state, {
    p: 1,
    ease: 'none',
    onUpdate: write,
    scrollTrigger: {
      trigger: el,
      start: 'clamp(top 60%)',
      end: 'clamp(bottom 60%)',
      scrub: 0.6,
      invalidateOnRefresh: true,
      onRefresh: () => {
        measure();
        write();
      },
    },
  });

  return () => {
    tween.scrollTrigger?.kill();
    tween.kill();
    el.removeAttribute('data-cx-live');
    el.style.removeProperty('--cx-p');
    for (const item of items) item.removeAttribute('data-cx-passed');
  };
};

export default steps;
