// Stylesheet of "promise-band" (one constant string). A light band: a small
// heading, a horizon line with a small sun on it, then up to three promises
// side by side (stacked on phones), each with a line icon, a title, a short
// underline and a text.
//
// The content is complete and visible without JavaScript. The `promise`
// behaviour (engine/behaviors/promise.ts) hides and reveals it with GSAP on
// enter and walks the sun along the horizon while scrolling; hover states are
// CSS only (fine pointers). Colours are tones (sections/tones.ts).

import { minifyCss } from './base.css';
import { toneRef, type ToneGroup, type ToneTable } from '../sections/tones';

export const PB_PREFIX = '--cx-pm-c-';

/** Owner colours of the band: settings key and built-in colour. */
export const PB_GROUPS: Record<string, ToneGroup> = {
  bg: { setting: 'bg_color', base: [247, 244, 239] },
  ink: { setting: 'text_color', base: [17, 17, 17] },
  gold: { setting: 'gold_color', base: [163, 130, 80] },
  accent: { setting: 'accent_color', base: [182, 0, 24] },
};

/** Every shade the band draws, by group. */
export const PB_TONES: ToneTable = {
  bg: ['bg', [247, 244, 239]],
  line: ['bg', [220, 211, 196]],
  ink: ['ink', [17, 17, 17]],
  muted: ['ink', [91, 85, 77]],
  gold: ['gold', [163, 130, 80]],
  glow: ['gold', [201, 165, 106]],
  gleam: ['gold', [255, 236, 200]],
  red: ['accent', [182, 0, 24]],
};

/** Shade reference for the stylesheet and for the behaviour's glow keyframes. */
export const pbTone = (name: string, alpha = 1): string => toneRef(PB_PREFIX, PB_TONES, name, alpha);
const t = pbTone;

const R = '.store-root';
const RTL = '.store-root[dir="rtl"]';

const BASE = `
.cx-pm{--cx-pm-pad:clamp(20px,5vw,64px);--cx-pm-ease:cubic-bezier(.16,1,.3,1);position:relative;box-sizing:border-box;overflow:hidden;background:${t('bg')};color:${t('ink')};font-family:var(--theme-font-body);-webkit-font-smoothing:antialiased}
.cx-pm *,.cx-pm *::before,.cx-pm *::after{box-sizing:border-box}
.cx-pm :where(h2,h3,h4,h5,h6,p,ul,li){margin:0;padding:0}
.cx-pm :where(ul){list-style:none}
${R} .cx-pm :where(span){font:inherit;color:inherit;letter-spacing:inherit}
.cx-pm-in{max-width:1280px;margin-inline:auto;padding:clamp(24px,3vw,44px) var(--cx-pm-pad) clamp(64px,8vw,104px)}
${R} .cx-pm-eb{text-align:center;font-family:var(--theme-font-body);font-size:12px;font-weight:600;letter-spacing:.24em;text-transform:uppercase;color:${t('gold')}}
${R} .cx-pm-ebt[data-cx-script="arabic"]{letter-spacing:.02em;font-size:14px}
.cx-pm-horizon{position:relative;height:11px;margin:26px 0 clamp(36px,4.5vw,60px)}
.cx-pm-hline{position:absolute;left:0;right:0;top:5px;height:1px;background:linear-gradient(90deg,${t('gold', 0)} 0%,${t('gold')} 18%,${t('gold')} 82%,${t('gold', 0)} 100%);transform-origin:50% 50%}
.cx-pm-hsun{position:absolute;top:0;inset-inline-start:0;width:11px;height:11px;border-radius:50%;background:${t('red')};box-shadow:0 0 0 5px ${t('red', 0.1)},0 0 18px 4px ${t('red', 0.18)}}
.cx-pm-gleam{position:absolute;top:0;left:0;width:160px;height:11px;opacity:0;pointer-events:none;background:radial-gradient(50% 50% at 50% 50%,${t('gleam', 0.95)},${t('glow', 0.5)} 45%,${t('glow', 0)} 100%);filter:blur(1px)}
.cx-pm-list{display:grid;grid-template-columns:repeat(var(--cx-pm-n,3),minmax(0,1fr))}
.cx-pm-item{position:relative;padding:6px clamp(20px,3vw,44px) 4px}
.cx-pm-div{position:absolute;inset-inline-start:0;top:0;bottom:0;width:1px;background:${t('line')};transform-origin:50% 0}
.cx-pm-item:first-child .cx-pm-div{display:none}
${R} .cx-pm-num{position:absolute;top:4px;inset-inline-end:clamp(20px,3vw,44px);font-family:var(--theme-font-heading);font-size:15px;color:${t('gold')};transition:color .5s,transform .7s var(--cx-pm-ease)}
.cx-pm-iconwrap{position:relative;display:block;width:54px;height:54px}
.cx-pm-glow{position:absolute;left:50%;top:50%;width:96px;height:96px;margin:-48px 0 0 -48px;border-radius:50%;pointer-events:none;background:radial-gradient(circle closest-side,${t('glow', 0.28)},${t('glow', 0.1)} 55%,${t('glow', 0)});opacity:0;transform:scale(.55);transition:opacity .7s var(--cx-pm-ease),transform .9s var(--cx-pm-ease)}
.cx-pm-icon{position:relative;display:block;width:54px;height:54px;overflow:visible;fill:none;stroke:${t('ink')};stroke-width:1.15;stroke-linecap:round;stroke-linejoin:round;transition:transform .8s var(--cx-pm-ease)}
.cx-pm-icon .cx-pm-accent{stroke:${t('gold')};stroke-width:1.4;transition:stroke .5s}
.cx-pm-img{position:absolute;inset:0;transition:transform .8s var(--cx-pm-ease)}
.cx-pm-body{margin-top:26px}
${R} .cx-pm-title{position:relative;font-family:var(--theme-font-heading);font-weight:400;font-size:clamp(21px,1.75vw,25px);line-height:1.25;letter-spacing:-.005em;color:${t('ink')}}
${R} .cx-pm-tt[data-cx-script="arabic"]{font-weight:600;font-size:.92em;line-height:1.6;letter-spacing:0}
.cx-pm-mask{display:block;overflow:hidden;padding-bottom:.12em;margin-bottom:-.12em}
.cx-pm-mask>span{display:inline-block}
.cx-pm-uline{display:block;width:56px;height:1px;margin-top:10px;background:${t('gold')};opacity:.55;transform:scaleX(.35);transform-origin:left center;transition:transform .8s var(--cx-pm-ease),opacity .5s,background-color .5s}
${RTL} .cx-pm-uline{transform-origin:right center}
${R} .cx-pm-text{margin-top:12px;max-width:24em;font-family:var(--theme-font-body);font-size:15px;line-height:1.6;color:${t('muted')}}
${R} .cx-pm-xt[data-cx-script="arabic"]{line-height:1.85}
`;

