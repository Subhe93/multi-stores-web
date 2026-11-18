// Stylesheet of "hero-sunrise" (one constant string; per-instance colours as
// inline variables on the root: --cx-hs-glow, --cx-hs-plate).
//
// At rest everything is in place; every entrance and loop sits behind the
// gate G. The sun box holds, back to front: the light (a soft glow and a fan
// of thin beams), the optional rays image, the optional plate, then the disc
// with the rising artwork and, in emblem mode, the foreground registered in
// the same box (clipped to a circle). In ridge mode the foreground is a full
// width layer along the bottom of the section and the sun box sits on it.
// Each moving layer has one wrapper for the scroll depth (scrub) and an inner
// one for the CSS intro or loop.

import { G, minifyCss } from './base.css';

const R = '.store-root';

const BASE = `
.cx-hs{position:relative;overflow:clip;--cx-hs-glow:var(--theme-colors-accent);--cx-hs-plate:var(--theme-colors-surface);--cx-hs-s:62vw;--cx-hs-rh:104px}
.cx-hs[data-cx-size="sm"]{--cx-hs-s:46vw}
.cx-hs[data-cx-ridge="sm"]{--cx-hs-rh:64px}
.cx-hs[data-cx-pos="seam"]{--cx-hs-s:132px}
.cx-hs-in{box-sizing:border-box;position:relative;display:grid;grid-template-columns:minmax(0,1fr);row-gap:40px;max-inline-size:var(--theme-container-max,80rem);margin-inline:auto;padding:clamp(2.5rem,7vw,4.5rem) 1.5rem clamp(3rem,8vw,4.5rem)}
.cx-hs-copy{position:relative;z-index:3;display:flex;flex-direction:column;align-items:flex-start;gap:20px;min-inline-size:0}
${R} .cx-hs-h{margin:0;max-inline-size:15ch;font-family:var(--theme-font-heading);font-weight:var(--theme-weight-heading,500);font-size:clamp(2.5rem,1.25rem + 3.7vw,4.75rem);line-height:1.04;letter-spacing:var(--theme-tracking-heading,-.01em);color:inherit;text-wrap:balance;overflow-wrap:break-word}
${R} .cx-hs-h[data-cx-script="arabic"]{max-inline-size:17ch;line-height:1.32;letter-spacing:0}
${R} .cx-hs-sub{margin:0;max-inline-size:38ch;font-family:var(--theme-font-body);font-size:1.0625rem;line-height:1.65;color:color-mix(in srgb,currentColor 74%,transparent);white-space:pre-line}
.cx-hs-btns{display:flex;flex-wrap:wrap;gap:12px;margin-block-start:8px}
.cx-hero-b{display:inline-flex}
.cx-hs-art{position:relative;z-index:1;order:-1;display:flex;justify-content:center;align-items:center;min-inline-size:0}
.cx-hs[data-cx-order="text"] .cx-hs-art,.cx-hs[data-cx-ridge]:not([data-cx-photo]) .cx-hs-art{order:0}
.cx-hs[data-cx-pos="start"] .cx-hs-art{justify-content:flex-start}
.cx-hs[data-cx-pos="end"] .cx-hs-art{justify-content:flex-end}
.cx-hs[data-cx-ridge]:not([data-cx-photo]) .cx-hs-in{padding-block-end:0}
.cx-hs[data-cx-ridge]:not([data-cx-photo]) .cx-hs-art{padding-block-end:calc(var(--cx-hs-rh) * .42)}
.cx-hs[data-cx-ridge][data-cx-photo] .cx-hs-in{padding-block-end:calc(var(--cx-hs-rh) + 24px)}
`;

