// Shared stylesheet of the motion engine, rendered through CxStyle only by
// stores that switched their motion style on and by pages that place the
// ornament divider (never in globals.css: that file is inlined into the HTML
// of every store).
//
// Motion numbers (benchmarked on the two reference sites, see
// plans/newroj/STORE-MOTION-CONTRACT.md): entrances ease out on an expo
// curve over 1.2 s, masks open on an in-out curve over 1.3 s while the image
// inside settles from 1.16 to 1 over 1.7 s, words step by 0.05 s, lines by
// 0.1 s and items by 0.09 s. Travel is short (28 px, 44 px on a desktop).
//
// Rules of the house:
// - Nothing is hidden, moved or animated outside the gate selector G, so a
//   page without JavaScript, with reduced motion, with store motion off or in
//   the builder preview is static and complete.
// - Text rules start with `.store-root` plus a class: the store typography
//   rule `.store-root main :is(p, li, span)` (0,1,2) would otherwise win.
// - Logical properties only; direction-dependent values flip under G_RTL /
//   `.store-root[dir="rtl"]` (the store root carries `dir`, not <html>).

/** "JavaScript runs AND motion is allowed AND the store did not switch motion off AND not the builder". */
export const G = 'html[data-cx-motion] .store-root:not([data-motion-reveal="off"]):not([data-cx-builder])';
/** G for a right-to-left store. */
export const G_RTL =
  'html[data-cx-motion] .store-root[dir="rtl"]:not([data-motion-reveal="off"]):not([data-cx-builder])';
/** Media query of the desktop-only layouts (sticky stages, pinned tracks, pointer effects). */
export const DESKTOP_FINE = '@media (min-width: 1024px) and (hover: hover) and (pointer: fine)';

/**
 * Soft-edged wipe: the declarations of a mask that uncovers an element along
 * one axis. The mask is a gradient 2.2 times the element (opaque up to 46 %,
 * clear from 54 %), so its edge is a feather of about a sixth of the element
 * and never a hard cut. Only mask-position moves: wipe(axis, false) is the
 * hidden position, wipe(axis, true) the open one. 'x' opens from the left,
 * 'x-rtl' from the right, 'y' from the top.
 */
export type WipeAxis = 'x' | 'x-rtl' | 'y';
const WIPE_DEG: Record<WipeAxis, number> = { x: 90, 'x-rtl': 270, y: 180 };
const WIPE_FROM: Record<WipeAxis, string> = { x: '100% 0', 'x-rtl': '0 0', y: '0 100%' };
const WIPE_TO: Record<WipeAxis, string> = { x: '0 0', 'x-rtl': '100% 0', y: '0 0' };
export function wipe(axis: WipeAxis, open: boolean): string {
  const image = `linear-gradient(${WIPE_DEG[axis]}deg,#000 46%,transparent 54%)`;
  const rest = `${open ? WIPE_TO[axis] : WIPE_FROM[axis]}/${axis === 'y' ? '100% 220%' : '220% 100%'} no-repeat`;
  return `-webkit-mask:${image} ${rest};mask:${image} ${rest}`;
}
/** Keyframe body that starts a wipe at its hidden position (the end is the element's own open mask). */
export const wipeFrom = (axis: WipeAxis): string =>
  `from{-webkit-mask-position:${WIPE_FROM[axis]};mask-position:${WIPE_FROM[axis]}}`;
/** Transition declaration of a wipe. */
export const wipeT = (timing: string): string => `transition:-webkit-mask-position ${timing},mask-position ${timing}`;

const TOKENS = `
.store-root{--cx-ease:cubic-bezier(.16,1,.3,1);--cx-ease-io:cubic-bezier(.65,0,.35,1);--cx-dur:1.2s;--cx-dur-slow:1.4s;--cx-dur-clip:1.3s;--cx-dur-settle:1.7s;--cx-dur-ui:.45s;--cx-dist:28px;--cx-stagger:.09s;--cx-word-step:.05s;--cx-radius-card:28px}
.store-root[data-motion-reveal="calm"]{--cx-dist:16px;--cx-dur:1.56s;--cx-dur-slow:1.82s;--cx-dur-clip:1.6s;--cx-dur-settle:2s}
@media (min-width:1024px){.store-root{--cx-dist:44px}.store-root[data-motion-reveal="calm"]{--cx-dist:26px}}
.store-root [data-cx-tier="fast"]{--cx-dur:.6s;--cx-dur-slow:.8s;--cx-dur-clip:.7s;--cx-dur-settle:.9s;--cx-dist:14px;--cx-stagger:.04s;--cx-word-step:.03s}
`;

