// Stylesheet of "stage-scenes" (one constant string).
//
// Static page (default): stacked full-bleed colour scenes, each with its copy
// and a slot that holds the artwork in flow, tilted toward the copy. The
// actor layer exists in the markup but is not displayed.
//
// Live stage: only behind the gate G on a desktop with a fine pointer. An
// absolute track over the whole stage (out of the flow: nothing shifts)
// holds the actor layer, a sticky, viewport-tall layer that stays under the
// header and leaves with the last scene. Its
// artwork stays hidden until the behaviour has measured every slot and set
// data-cx-live on the stage; from then on the slot images are hidden (their
// boxes stay) and the one actor travels between them.
//
// The actor box is positioned with physical left / top on purpose: the
// behaviour writes physical pixels (measured rects) into its transform.

import { DESKTOP_FINE, G, G_RTL, minifyCss } from './base.css';

const R = '.store-root';
const LIVE = '.cx-ss-stage[data-cx-live]';

const BASE = `
.cx-ss{position:relative;--cx-ss-w:min(78vw,400px);--cx-ss-ar:3/4;--cx-ss-min:auto}
.cx-ss[data-cx-size="sm"]{--cx-ss-w:min(62vw,320px)}
.cx-ss[data-cx-aspect="square"]{--cx-ss-ar:1/1}
.cx-ss-stage{position:relative}
.cx-ss-track{display:none}
.cx-ss-scene{position:relative;overflow:clip;min-block-size:var(--cx-ss-min);display:flex;align-items:center}
.cx-ss-grid{box-sizing:border-box;inline-size:100%;max-inline-size:var(--theme-container-max,80rem);margin-inline:auto;padding:clamp(3.5rem,9vw,6rem) 1.5rem;display:grid;grid-template-columns:minmax(0,1fr);row-gap:40px;align-items:center}
.cx-ss-copy{position:relative;z-index:3;display:flex;flex-direction:column;align-items:flex-start;gap:18px;min-inline-size:0;order:1}
${R} .cx-ss-h{margin:0;max-inline-size:16ch;font-family:var(--theme-font-heading);font-weight:var(--theme-weight-heading,500);font-size:clamp(2.1rem,1.2rem + 2.6vw,3.75rem);line-height:1.06;letter-spacing:var(--theme-tracking-heading,-.01em);color:inherit;text-wrap:balance}
${R} .cx-ss-h[data-cx-script="arabic"]{max-inline-size:18ch;line-height:1.32;letter-spacing:0}
${R} .cx-ss-lead{margin:0;font-family:var(--cx-font-accent,var(--theme-font-heading));font-style:italic;font-size:1.25rem;line-height:1.45;color:var(--theme-colors-accent)}
${R} .cx-ss-lead[data-cx-script="arabic"]{font-style:normal}
${R} .cx-ss-text{margin:0;max-inline-size:40ch;font-family:var(--theme-font-body);font-size:1.0625rem;line-height:1.7;color:color-mix(in srgb,currentColor 76%,transparent);white-space:pre-line}
.cx-ss-chips{display:flex;flex-wrap:wrap;gap:8px;margin:0;padding:0;list-style:none}
${R} .cx-ss-chips li{padding:6px 14px;border:1px solid color-mix(in srgb,currentColor 24%,transparent);border-radius:999px;font-family:var(--theme-font-body);font-size:12px;font-weight:600;line-height:1.3;letter-spacing:.08em;text-transform:uppercase;color:inherit}
${R} .cx-ss-chips li[data-cx-script="arabic"]{font-size:13px;letter-spacing:0;text-transform:none}
.cx-ss-bullets{display:flex;flex-direction:column;gap:10px;margin:0;padding:0;list-style:none}
${R} .cx-ss-bullets li{display:flex;align-items:baseline;gap:12px;font-family:var(--theme-font-body);font-size:1rem;line-height:1.55;color:inherit}
.cx-ss-bullets[data-cx-marker="dot"] li::before{content:"";flex:none;inline-size:7px;block-size:7px;border-radius:50%;background:var(--theme-colors-accent);translate:0 -2px}
.cx-ss-mark{flex:none;display:inline-flex;inline-size:16px;block-size:16px;translate:0 2px}
.cx-ss-mark img{inline-size:16px;block-size:16px;object-fit:contain}
.cx-ss-btns{display:flex;flex-wrap:wrap;gap:12px;margin-block-start:8px}
.cx-ss-slot{position:relative;order:0;justify-self:center;inline-size:var(--cx-ss-w);aspect-ratio:var(--cx-ss-ar);max-block-size:56svh;--cx-ss-k:1;--cx-ss-t:0deg}
.cx-ss-slot[data-cx-scale="sm"]{--cx-ss-k:.85}
.cx-ss-slot[data-cx-tilt="soft"]{--cx-ss-t:8deg}
.cx-ss-slot[data-cx-tilt="strong"]{--cx-ss-t:14deg}
.cx-ss-media{position:absolute;inset:0;scale:var(--cx-ss-k);rotate:var(--cx-ss-t)}
.cx-ss-slot[data-cx-side="end"] .cx-ss-media{rotate:calc(var(--cx-ss-t) * -1)}
${R}[dir="rtl"] .cx-ss-slot[data-cx-side="start"] .cx-ss-media{rotate:calc(var(--cx-ss-t) * -1)}
${R}[dir="rtl"] .cx-ss-slot[data-cx-side="end"] .cx-ss-media{rotate:var(--cx-ss-t)}
.cx-ss-shape{position:absolute;z-index:0;inset-inline:-14%;inset-block:6% -2%;margin:auto;background:var(--cx-ss-shape,var(--theme-colors-surface))}
.cx-ss-shape[data-cx-shape="circle"]{inset-block:auto;inset-block-start:50%;translate:0 -50%;aspect-ratio:1;border-radius:50%}
.cx-ss-shape[data-cx-shape="arch"]{inset-inline:-8%;inset-block:4% -6%;border-radius:999px 999px 24px 24px}
.cx-ss-shape[data-cx-shape="blob"]{border-radius:42% 58% 63% 37% / 41% 44% 56% 59%}
.cx-ss-pat{position:absolute;z-index:0;inset:-28%;pointer-events:none}
.cx-ss-media{z-index:1}
`;