const SUN = `
.cx-hs-sun{position:relative;flex:none;inline-size:var(--cx-hs-s);aspect-ratio:1;pointer-events:none}
.cx-hs-px{position:absolute;inset:0}
.cx-hs-glow{position:absolute;inset:-62%}
.cx-hs-glow-a{position:absolute;inset:0;border-radius:50%;background:radial-gradient(closest-side,color-mix(in srgb,var(--cx-hs-glow) 34%,transparent),color-mix(in srgb,var(--cx-hs-glow) 13%,transparent) 46%,color-mix(in srgb,var(--cx-hs-glow) 4%,transparent) 70%,transparent 100%)}
.cx-hs-beams{position:absolute;inset:10%}
.cx-hs-beams-a,.cx-hs-beams-l{position:absolute;inset:0;border-radius:50%}
.cx-hs-beams-l{background:repeating-conic-gradient(from 3deg,color-mix(in srgb,var(--cx-hs-glow) 42%,transparent) 0deg 1.2deg,transparent 1.2deg 7.5deg);-webkit-mask:radial-gradient(closest-side,transparent 26%,#000 34%,rgba(0,0,0,.45) 62%,transparent 100%);mask:radial-gradient(closest-side,transparent 26%,#000 34%,rgba(0,0,0,.45) 62%,transparent 100%);opacity:.7}
.cx-hs-rays{inset:-16%}
.cx-hs-rays-a,.cx-hs-rays-l{position:absolute;inset:0}
.cx-hs-plate{position:absolute;inset:1%;border-radius:50%;background:var(--cx-hs-plate);transform-origin:50% 50%}
.cx-hs-disc{position:absolute;inset:0}
.cx-hs[data-cx-mode="emblem"] .cx-hs-disc{clip-path:circle(46.5%)}
.cx-hs-core-a,.cx-hs-fg-a{position:absolute;inset:0}
.cx-hs-figure{position:relative;inline-size:min(100%,440px)}
.cx-hs-card{position:relative;z-index:1;aspect-ratio:4/5;overflow:clip;border-radius:var(--cx-radius-card);background:color-mix(in srgb,currentColor 7%,transparent)}
.cx-hs-card-a{position:absolute;inset:0}
.cx-hs-figure .cx-hs-sun{position:absolute;z-index:0;inset-block-start:calc(var(--cx-hs-s) * -.47);inset-inline:0;margin-inline:auto}
.cx-hs[data-cx-pos="start"] .cx-hs-figure .cx-hs-sun{inset-inline:6% auto;margin-inline:0}
.cx-hs[data-cx-pos="end"] .cx-hs-figure .cx-hs-sun{inset-inline:auto 6%;margin-inline:0}
.cx-hs[data-cx-pos="seam"] .cx-hs-figure .cx-hs-sun{z-index:2;inset-block:auto calc(var(--cx-hs-s) * -.33);inset-inline:calc(var(--cx-hs-s) * -.33) auto;margin-inline:0}
.cx-hs[data-cx-photo]:not([data-cx-pos="seam"]) .cx-hs-figure{margin-block-start:calc(var(--cx-hs-s) * .42)}
.cx-hs[data-cx-pos="seam"] .cx-hs-figure{margin-block-end:calc(var(--cx-hs-s) * .33);margin-inline-start:calc(var(--cx-hs-s) * .33)}
.cx-hs-ridge{position:absolute;z-index:2;inset-inline:0;inset-block-end:0;block-size:var(--cx-hs-rh);pointer-events:none}
.cx-hs-ridge-a{position:absolute;inset:0 0 -2px}
`;

const DESKTOP = `
@media (min-width:1024px){
.cx-hs{--cx-hs-s:min(34vw,420px);--cx-hs-rh:160px}
.cx-hs[data-cx-size="sm"]{--cx-hs-s:min(24vw,280px)}
.cx-hs[data-cx-ridge="sm"]{--cx-hs-rh:96px}
.cx-hs[data-cx-pos="seam"]{--cx-hs-s:190px}
.cx-hs[data-cx-pos="seam"][data-cx-size="sm"]{--cx-hs-s:150px}
.cx-hs-in{grid-template-columns:minmax(0,1fr) minmax(0,1fr);column-gap:clamp(32px,5vw,96px);align-items:center;min-block-size:max(calc(86svh - var(--cx-header-h,0px)),620px);padding-block:clamp(3rem,6vw,5rem)}
.cx-hs-art,.cx-hs[data-cx-order="text"] .cx-hs-art{order:0;align-self:stretch}
.cx-hs[data-cx-ridge]:not([data-cx-photo]) .cx-hs-art{align-items:flex-end}
.cx-hs[data-cx-ridge] .cx-hs-copy{padding-block-end:calc(var(--cx-hs-rh) * .6)}
.cx-hs[data-cx-photo] .cx-hs-art{justify-content:flex-end}
}
`;