// Hover (fine pointers): the promise lights up like a small sunrise.
const HOVER = `
@media (hover:hover) and (pointer:fine){
.cx-pm-item:hover .cx-pm-glow{opacity:1;transform:none}
.cx-pm-item:hover .cx-pm-icon,.cx-pm-item:hover .cx-pm-img{transform:translateY(-4px)}
.cx-pm-item:hover .cx-pm-accent{animation:cx-pm-draw 1s cubic-bezier(.65,0,.35,1) both;stroke:${t('red')}}
.cx-pm-item:hover .cx-pm-uline{transform:none;opacity:1}
${R} .cx-pm-item:hover .cx-pm-num{color:${t('red')};transform:translateY(-3px)}
}
@keyframes cx-pm-draw{from{stroke-dasharray:1;stroke-dashoffset:1}to{stroke-dasharray:1;stroke-dashoffset:0}}
@media (prefers-reduced-motion:reduce){.cx-pm-item:hover .cx-pm-accent{animation:none}}
`;

const PHONE = `
@media (max-width:767px){
.cx-pm-horizon{margin:20px 0 8px}
.cx-pm-list{grid-template-columns:1fr}
.cx-pm-item{display:grid;grid-template-columns:46px 1fr;column-gap:18px;align-items:start;padding:26px 0}
.cx-pm-div{top:0;bottom:auto;left:0;right:0;width:auto;height:1px;transform-origin:0 50%}
${RTL} .cx-pm-div{transform-origin:100% 50%}
${R} .cx-pm-num{top:28px;inset-inline-end:0;font-size:13px}
.cx-pm-iconwrap,.cx-pm-icon{width:44px;height:44px;margin-top:0}
.cx-pm-uline{margin-top:8px;width:40px}
.cx-pm-body{margin-top:0;padding-inline-end:28px}
${R} .cx-pm-title{font-size:20px}
${R} .cx-pm-text{margin-top:6px;font-size:14.5px}
}
`;

export const PROMISE_BAND_CSS: string = minifyCss(BASE + HOVER + PHONE);
