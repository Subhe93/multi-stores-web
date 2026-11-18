// Stylesheet of "hero-outline" (one constant string; per-instance values come
// in as inline variables on the root: --cx-ho-word, --cx-ho-h1, --cx-ho-h2,
// --cx-ho-shape, --cx-ho-n).
//
// At rest (no JavaScript, reduced motion, store motion off, builder, print)
// everything is in its final place. Every entrance and loop sits behind the
// gate G. Layers of the stage, back to front: halo, shape, outline word,
// photo; each moving layer has one wrapper for the scroll depth (scrub), one
// for the pointer and an inner one for the CSS intro, so no two engines ever
// write the same transform.
//
// The word is a medium or small accent (owner rule): its size is capped by a
// token and by the width of its own layer (container units), never a
// screen-filling word.

import { G, G_RTL, minifyCss } from './base.css';

const R = '.store-root';

const BASE = `
.cx-ho{position:relative;overflow:clip;--cx-ho-word:var(--theme-colors-accent);--cx-ho-h1:var(--theme-colors-accent);--cx-ho-h2:var(--theme-colors-secondary,var(--theme-colors-accent));--cx-ho-shape:var(--theme-colors-surface);--cx-ho-ws:clamp(3rem,1rem + 6vw,6.75rem);--cx-ho-min:calc(88svh - var(--cx-header-h,0px))}
.cx-ho[data-cx-wsize="sm"]{--cx-ho-ws:clamp(2.25rem,1rem + 3.2vw,4.25rem)}
.cx-ho[data-cx-height="md"]{--cx-ho-min:70svh}
.cx-ho-in{box-sizing:border-box;position:relative;display:grid;grid-template-columns:minmax(0,1fr);row-gap:28px;max-inline-size:var(--theme-container-max,80rem);margin-inline:auto;padding:clamp(2.5rem,7vw,4.5rem) 1.5rem clamp(3rem,8vw,4.5rem)}
.cx-ho-head{position:relative;z-index:3;display:flex;flex-direction:column;align-items:flex-start;gap:20px;min-inline-size:0}
${R} .cx-ho-h{margin:0;max-inline-size:14ch;font-family:var(--theme-font-heading);font-weight:var(--theme-weight-heading,500);font-size:clamp(2.5rem,1.25rem + 3.7vw,4.75rem);line-height:1.04;letter-spacing:var(--theme-tracking-heading,-.01em);color:inherit;text-wrap:balance;overflow-wrap:break-word}
${R} .cx-ho-h[data-cx-script="arabic"]{max-inline-size:16ch;line-height:1.32;letter-spacing:0}
.cx-ho-aside{position:relative;z-index:3;display:flex;flex-direction:column;align-items:flex-start;gap:26px;min-inline-size:0}
${R} .cx-ho-sub{margin:0;max-inline-size:36ch;font-family:var(--theme-font-body);font-size:1.0625rem;line-height:1.65;color:color-mix(in srgb,currentColor 74%,transparent);white-space:pre-line}
.cx-ho-btns{display:flex;flex-wrap:wrap;gap:12px}
.cx-hero-b{display:inline-flex}
.cx-ho-stats{display:flex;flex-wrap:wrap;gap:16px 32px;margin:0;padding-block-start:22px;border-block-start:1px solid color-mix(in srgb,currentColor 16%,transparent)}
.cx-ho-stat{display:flex;flex-direction:column-reverse;gap:6px}
${R} .cx-ho-stat dd{margin:0;font-family:var(--theme-font-heading);font-weight:var(--theme-weight-heading,500);font-size:1.75rem;line-height:1;color:inherit;font-variant-numeric:lining-nums}
${R} .cx-ho-stat dt{font-family:var(--theme-font-body);font-size:11px;font-weight:600;line-height:1.3;letter-spacing:.14em;text-transform:uppercase;color:inherit;opacity:.68}
${R} .cx-ho-stat dt[data-cx-script="arabic"]{font-size:13px;letter-spacing:0;text-transform:none}
`;