const DESKTOP = `
@media (min-width:1024px){
.cx-ss{--cx-ss-w:min(34vw,460px)}
.cx-ss[data-cx-size="sm"]{--cx-ss-w:min(26vw,340px)}
.cx-ss[data-cx-height="lg"]{--cx-ss-min:calc(100svh - var(--cx-header-h,0px))}
.cx-ss[data-cx-height="md"]{--cx-ss-min:80svh}
.cx-ss-grid{grid-template-columns:minmax(0,1fr) minmax(0,1fr);column-gap:clamp(40px,6vw,120px);padding-block:clamp(4rem,8vw,6rem)}
.cx-ss-copy{order:0;grid-column:1;grid-row:1}
.cx-ss-slot{grid-column:2;grid-row:1;max-block-size:none}
.cx-ss-scene[data-cx-side="start"] .cx-ss-copy{grid-column:2}
.cx-ss-scene[data-cx-side="start"] .cx-ss-slot{grid-column:1}
}
`;

// Live stage (desktop, fine pointer, gate open).
const STAGE = `
${DESKTOP_FINE}{
${G} .cx-ss-track{display:block;position:absolute;z-index:2;inset:0;pointer-events:none}
${G} .cx-ss-actor{position:sticky;inset-block-start:var(--cx-header-h,0px);block-size:calc(100svh - var(--cx-header-h,0px))}
${G} .cx-ss-actor-o{position:absolute;left:0;top:0;inline-size:var(--cx-ss-w);aspect-ratio:var(--cx-ss-ar);transform-origin:50% 50%;will-change:transform}
${G} .cx-ss-stage:not([data-cx-live]) .cx-ss-actor-o{visibility:hidden}
${G} .cx-ss-actor-i{position:absolute;inset:0}
${G} .cx-ss-view{position:absolute;inset:0}
${G} .cx-ss-view[data-cx-view="2"]{opacity:0}
${G} ${LIVE} .cx-ss-media{visibility:hidden}
}
`;

// Reveals of the copy come from the shared rules (rise, words); the shape
// behind the slot grows in with them. The actor floats a little at rest.
const MOTION = `
@keyframes cx-ss-float{from{translate:0 0}to{translate:0 -8px}}
${G} .cx-ss-shape[data-cx-reveal][data-cx-state="pending"]{opacity:0;scale:.86}
${G} .cx-ss-shape[data-cx-reveal][data-cx-state="shown"]{transition:opacity 1.3s ease,scale 1.5s var(--cx-ease)}
${G} .cx-ss[data-cx-float] ${LIVE} .cx-ss-actor-i{animation:cx-ss-float 3.2s ease-in-out infinite alternate}
${G_RTL} .cx-ss-copy{text-align:start}
`;

export const STAGE_SCENES_CSS: string = minifyCss(BASE + DESKTOP + STAGE + MOTION);
