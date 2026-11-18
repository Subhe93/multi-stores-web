// Stylesheet of "pattern-band": one constant string. Per-instance values
// travel as inline CSS variables on the section root:
//   --cx-pb-img  the tile as a sanitized url("…") (sections/patternUrl.ts)
//   --cx-pb-bg   ground behind the tile     (empty = transparent)
//   --cx-pb-tag  ground of the label tag    (empty = theme background)
//   --cx-pb-ink  label and hairline colour  (empty = theme text)
//
// The band is a strip of cloth: the tile repeats along the inline axis at
// the height of the band (background-size: auto 100%), anchored at the
// inline start. Artwork is never mirrored; in RTL only the anchor and the
// side the cloth arrives from change.
//
// Default state = the band at rest. The hidden start state exists only
// behind the gate G and the state the engine sets on the band's own reveal
// attribute, so no JavaScript, reduced motion, store motion off and the
// builder all show the finished band. The entrance is one continuous wipe
// with a feathered edge along the whole band (inline start to end), never
// tile by tile. It never travels sideways and never loops.

import { G, G_RTL, minifyCss, wipe, wipeFrom, wipeT } from './base.css';

const RTL = '.store-root[dir="rtl"]';
const PHONE = '@media (max-width:767px)';

const LAYOUT = `
.cx-pb{--cx-pb-h:48px;--cx-pb-space:48px;--cx-pb-ink:var(--theme-colors-text,currentColor);--cx-pb-tag:var(--theme-colors-background,#fff);position:relative;color:var(--cx-pb-ink);padding-block:var(--cx-pb-space)}
.cx-pb[data-cx-size="sm"]{--cx-pb-h:24px}
.cx-pb[data-cx-size="lg"]{--cx-pb-h:96px}
.cx-pb[data-cx-space="none"]{--cx-pb-space:0px}
.cx-pb[data-cx-space="sm"]{--cx-pb-space:24px}
.cx-pb[data-cx-space="lg"]{--cx-pb-space:96px}
.cx-pb-in{box-sizing:border-box;margin-inline:auto}
.cx-pb[data-cx-width="contained"] .cx-pb-in{max-inline-size:var(--theme-container-max,1280px);padding-inline:24px}
.cx-pb-stage{position:relative;display:grid;grid-template-columns:minmax(0,1fr);align-items:center}
.cx-pb-stage>*{grid-area:1/1}
.cx-pb-band{display:block;min-inline-size:0}
.cx-pb-row{display:block;block-size:var(--cx-pb-h);background-color:var(--cx-pb-bg,transparent);background-image:var(--cx-pb-img);background-repeat:repeat-x;background-size:auto 100%;background-position:0 0}
.cx-pb-row+.cx-pb-row{background-position:calc(var(--cx-pb-h) / -2) 0}
${RTL} .cx-pb-row{background-position:100% 0}
${RTL} .cx-pb-row+.cx-pb-row{background-position:calc(100% + var(--cx-pb-h) / 2) 0}
.cx-pb-rail{display:block;block-size:1px;background:color-mix(in srgb,currentColor 18%,transparent)}
.cx-pb-rail[data-cx-edge="start"]{margin-block-end:6px}
.cx-pb-rail[data-cx-edge="end"]{margin-block-start:6px}
.store-root .cx-pb-tag{position:relative;z-index:1;box-sizing:border-box;justify-self:center;align-self:stretch;display:flex;align-items:center;justify-content:center;min-block-size:40px;max-inline-size:min(80%,44rem);margin:0;padding:10px 20px;background:var(--cx-pb-tag);color:var(--cx-pb-ink);text-align:center}
.store-root .cx-pb-label{display:inline-block;font-family:var(--theme-font-body);font-size:11px;line-height:1.5;font-weight:600;letter-spacing:.14em;margin-inline-end:-.14em;text-transform:uppercase;color:inherit;text-decoration:none}
.store-root a.cx-pb-label{display:inline-flex;align-items:center;min-block-size:44px;margin-block:-12px}
.store-root a.cx-pb-label:focus-visible{outline:2px solid currentColor;outline-offset:3px}
.store-root .cx-pb-label:is(:lang(ar),[data-cx-script="arabic"]){font-size:13px;letter-spacing:0;margin-inline-end:0;text-transform:none}
@media (min-width:768px){.cx-pb[data-cx-width="contained"] .cx-pb-in{padding-inline:40px}}
@media (min-width:1024px){.cx-pb[data-cx-width="contained"] .cx-pb-in{padding-inline:64px}}
${PHONE}{
.cx-pb{--cx-pb-h:36px;--cx-pb-space:24px}
.cx-pb[data-cx-size="sm"]{--cx-pb-h:20px}
.cx-pb[data-cx-size="lg"]{--cx-pb-h:64px}
.cx-pb[data-cx-space="sm"]{--cx-pb-space:12px}
.cx-pb[data-cx-space="lg"]{--cx-pb-space:48px}
.store-root .cx-pb-tag{max-inline-size:70%}
.store-root .cx-pb-label{font-size:12px}
.cx-pb[data-cx-tag="long"] .cx-pb-stage{display:block}
.store-root .cx-pb[data-cx-tag="long"] .cx-pb-tag{max-inline-size:none;min-block-size:0;padding:12px 24px 0;background:none}
}
`;

// The band carries fade(m), but its entrance is a wipe, not a fade: while it
// is pending the whole band (both rows as one piece) sits behind a soft mask
// and opens along its length in one in-out gesture once it is shown. The
// mask is gone again when the engine marks the band done.
const T = '1.6s var(--cx-ease-io,cubic-bezier(.65,0,.35,1))';
const B = '.cx-pb-band[data-cx-reveal]';
const WEAVE = `
@keyframes cx-pb-wipe{${wipeFrom('x')}}
@keyframes cx-pb-wipe-rtl{${wipeFrom('x-rtl')}}
${G} ${B}[data-cx-state="pending"]{opacity:1;${wipe('x', false)}}
${G_RTL} ${B}[data-cx-state="pending"]{${wipe('x-rtl', false)}}
${G} ${B}[data-cx-state="shown"]{${wipe('x', true)};${wipeT(T)}}
${G_RTL} ${B}[data-cx-state="shown"]{${wipe('x-rtl', true)}}
${G} .cx-pb-band[data-cx-intro]{${wipe('x', true)};animation:cx-pb-wipe ${T} both}
${G_RTL} .cx-pb-band[data-cx-intro]{${wipe('x-rtl', true)};animation-name:cx-pb-wipe-rtl}
@media print{.cx-pb-band{-webkit-mask:none!important;mask:none!important;animation:none!important;transition:none!important}}
`;

export const PATTERN_BAND_CSS: string = minifyCss(LAYOUT + WEAVE);