// Engine spans inside a heading must not pick up the body typography.
const GUARD = `
.store-root :is(.cx-ht,.cx-w,.cx-wi,.cx-em,.cx-btn-in,.cx-btn-l){font:inherit;color:inherit;letter-spacing:inherit}
`;

const LAYOUT = `
.cx-bleed{inline-size:100vw;max-inline-size:100vw;margin-inline:calc(50% - 50vw)}
.cx-mask{position:relative;overflow:clip}
.cx-mask-in{display:block;position:relative;inline-size:100%;block-size:100%}
.cx-w{display:inline-block;overflow:clip;padding-block:.14em;margin-block:-.14em;padding-inline:.06em;margin-inline:-.06em;vertical-align:top}
.cx-wi{display:inline-block}
`;

const TEXT = `
.store-root .cx-em{font-style:normal}
.store-root .cx-em[data-cx-em="italic"]{font-family:var(--cx-font-accent,inherit);font-style:italic}
.store-root .cx-em[data-cx-em][data-cx-script="arabic"]{font-style:normal;letter-spacing:0}
.store-root .cx-eyebrow{display:flex;align-items:center;gap:.75rem;margin:0;font-family:var(--theme-font-body);font-size:12px;line-height:1.4;font-weight:600;letter-spacing:.18em;text-transform:uppercase;color:var(--cx-eyebrow,var(--theme-colors-accent))}
.store-root .cx-eyebrow::before{content:"";flex:none;inline-size:40px;block-size:1px;background:currentColor;transform-origin:0 50%}
.store-root[dir="rtl"] .cx-eyebrow::before{transform-origin:100% 50%}
.store-root .cx-eyebrow[data-cx-script="arabic"]{letter-spacing:0;text-transform:none;font-size:13px}
`;

const BUTTON = `
.store-root .cx-btn{display:inline-flex;align-items:center;justify-content:center;min-block-size:48px;padding:.75rem 1.75rem;border:1.5px solid transparent;border-radius:var(--theme-radius-button,999px);background:var(--theme-colors-primary);color:var(--theme-colors-primaryContrast);font-family:var(--theme-font-body);font-size:.875rem;font-weight:600;line-height:1.2;letter-spacing:.04em;text-decoration:none;outline-color:currentColor;transition:opacity .25s ease}
.store-root .cx-btn[data-cx-tone="accent"]{background:var(--theme-colors-accent);color:var(--theme-colors-accentContrast)}
.store-root .cx-btn[data-cx-variant="outline"]{background:transparent;border-color:currentColor;color:var(--theme-colors-text)}
.store-root .cx-btn:hover{opacity:.88}
.cx-btn-in{display:inline-flex;align-items:center;gap:.625rem;translate:var(--cx-mx,0px) var(--cx-my,0px);transition:translate .35s cubic-bezier(.16,1,.3,1)}
.cx-btn-arrow{flex:none;inline-size:1em;block-size:1em;transition:translate .3s cubic-bezier(.16,1,.3,1)}
.cx-btn:hover .cx-btn-arrow{translate:4px 0}
.store-root[dir="rtl"] .cx-btn-arrow{scale:-1 1}
.store-root[dir="rtl"] .cx-btn:hover .cx-btn-arrow{translate:-4px 0}
`;

const EMPTY = `
.cx-empty{display:flex;align-items:center;justify-content:center;min-block-size:160px;margin:1rem;padding:1.5rem;border:1px dashed color-mix(in srgb,currentColor 35%,transparent);border-radius:12px;background:color-mix(in srgb,currentColor 4%,transparent);text-align:center;font-size:.875rem}
`;

