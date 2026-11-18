// Stylesheet of the section decor (contract 4.10): a scene colour theme on
// the wrapper of ANY section and the living backgrounds (dots, particles,
// glow). One constant string, rendered only where a decor or a Pattern is
// used. CSS only: static by default, motion behind the gate selector G.

import { G, minifyCss } from './base.css';

/** Most particles a backdrop draws. */
export const PARTICLE_COUNT = 14;

// Scene on a section wrapper. The wrapper keeps its width: the colour bleeds
// to the viewport edges through a border image that is outset on the inline
// axis only (paint only: no layout change, nothing clipped, no seam at the
// box edge; html and body clip the horizontal overflow). A nested section
// (inside a column) does not bleed: it only gets the `cx-scene-wrap` class.
//
// Typography: a store with literal heading / body colours (lib/
// storeTypography.ts, specificity 0,1,2) would keep them inside the scene.
// The rule below (0,2,0) makes plain text follow the scene. It leaves alone:
// an inline colour, the creative engine's own elements (cx- classes, they
// read the re-scoped theme variables), text that is white on a photo or an
// overlay, and status colours.
const SCENE_WRAP = `
.cx-scene-bleed{border-image:conic-gradient(var(--cx-bg) 0 0) fill 0/0/0 100vmax}
.store-root .cx-scene-wrap :where(h1,h2,h3,h4,h5,h6,p,li,span):where(:not([style*="color"],[class^="cx-"],[class*=" cx-"],[class*="text-white"],[class*="text-red-"],[class*="text-green-"],[class*="text-amber-"],[class*="text-blue-"],.store-muted)){color:inherit}
`;

// The backdrop sits under the section. A creative section that paints its
// own scene colour would cover it, so there the layer floats above the
// section instead (it never takes pointer events).
const HOST = `
.cx-bd-host{position:relative;isolation:isolate}
.cx-bd-host>[class$="-i"]{position:relative;z-index:1}
.cx-bd{position:absolute;inset:0;z-index:0;pointer-events:none;overflow:clip;--cx-bd-o:.18;--cx-bd-c1:var(--cx-bd-1,var(--theme-colors-accent));--cx-bd-c2:var(--cx-bd-2,var(--theme-colors-secondary))}
.cx-bd[data-cx-int="medium"]{--cx-bd-o:.32}
.cx-bd-bleed>.cx-bd{inset-inline:calc(50% - 50vw)}
.cx-bd-host:has(>[class$="-i"]>[data-cx-scene])>.cx-bd{z-index:2}
`;

// Halftone: a 14px dot grid in two soft clouds, colour 1 above and colour 2
// below, placed point-symmetrically with physical offsets (nothing flips in
// a right-to-left page).
const DOTS = `
.cx-bd[data-cx-bd="dots"]::before,.cx-bd[data-cx-bd="dots"]::after{content:"";position:absolute;inline-size:min(62%,820px);block-size:min(78%,560px);background-image:radial-gradient(circle at center,currentColor 1.7px,transparent 2.2px);background-size:14px 14px;opacity:calc(var(--cx-bd-o)*2.4)}
.cx-bd[data-cx-bd="dots"]::before{top:0;right:0;color:var(--cx-bd-c1);-webkit-mask-image:radial-gradient(ellipse 62% 66% at 66% 30%,#000 8%,transparent 72%);mask-image:radial-gradient(ellipse 62% 66% at 66% 30%,#000 8%,transparent 72%);transform-origin:66% 30%}
.cx-bd[data-cx-bd="dots"]::after{bottom:0;left:0;color:var(--cx-bd-c2);-webkit-mask-image:radial-gradient(ellipse 62% 66% at 34% 70%,#000 8%,transparent 72%);mask-image:radial-gradient(ellipse 62% 66% at 34% 70%,#000 8%,transparent 72%);transform-origin:34% 70%}
@keyframes cx-bd-breathe{from{opacity:calc(var(--cx-bd-o)*2.4);transform:scale(1)}to{opacity:calc(var(--cx-bd-o)*1.2);transform:scale(1.07)}}
${G} .cx-bd[data-cx-bd="dots"]:not([data-cx-still])::before{animation:cx-bd-breathe 9s ease-in-out infinite alternate}
${G} .cx-bd[data-cx-bd="dots"]:not([data-cx-still])::after{animation:cx-bd-breathe 12s ease-in-out -4s infinite alternate}
`;

