// Behaviour "actor" (stage-scenes): one artwork stays on stage across the
// colour scenes. The host is `.cx-ss-stage`; its first child is the sticky
// actor layer (css/stageScenes.css.ts), followed by the scenes, each with a
// slot that holds the static image.
//
// Poses are measured, never configured: for every scene, the centre and the
// size of its slot relative to the scene, plus the slot's scale and tilt
// (the tilt leans toward the copy, so its sign follows the side and the
// direction of the page). While the page scrolls, the artwork travels from
// one pose to the next during the hand-over between two scenes: from the
// moment the next scene's top reaches 90 % of the viewport until it is
// nearly settled under the header. In between it holds its pose. The path
// dips in a slight arc; a second view cross-fades with a short squash, as
// if the object turned.
//
// One scrubbed ScrollTrigger drives a progress value over the stage's whole
// pass; positions are recomputed on refresh and resize. No scroll or resize
// listener. Runs only while the actor layer really is sticky (desktop, fine
// pointer, gate open) and there are at least two scenes; until it has
// measured everything the static page stays as it is.

import type { Behavior } from '../core';

interface Pose {
  x: number;
  y: number;
  s: number;
  r: number;
  view: number;
}

const TILT: Record<string, number> = { none: 0, soft: 8, strong: 14 };
// Hand-over window of a scene boundary, as positions of the next scene's top.
const HANDOVER_FROM = 0.9; // of the viewport height
const HANDOVER_TO = 0.08; // of the viewport height, below the header
const ARC = 0.04; // dip at mid-way, of the viewport height

const easeInOut = (t: number): number => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const clamp01 = (t: number): number => (t < 0 ? 0 : t > 1 ? 1 : t);
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

const actor: Behavior = async (el, ctx) => {
  const layer = el.querySelector<HTMLElement>('.cx-ss-actor');
  const box = el.querySelector<HTMLElement>('.cx-ss-actor-o');
  const scenes = Array.from(el.querySelectorAll<HTMLElement>('.cx-ss-scene'));
  if (!layer || !box || scenes.length < 2) return;
  if (window.getComputedStyle(layer).position !== 'sticky') return;
  const slots = scenes.map((scene) => scene.querySelector<HTMLElement>('[data-cx-slot]'));
  if (slots.some((slot) => !slot)) return;
  const views = Array.from(box.querySelectorAll<HTMLElement>('.cx-ss-view'));
  const second = views.find((v) => v.getAttribute('data-cx-view') === '2') || null;

  const { gsap } = await ctx.loadGsap();

  // The artwork must be decoded before it is shown in place of the slots.
  await Promise.all(
    Array.from(box.querySelectorAll('img')).map((img) =>
      typeof img.decode === 'function' ? img.decode().catch(() => undefined) : undefined,
    ),
  );
  if (!el.isConnected || window.getComputedStyle(layer).position !== 'sticky') return;

  const calm = ctx.calm;
  let poses: Pose[] = [];
  // Scroll positions (document px) where each hand-over starts and ends.
  let from: number[] = [];
  let to: number[] = [];
  let vh = window.innerHeight;
  let startPx = 0;
  let endPx = 1;

  const measure = () => {
    vh = window.innerHeight || document.documentElement.clientHeight;
    const stageRect = el.getBoundingClientRect();
    const w0 = box.offsetWidth || 1;
    const h0 = box.offsetHeight || 1;
    poses = scenes.map((scene, i) => {
      const slot = slots[i] as HTMLElement;
      const sceneRect = scene.getBoundingClientRect();
      const rect = slot.getBoundingClientRect();
      const k = slot.getAttribute('data-cx-scale') === 'sm' ? 0.85 : 1;
      const side = slot.getAttribute('data-cx-side') === 'start' ? 'start' : 'end';
      // Lean toward the copy: an artwork at the end leans back toward the start.
      const lean = (side === 'end') !== ctx.rtl ? -1 : 1;
      const tilt = calm ? 0 : (TILT[slot.getAttribute('data-cx-tilt') || 'soft'] ?? 8) * lean;
      return {
        x: rect.left - stageRect.left + rect.width / 2 - w0 / 2,
        y: rect.top - sceneRect.top + rect.height / 2 - h0 / 2,
        s: (rect.width / w0) * k,
        r: tilt,
        view: slot.getAttribute('data-cx-view') === '2' && second ? 1 : 0,
      };
    });
    const header = ctx.headerHeight();
    const scrollY = window.scrollY;
    from = [];
    to = [];
    for (let i = 1; i < scenes.length; i++) {
      const top = scenes[i].getBoundingClientRect().top + scrollY;
      from.push(top - vh * HANDOVER_FROM);
      to.push(top - header - vh * HANDOVER_TO);
    }
  };

  const setX = gsap.quickSetter(box, 'x', 'px') as (v: number) => void;
  const setY = gsap.quickSetter(box, 'y', 'px') as (v: number) => void;
  const setSX = gsap.quickSetter(box, 'scaleX') as (v: number) => void;
  const setSY = gsap.quickSetter(box, 'scaleY') as (v: number) => void;
  const setR = gsap.quickSetter(box, 'rotation', 'deg') as (v: number) => void;
  const setView = second ? (gsap.quickSetter(second, 'opacity') as (v: number) => void) : null;

  const state = { p: 0 };
  const render = () => {
    if (!poses.length) return;
    const scroll = startPx + state.p * (endPx - startPx);
    // The current segment: the last hand-over that has started.
    let seg = -1;
    for (let i = 0; i < from.length; i++) if (scroll >= from[i]) seg = i;
    let pose: Pose = poses[0];
    let t = 0;
    let a: Pose = poses[0];
    let b: Pose = poses[0];
    if (seg >= 0) {
      a = poses[seg];
      b = poses[seg + 1];
      t = clamp01((scroll - from[seg]) / Math.max(1, to[seg] - from[seg]));
      const e = easeInOut(t);
      pose = {
        x: lerp(a.x, b.x, e),
        y: lerp(a.y, b.y, e) + (calm ? 0 : Math.sin(Math.PI * t) * vh * ARC),
        s: lerp(a.s, b.s, e),
        r: lerp(a.r, b.r, e),
        view: lerp(a.view, b.view, clamp01((t - 0.35) / 0.3)),
      };
    }
    // A change of view reads as a turn: the object narrows a little while
    // the two views cross.
    const turning = a.view !== b.view ? Math.sin(Math.PI * clamp01((t - 0.3) / 0.4)) : 0;
    setX(pose.x);
    setY(pose.y);
    setSX(pose.s * (1 - 0.14 * turning));
    setSY(pose.s);
    setR(pose.r);
    setView?.(pose.view);
  };

  measure();
  const tween = gsap.to(state, {
    p: 1,
    ease: 'none',
    onUpdate: render,
    scrollTrigger: {
      trigger: el,
      start: 'clamp(top bottom)',
      end: 'clamp(bottom top)',
      scrub: 0.8,
      invalidateOnRefresh: true,
      onRefresh: (self) => {
        startPx = self.start;
        endPx = self.end;
        measure();
        render();
      },
    },
  });
  const st = tween.scrollTrigger;
  if (st) {
    startPx = st.start;
    endPx = st.end;
    state.p = st.progress;
    tween.progress(state.p);
  }
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
    gsap.set(box, { clearProps: 'transform' });
    if (second) gsap.set(second, { clearProps: 'opacity' });
    el.removeAttribute('data-cx-live');
  };
};

export default actor;