const REVEALS = `
${G} [data-cx-reveal="words"][data-cx-state="pending"] .cx-wi{transform:translateY(110%)}
${G} [data-cx-reveal="words"][data-cx-state="shown"] .cx-wi{transition:transform var(--cx-dur) var(--cx-ease);transition-delay:calc(var(--cx-delay,0s) + var(--cx-ld,calc(var(--cx-i,0) * var(--cx-word-step))))}
${G} [data-cx-reveal="mask"][data-cx-state="pending"]{clip-path:inset(100% 0 0 0)}
${G} [data-cx-reveal="mask"][data-cx-dir="start"][data-cx-state="pending"]{clip-path:inset(0 100% 0 0)}
${G} [data-cx-reveal="mask"][data-cx-dir="end"][data-cx-state="pending"]{clip-path:inset(0 0 0 100%)}
${G_RTL} [data-cx-reveal="mask"][data-cx-dir="start"][data-cx-state="pending"]{clip-path:inset(0 0 0 100%)}
${G_RTL} [data-cx-reveal="mask"][data-cx-dir="end"][data-cx-state="pending"]{clip-path:inset(0 100% 0 0)}
${G} [data-cx-reveal="mask"][data-cx-state="shown"]{clip-path:inset(0);transition:clip-path var(--cx-dur-clip) var(--cx-ease-io);transition-delay:var(--cx-delay,0s)}
${G} [data-cx-reveal="mask"][data-cx-state="pending"] .cx-mask-in{transform:scale(1.16)}
${G} [data-cx-reveal="mask"][data-cx-state="shown"] .cx-mask-in{transition:transform var(--cx-dur-settle) var(--cx-ease);transition-delay:var(--cx-delay,0s)}
${G} [data-cx-reveal="rise"][data-cx-state="pending"]{opacity:0;transform:translateY(var(--cx-dist))}
${G} [data-cx-reveal="rise"][data-cx-state="shown"]{transition:opacity var(--cx-dur) var(--cx-ease),transform var(--cx-dur) var(--cx-ease);transition-delay:calc(var(--cx-delay,0s) + var(--cx-i,0) * var(--cx-stagger))}
${G} [data-cx-reveal="fade"][data-cx-state="pending"]{opacity:0}
${G} [data-cx-reveal="fade"][data-cx-state="shown"]{transition:opacity var(--cx-dur) ease;transition-delay:calc(var(--cx-delay,0s) + var(--cx-i,0) * var(--cx-stagger))}
${G} [data-cx-reveal="line"][data-cx-state="pending"]{transform:scaleX(0)}
${G} [data-cx-reveal="line"]{transform-origin:0 50%}
${G_RTL} [data-cx-reveal="line"]{transform-origin:100% 50%}
${G} [data-cx-reveal="line"][data-cx-state="shown"]{transition:transform var(--cx-dur-clip) var(--cx-ease-io);transition-delay:var(--cx-delay,0s)}
`;

// cx-rise and cx-fade have no end keyframe: they end on the element's own
// opacity and transform, so a resting opacity below 1 (a muted eyebrow) and a
// hover opacity are not pinned by the filled animation.
const INTROS = `
@keyframes cx-word{from{transform:translateY(110%)}to{transform:none}}
@keyframes cx-rise{from{opacity:0;transform:translateY(var(--cx-dist))}}
@keyframes cx-fade{from{opacity:0}}
@keyframes cx-scale{from{transform:scale(1.06)}to{transform:none}}
@keyframes cx-rule{from{transform:scaleX(0)}to{transform:none}}
${G} [data-cx-intro="words"] .cx-wi{animation:cx-word var(--cx-dur) var(--cx-ease) both;animation-delay:calc(var(--cx-delay,.15s) + var(--cx-i,0) * var(--cx-word-step))}
${G} [data-cx-intro="rise"]{animation:cx-rise var(--cx-dur) var(--cx-ease) both;animation-delay:calc(var(--cx-delay,0s) + var(--cx-i,0) * var(--cx-stagger))}
${G} [data-cx-intro="fade"]{animation:cx-fade var(--cx-dur) ease both;animation-delay:calc(var(--cx-delay,0s) + var(--cx-i,0) * var(--cx-stagger))}
${G} [data-cx-intro="scale"]:not(.cx-mask),${G} .cx-mask[data-cx-intro="scale"]>.cx-mask-in{animation:cx-scale var(--cx-dur-slow) var(--cx-ease) both;animation-delay:var(--cx-delay,0s)}
${G} [data-cx-intro="rule"]{transform-origin:0 50%;animation:cx-rule var(--cx-dur-clip) var(--cx-ease-io) both;animation-delay:var(--cx-delay,0s)}
${G_RTL} [data-cx-intro="rule"]{transform-origin:100% 50%}
${G} .cx-eyebrow[data-cx-intro="eyebrow"]{animation:cx-fade var(--cx-dur) ease both}
${G} .cx-eyebrow[data-cx-intro="eyebrow"]::before{animation:cx-rule var(--cx-dur) var(--cx-ease) both}
${G} [data-cx-section][data-cx-watch]:not([data-cx-inview]) [data-cx-loop]{animation-play-state:paused}
`;

const PRINT = `
@media print{[data-cx-state],[data-cx-state] .cx-wi,[data-cx-state] .cx-mask-in,[data-cx-intro],[data-cx-intro] .cx-wi,[data-cx-intro] .cx-mask-in,.cx-eyebrow::before{animation:none!important;transition:none!important;transform:none!important;opacity:1!important;clip-path:none!important}}
`;

/** Collapses the authoring whitespace (one rule per line above). */
export function minifyCss(css: string): string {
  return css
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('');
}

export const BASE_CSS: string = minifyCss(
  TOKENS + GUARD + LAYOUT + TEXT + BUTTON + EMPTY + REVEALS + INTROS + PRINT,
);