// Intro (seconds): light blooms 0, plate .25 (the emblem foreground stands
// still from the first frame and hides the artwork), artwork
// rises from .35 over 2.6 s, beams / rays open from .8, then eyebrow .95,
// heading lines from 1.05, text 1.45, buttons 1.6 / 1.7. Loops: the light
// breathes over 8 s, beams turn once in 160 s (or pulse over 7 s).
const MOTION = `
@keyframes cx-hs-bloom{from{opacity:0;scale:.55}}
@keyframes cx-hs-breathe{from{scale:1;opacity:1}to{scale:1.07;opacity:.78}}
@keyframes cx-hs-rise{from{transform:translateY(64%) scale(.94)}to{transform:none}}
@keyframes cx-hs-rise-em{from{transform:translateY(82%) rotate(-12deg)}to{transform:none}}
@keyframes cx-hs-open{from{opacity:0;transform:scale(.5) rotate(-48deg)}to{transform:none}}
@keyframes cx-hs-turn{to{transform:rotate(360deg)}}
@keyframes cx-hs-pulse{from{opacity:1;scale:1}to{opacity:.55;scale:1.04}}
@keyframes cx-hs-plate{from{opacity:0;scale:.86}}
@keyframes cx-hs-settle{from{transform:scale(1.08)}to{transform:none}}
@keyframes cx-hs-lift{from{transform:translateY(34%)}to{transform:none}}
${G} .cx-hs-glow-a{animation:cx-hs-bloom 2.6s cubic-bezier(.25,.8,.25,1) both,cx-hs-breathe 8s ease-in-out 2.6s infinite alternate}
${G} .cx-hs-beams-a{animation:cx-hs-open 3s var(--cx-ease) .8s both}
${G} .cx-hs[data-cx-rays="rotate"] .cx-hs-beams-l{animation:cx-hs-turn 160s linear 3.8s infinite}
${G} .cx-hs[data-cx-rays="pulse"] .cx-hs-beams-l{animation:cx-hs-pulse 7s ease-in-out 3.8s infinite alternate}
${G} .cx-hs-rays-a{animation:cx-hs-open 2.8s var(--cx-ease) .9s both}
${G} .cx-hs[data-cx-rays="rotate"] .cx-hs-rays-l{animation:cx-hs-turn 140s linear 3.7s infinite}
${G} .cx-hs[data-cx-rays="pulse"] .cx-hs-rays-l{animation:cx-hs-pulse 7s ease-in-out 3.7s infinite alternate}
${G} .cx-hs-plate{animation:cx-hs-plate 1.6s var(--cx-ease) .25s both}
${G} .cx-hs[data-cx-mode="ridge"] .cx-hs-disc{clip-path:inset(-80% -80% 0 -80%)}
${G} .cx-hs-core-a{animation:cx-hs-rise 2.6s cubic-bezier(.25,.8,.25,1) .35s both}
${G} .cx-hs[data-cx-mode="emblem"] .cx-hs-core-a{animation-name:cx-hs-rise-em;animation-duration:2.8s}
${G} .cx-hs-card-a{animation:cx-hs-settle 1.8s var(--cx-ease) both}
${G} .cx-hs-ridge-a{animation:cx-hs-lift 1.8s var(--cx-ease) .1s both}
${G} .cx-hs .cx-eyebrow[data-cx-intro],${G} .cx-hs .cx-eyebrow[data-cx-intro]::before{animation-delay:.95s}
@media (max-width:767.98px){
${G} .cx-hs-core-a{animation-duration:2s}
${G} .cx-hs[data-cx-mode="emblem"] .cx-hs-core-a{animation-duration:2.2s}
}
`;

export const HERO_SUNRISE_CSS: string = minifyCss(BASE + SUN + DESKTOP + MOTION);