// The stage and its layers. The stage is a box of fixed proportions on
// phones and fills its grid row from 1024 px; nothing in it changes size
// when the intro or the behaviours start.
const STAGE = `
.cx-ho-stage{position:relative;z-index:1;inline-size:100%;aspect-ratio:4/5;max-block-size:64svh;margin-inline:auto}
.cx-ho-lay{position:absolute;inset:0;pointer-events:none}
.cx-ho-px{position:absolute;inset:0}
.cx-ho-halo{z-index:0;inset:-4% -12% 6%}
.cx-ho-shapel{z-index:1}
.cx-ho-wordl{z-index:2;inset-inline:-30%}
.cx-ho-photol{z-index:3}
.cx-ho-clip{position:absolute;inset:0}
.cx-ho-photo-a,.cx-ho-photo{position:absolute;inset:0}
.cx-ho[data-cx-fit="cover"] .cx-ho-photo{inset:6% 9% 0;overflow:clip;border-radius:999px 999px var(--cx-radius-card) var(--cx-radius-card);background:color-mix(in srgb,currentColor 7%,transparent)}
.cx-ho-halo-a{position:absolute;inset:0;border-radius:50%}
.cx-ho-halo-a::before{content:"";position:absolute;inset:8%;border-radius:50%;background:radial-gradient(closest-side,color-mix(in srgb,var(--cx-ho-h2) 40%,transparent),color-mix(in srgb,var(--cx-ho-h2) 12%,transparent) 55%,transparent 100%)}
.cx-ho-halo-a[data-cx-halo="dots"]{background:radial-gradient(circle,var(--cx-ho-h1) 0 1.2px,transparent 1.7px) center/14px 14px;-webkit-mask:radial-gradient(closest-side,#000 18%,rgba(0,0,0,.7) 46%,transparent 100%);mask:radial-gradient(closest-side,#000 18%,rgba(0,0,0,.7) 46%,transparent 100%)}
.cx-ho-halo-a[data-cx-halo="dots"]::before{inset:14%}
.cx-ho-halo-a[data-cx-halo="rings"]{background:repeating-radial-gradient(circle,transparent 0 27px,color-mix(in srgb,var(--cx-ho-h1) 70%,transparent) 27px 28px);-webkit-mask:radial-gradient(closest-side,#000 30%,transparent 100%);mask:radial-gradient(closest-side,#000 30%,transparent 100%)}
.cx-ho-halo-a[data-cx-halo="glow"]{background:radial-gradient(closest-side,color-mix(in srgb,var(--cx-ho-h1) 34%,transparent),transparent 78%)}
.cx-ho-halo-a[data-cx-halo="glow"]::before{inset:18% 4% 0 22%}
.cx-ho-shape{position:absolute;inset-inline:0;margin-inline:auto;background:var(--cx-ho-shape);transform-origin:50% 100%}
.cx-ho-shape[data-cx-shape="circle"]{inline-size:84%;aspect-ratio:1;inset-block-end:7%;border-radius:50%}
.cx-ho-shape[data-cx-shape="arch"]{inline-size:76%;block-size:86%;inset-block-end:0;border-radius:999px 999px 0 0}
.cx-ho-word-a{position:absolute;inset-inline:0;inset-block-start:31%;container-type:inline-size}
.cx-ho[data-cx-word="below"] .cx-ho-word-a{inset-block-start:auto;inset-block-end:4%}
.cx-ho-svg{display:block;overflow:visible;inline-size:100%;block-size:1.2em;margin-block-start:-.6em;font-size:min(var(--cx-ho-ws),calc(100cqi / (var(--cx-ho-n,6) * .76 + .8)));font-family:var(--theme-font-heading);font-weight:var(--theme-weight-heading,500);line-height:1}
.cx-ho[data-cx-word="below"] .cx-ho-svg{margin-block-start:0}
.cx-ho-svg text{fill:none;stroke:var(--cx-ho-word);stroke-width:clamp(1px,.011em,1.6px);stroke-linejoin:round;letter-spacing:.07em;white-space:pre;font-size:1em}
.cx-ho-svg[data-cx-look="faint"] text{fill:var(--cx-ho-word);fill-opacity:.14;stroke:none;letter-spacing:.04em}
.cx-ho-svg text[data-cx-script="arabic"]{letter-spacing:0}
.cx-ho-cue{display:none}
`;

