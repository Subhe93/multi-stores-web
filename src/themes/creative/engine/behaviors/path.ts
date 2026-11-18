// Behaviour "path" (contract 4.6): the artwork of a motion-path section
// travels down its line as the page scrolls, the trail fills behind it and
// each stop wakes up when the artwork reaches its marker.
//
// The host is `.cx-mp-body`. Its static state (trail fully drawn, artwork
// parked at the end, every card visible) stays untouched until everything is
// measured; only then the host gets data-cx-live. One scrubbed ScrollTrigger
// drives a progress value; no scroll or resize listener.
//
// Every line preset only moves downward, so progress maps to a height on the
// line: the artwork stays near one viewport line while the page moves, the
// trail is a clip from the top and a stop is passed once the artwork is at
// or below its marker.

import type { Behavior } from '../core';

const SAMPLES = 200;
// Rotation follows the direction over a short window, so a zigzag corner
// turns the artwork in a few frames instead of snapping it.
const TURN_WINDOW = 6;

interface Sample {
  x: number;
  y: number;
}

const path: Behavior = async (el, ctx) => {
  const rail = el.querySelector<HTMLElement>('.cx-mp-rail');
  const art = el.querySelector<HTMLElement>('.cx-mp-art');
  const artInner = el.querySelector<HTMLElement>('.cx-mp-art-in');
  const trail = el.querySelector<HTMLElement>('.cx-mp-trail');
  const stops = Array.from(el.querySelectorAll<HTMLElement>('.cx-mp-stop'));
  if (!rail || !art || !trail || stops.length < 2) return;

  const { gsap } = await ctx.loadGsap();

  const turn = el.hasAttribute('data-cx-rotate') && !ctx.calm && !!artInner;
  let width = 0;
  let height = 0;
  let samples: Sample[] = [];
  let marks: number[] = [];

  /** The line that is displayed at this width (shape from 1024 px, plain line below). */
  const visibleLine = (): SVGPathElement | null => {
    const lines = Array.from(rail.querySelectorAll<SVGPathElement>('.cx-mp-base .cx-mp-p'));
    return lines.find((line) => window.getComputedStyle(line).display !== 'none') || lines[0] || null;
  };

  const measure = () => {
    width = rail.clientWidth;
    height = rail.clientHeight;
    samples = [];
    const line = visibleLine();
    const svg = line?.ownerSVGElement;
    const box = svg?.viewBox?.baseVal;
    if (line && box && box.width > 0 && box.height > 0 && typeof line.getTotalLength === 'function') {
      const total = line.getTotalLength();
      for (let i = 0; i <= SAMPLES; i++) {
        const point = line.getPointAtLength((total * i) / SAMPLES);
        // viewBox units to px; a right-to-left page mirrors the SVG.
        const x = (point.x / box.width) * width;
        samples.push({ x: ctx.rtl ? width - x : x, y: (point.y / box.height) * height });
      }
    }
    if (samples.length < 2) {
      samples = [
        { x: width / 2, y: 0 },
        { x: width / 2, y: height },
      ];
    }
    // Marker centres, relative to the top of the line.
    const top = rail.getBoundingClientRect().top;
    marks = stops.map((stop) => {
      const dot = stop.querySelector<HTMLElement>('.cx-mp-dot');
      const rect = (dot || stop).getBoundingClientRect();
      return rect.top + rect.height / 2 - top;
    });
  };

  /** Index of the last sample at or above `y` (the samples are ordered by y). */
  const indexAt = (y: number): number => {
    let low = 0;
    let high = samples.length - 1;
    while (high - low > 1) {
      const mid = (low + high) >> 1;
      if (samples[mid].y <= y) low = mid;
      else high = mid;
    }
    return low;
  };

  const setX = gsap.quickSetter(art, 'x', 'px') as (value: number) => void;
  const setY = gsap.quickSetter(art, 'y', 'px') as (value: number) => void;
  const setTurn = turn && artInner ? (gsap.quickSetter(artInner, 'rotation', 'deg') as (value: number) => void) : null;

  const state = { p: 0 };
  const render = () => {
    const y = Math.min(height, Math.max(0, state.p * height));
    const i = indexAt(y);
    const a = samples[i];
    const b = samples[Math.min(samples.length - 1, i + 1)];
    const span = b.y - a.y;
    const x = span > 0 ? a.x + ((b.x - a.x) * (y - a.y)) / span : a.x;
    // The artwork is parked (in CSS) at the centre of the line's bottom edge.
    setX(x - width / 2);
    setY(y - height);
    if (setTurn) {
      const from = samples[Math.max(0, i - TURN_WINDOW)];
      const to = samples[Math.min(samples.length - 1, i + TURN_WINDOW)];
      // Upright while moving straight down, leaning into each bend.
      setTurn((-Math.atan2(to.x - from.x, to.y - from.y) * 180) / Math.PI);
    }
    trail.style.setProperty('--cx-mp-clip', `${Math.max(0, height - y).toFixed(1)}px`);
    for (let s = 0; s < stops.length; s++) stops[s].toggleAttribute('data-cx-passed', marks[s] <= y + 1);
  };

  measure();
  const tween = gsap.to(state, {
    p: 1,
    ease: 'none',
    onUpdate: render,
    scrollTrigger: {
      trigger: rail,
      start: 'clamp(top 70%)',
      end: 'clamp(bottom 60%)',
      scrub: 0.8,
      invalidateOnRefresh: true,
      onRefresh: () => {
        measure();
        render();
      },
    },
  });
  // Start from where the page is now, then switch the CSS to the live states.
  state.p = tween.scrollTrigger ? tween.scrollTrigger.progress : 0;
  tween.progress(state.p);
  render();
  el.setAttribute('data-cx-live', '');

  const stopResize = ctx.onResize(() => {
    measure();
    render();
  });

  return () => {
    stopResize();
    tween.scrollTrigger?.kill();
    tween.kill();
    gsap.set(art, { clearProps: 'transform' });
    if (artInner) gsap.set(artInner, { clearProps: 'transform' });
    trail.style.removeProperty('--cx-mp-clip');
    for (const stop of stops) stop.removeAttribute('data-cx-passed');
    el.removeAttribute('data-cx-live');
  };
};

export default path;