// Glow: two soft radial lights. Their opacity is the intensity (at most .32).
const GLOW = `
.cx-bd[data-cx-bd="glow"]::before,.cx-bd[data-cx-bd="glow"]::after{content:"";position:absolute;inline-size:min(70%,900px);aspect-ratio:1;border-radius:50%;opacity:var(--cx-bd-o)}
.cx-bd[data-cx-bd="glow"]::before{top:-22%;right:-8%;background:radial-gradient(closest-side,var(--cx-bd-c1),transparent)}
.cx-bd[data-cx-bd="glow"]::after{bottom:-28%;left:-10%;background:radial-gradient(closest-side,var(--cx-bd-c2),transparent)}
@keyframes cx-bd-drift-a{from{transform:translate3d(0,0,0)}to{transform:translate3d(-8%,6%,0)}}
@keyframes cx-bd-drift-b{from{transform:translate3d(0,0,0)}to{transform:translate3d(10%,-6%,0)}}
${G} .cx-bd[data-cx-bd="glow"]:not([data-cx-still])::before{animation:cx-bd-drift-a 28s ease-in-out infinite alternate}
${G} .cx-bd[data-cx-bd="glow"]:not([data-cx-still])::after{animation:cx-bd-drift-b 36s ease-in-out infinite alternate}
`;

// Particles: small dots or thin rings scattered over the box, drifting
// upward with a fade at both ends. Positions, sizes and timings are fixed
// per child (a constant stylesheet); negative delays put every particle
// mid-flight at the first frame. Hidden on phones.
function particleRules(): string {
  const rules: string[] = [];
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    // Low-discrepancy scatter: even horizontal spread, varied heights.
    const x = Math.round(4 + ((i * 61.8) % 92));
    const y = Math.round(8 + ((i * 38.2 + 17) % 84));
    const size = 4 + ((i * 5) % 7); // 4..10px
    const duration = 18 + ((i * 11) % 15); // 18..32s
    const delay = -((i * 7) % 29);
    const sway = ((i % 5) - 2) * 9; // -18..18px
    const color = i % 3 === 0 ? 'var(--cx-bd-c2)' : 'var(--cx-bd-c1)';
    rules.push(
      `.cx-bd[data-cx-bd="particles"]>i:nth-child(${i + 1}){left:${x}%;top:${y}%;--cx-s:${size}px;--cx-c:${color};--cx-d:${duration}s;--cx-l:${delay}s;--cx-dx:${sway}px}`,
    );
  }
  return rules.join('\n');
}

const PARTICLES = `
.cx-bd[data-cx-bd="particles"]>i{position:absolute;display:block;box-sizing:border-box;inline-size:var(--cx-s,6px);block-size:var(--cx-s,6px);border-radius:50%;background:var(--cx-c,currentColor);opacity:calc(var(--cx-bd-o)*2.6)}
.cx-bd[data-cx-bd="particles"][data-cx-particle="ring"]>i{background:transparent;border:1.5px solid var(--cx-c,currentColor);inline-size:calc(var(--cx-s,6px) + 4px);block-size:calc(var(--cx-s,6px) + 4px)}
${particleRules()}
@media (max-width:767px){.cx-bd[data-cx-bd="particles"]{display:none}}
@keyframes cx-bd-rise{0%{transform:translate3d(0,70px,0);opacity:0}14%{opacity:calc(var(--cx-bd-o)*2.6)}82%{opacity:calc(var(--cx-bd-o)*2.6)}100%{transform:translate3d(var(--cx-dx,0px),-210px,0);opacity:0}}
${G} .cx-bd[data-cx-bd="particles"]:not([data-cx-still])>i{animation:cx-bd-rise var(--cx-d,24s) linear var(--cx-l,0s) infinite}
`;

// Loops rest while their creative section is off screen (the core marks
// watched sections; a backdrop on a plain section has no island and runs on
// the compositor only).
const PAUSE = `
${G} [data-cx-section][data-cx-watch]:not([data-cx-inview]) .cx-bd::before,${G} [data-cx-section][data-cx-watch]:not([data-cx-inview]) .cx-bd::after,${G} [data-cx-section][data-cx-watch]:not([data-cx-inview]) .cx-bd>i{animation-play-state:paused}
@media print{.cx-bd{display:none}.cx-scene-bleed{border-image:none}}
`;

export const DECOR_CSS: string = minifyCss(SCENE_WRAP + HOST + DOTS + GLOW + PARTICLES + PAUSE);