const DESKTOP = `
@media (min-width:1024px){
.cx-ho-in{grid-template-columns:minmax(0,1.12fr) minmax(0,1fr) minmax(0,.74fr);column-gap:clamp(24px,3vw,56px);align-items:stretch;min-block-size:max(var(--cx-ho-min),560px);padding-block:clamp(2rem,4vw,3rem) 0}
.cx-ho-head{align-self:center;padding-block-end:clamp(2rem,5vw,4rem)}
.cx-ho[data-cx-layout="center"] .cx-ho-h{font-size:clamp(2.5rem,1rem + 3.3vw,4.5rem)}
.cx-ho-stage{aspect-ratio:auto;max-block-size:none;block-size:100%;min-block-size:min(70svh,720px);margin-block-start:auto}
.cx-ho-aside{align-self:end;padding-block-end:clamp(3rem,7vw,5.5rem)}
.cx-ho[data-cx-layout="split"] .cx-ho-in{grid-template-columns:minmax(0,1fr) minmax(0,1fr);grid-template-rows:1fr auto;column-gap:clamp(32px,5vw,88px)}
.cx-ho[data-cx-layout="split"] .cx-ho-head{grid-column:1;grid-row:1;align-self:end;padding-block-end:0}
.cx-ho[data-cx-layout="split"] .cx-ho-aside{grid-column:1;grid-row:2;align-self:start;padding-block:32px clamp(3rem,7vw,5.5rem)}
.cx-ho[data-cx-layout="split"] .cx-ho-stage{grid-column:2;grid-row:1 / 3}
.cx-ho-cue{display:block;position:absolute;z-index:3;inset-block-end:20px;inset-inline:0;margin-inline:auto;inline-size:1px;block-size:46px;overflow:clip;background:color-mix(in srgb,currentColor 18%,transparent)}
.cx-ho-cue::after{content:"";position:absolute;inset:0;background:currentColor;transform:scaleY(0)}
}
`;

// Intro choreography (seconds): halo blooms 0, shape .05, photo rises .1,
// eyebrow 0, heading lines from .25, word strokes from .45 (letters .07
// apart), text .7, buttons .82 / .92, figures 1.02. Loops: the halo breathes
// over 9 s from 2.4 s; the scroll cue every 2.6 s.
const MOTION = `
@keyframes cx-ho-bloom{from{opacity:0;scale:.82}}
@keyframes cx-ho-breathe{from{scale:1;opacity:1}to{scale:1.05;opacity:.76}}
@keyframes cx-ho-rise{from{transform:translateY(16%) scale(1.025)}to{transform:none}}
@keyframes cx-ho-shape{from{opacity:0;scale:.9}}
@keyframes cx-ho-draw{from{stroke-dasharray:0 6em}to{stroke-dasharray:6em 0}}
@keyframes cx-ho-ink{from{fill-opacity:0}}
@keyframes cx-ho-drift{from{translate:4% 0}}
@keyframes cx-ho-drift-r{from{translate:-4% 0}}
@keyframes cx-ho-cue{0%{transform:scaleY(0);transform-origin:50% 0}45%{transform:scaleY(1);transform-origin:50% 0}55%{transform:scaleY(1);transform-origin:50% 100%}100%{transform:scaleY(0);transform-origin:50% 100%}}
${G} .cx-ho-halo-a{animation:cx-ho-bloom 2.2s var(--cx-ease) both,cx-ho-breathe 9s ease-in-out 2.4s infinite alternate}
${G} .cx-ho-shape{animation:cx-ho-shape 1.5s var(--cx-ease) .05s both}
${G} .cx-ho-clip{clip-path:inset(-60% -60% 0 -60%)}
${G} .cx-ho-photo-a{animation:cx-ho-rise 1.7s var(--cx-ease) .1s both}
${G} .cx-ho-word-a{animation:cx-ho-drift 2.8s var(--cx-ease) .3s both}
${G_RTL} .cx-ho-word-a{animation-name:cx-ho-drift-r}
${G} .cx-ho-svg:not([data-cx-look="faint"]) .cx-ho-l{animation:cx-ho-draw 2.2s var(--cx-ease-io) both;animation-delay:calc(.45s + var(--cx-l,0) * .07s)}
${G} .cx-ho-svg[data-cx-look="faint"] .cx-ho-l{animation:cx-ho-ink 1.6s ease both;animation-delay:calc(.45s + var(--cx-l,0) * .07s)}
${G} .cx-ho-cue::after{animation:cx-ho-cue 2.6s var(--cx-ease-io) 2s infinite}
@media (max-width:767.98px){
${G} .cx-ho-photo-a{animation-duration:1.4s}
}
`;

export const HERO_OUTLINE_CSS: string = minifyCss(BASE + STAGE + DESKTOP + MOTION);
