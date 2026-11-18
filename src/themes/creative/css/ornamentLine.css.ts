// Stylesheet of "ornament-line": one constant string, per-instance values
// through inline CSS variables (--cx-ol-tw / --cx-ol-th = tile size in px,
// --cx-ol-ca / -cb / -cc = the three stroke colours).
//
// Default state = fully drawn. The hidden start state exists only behind the
// gate G AND a marker the `draw` behaviour sets after it decided to animate
// (data-cx-armed for "once", data-cx-live for "scroll"), so no JavaScript,
// reduced motion, store motion off, the builder and a failed chunk all show
// the complete ornament.
//
// Every SVG is drawn 1 user unit = 1 CSS pixel (never scaled), with fixed
// heights: nothing shifts while it draws.

import { G, minifyCss } from './base.css';

const RTL = '.store-root[dir="rtl"]';

const LAYOUT = `
.cx-ol{position:relative;--cx-ol-ca:var(--theme-colors-text);--cx-ol-cb:var(--theme-colors-accent);--cx-ol-cc:var(--theme-colors-secondary);--cx-ol-sw:1.5px;--cx-ol-c:0px;--cx-ol-gap:0px}
.cx-ol[data-cx-stroke="thin"]{--cx-ol-sw:1px}
.cx-ol-in{max-inline-size:var(--theme-container-max);margin-inline:auto;padding:2.5rem 1.5rem}
.cx-ol[data-cx-variant="divider"][data-cx-width="full"] .cx-ol-in{max-inline-size:none;padding-inline:0}
.cx-ol-band{position:relative;overflow:clip;-webkit-mask-image:linear-gradient(to right,transparent,#000 7%,#000 93%,transparent);mask-image:linear-gradient(to right,transparent,#000 7%,#000 93%,transparent)}
.cx-ol-strip{position:absolute;inset-block-start:0;inset-inline-start:0;display:block;max-inline-size:none}
.cx-ol-plain{display:block;inline-size:100%;block-size:9px;overflow:visible}
.cx-ol-p{fill:none;stroke:var(--cx-ol-ca);stroke-width:var(--cx-ol-sw);vector-effect:non-scaling-stroke;stroke-linejoin:miter}
.cx-ol-p[data-c="b"]{stroke:var(--cx-ol-cb)}
.cx-ol-p[data-c="c"]{stroke:var(--cx-ol-cc)}
.cx-ol-t{--cx-k:var(--cx-i,0)}
${RTL} .cx-ol-t{--cx-k:calc(var(--cx-n,1) - 1 - var(--cx-i,0))}
.cx-ol-cta{display:flex;justify-content:center;margin-block-start:1.75rem}
.cx-ol-frame{position:relative;display:flex;flex-direction:column;align-items:center;gap:1.25rem;max-inline-size:56rem;margin:calc(var(--cx-ol-th,48px) / 2) auto;padding:clamp(2.75rem,7vw,5rem) clamp(1.5rem,6vw,5rem);text-align:center}
.cx-ol[data-cx-width="full"] .cx-ol-frame{max-inline-size:none}
.cx-ol-frame[data-cx-corners]{--cx-ol-c:20px}
.store-root .cx-ol .cx-ol-h{margin:0;font-family:var(--theme-font-heading);font-size:var(--theme-scale-h2);font-weight:var(--theme-weight-heading);line-height:var(--theme-line-heading);letter-spacing:var(--theme-tracking-heading);text-wrap:balance}
.store-root .cx-ol .cx-ol-text{margin:0;max-inline-size:38rem;font-family:var(--theme-font-body);font-size:1.0625rem;line-height:1.7;color:var(--theme-colors-muted);white-space:pre-line}
.cx-ol-frame .cx-ol-cta{margin-block-start:.5rem}
.cx-ol-deco{position:absolute;inset:0;pointer-events:none}
.cx-ol-rail{position:absolute;display:block;overflow:visible}
.cx-ol-rail[data-side^="top"]{inset-block-start:-1px}
.cx-ol-rail[data-side^="bottom"]{inset-block-end:-1px}
.cx-ol-rail[data-side$="-a"],.cx-ol-rail[data-side$="-b"]{block-size:2px;inline-size:calc(50% - var(--cx-ol-c) - var(--cx-ol-gap) / 2)}
.cx-ol-rail[data-side$="-a"]{inset-inline-start:var(--cx-ol-c)}
.cx-ol-rail[data-side$="-b"]{inset-inline-end:var(--cx-ol-c)}
.cx-ol-rail[data-side="start"],.cx-ol-rail[data-side="end"]{inset-block-start:var(--cx-ol-c);inline-size:2px;block-size:calc(100% - 2 * var(--cx-ol-c))}
.cx-ol-rail[data-side="start"]{inset-inline-start:-1px}
.cx-ol-rail[data-side="end"]{inset-inline-end:-1px}
${RTL} .cx-ol-rail,${RTL} .cx-ol-plain{transform:scaleX(-1)}
.cx-ol-corner{position:absolute;inline-size:40px;block-size:40px;overflow:visible;--cx-k:3}
.cx-ol-corner[data-corner="tl"]{top:0;left:0}
.cx-ol-corner[data-corner="tr"]{top:0;right:0;transform:rotate(90deg)}
.cx-ol-corner[data-corner="br"]{bottom:0;right:0;transform:rotate(180deg)}
.cx-ol-corner[data-corner="bl"]{bottom:0;left:0;transform:rotate(270deg)}
.cx-ol-ft{display:none;position:absolute;inline-size:var(--cx-ol-tw);block-size:var(--cx-ol-th);inset-inline-start:calc(50% - var(--cx-ol-tw) / 2);overflow:visible;--cx-k:5}
.cx-ol-ft[data-edge="top"]{inset-block-start:calc(var(--cx-ol-th) / -2)}
.cx-ol-ft[data-edge="bottom"]{inset-block-end:calc(var(--cx-ol-th) / -2)}
@media (min-width:640px){.cx-ol-ft{display:block}.cx-ol-frame[data-cx-tile]{--cx-ol-gap:var(--cx-ol-tw)}}
`;

// "once": the behaviour arms the host below the viewport, an observer sets
// data-cx-drawn and the transition draws rails first, then the tiles from
// the inline start (--cx-k) and each tile's paths in their order (--cx-j).
// "scroll": the behaviour writes --cx-p (0..1); each path draws over 40 % of
// the range, offset by its tile and its place in the tile.
const DRAW = `
${G} [data-cx-draw="once"][data-cx-armed] .cx-ol-p{stroke-dasharray:1;stroke-dashoffset:1}
${G} [data-cx-draw="once"][data-cx-armed][data-cx-drawn] .cx-ol-p{stroke-dashoffset:0;transition:stroke-dashoffset 1.6s var(--cx-ease);transition-delay:calc(var(--cx-k,0) * 60ms + var(--cx-j,0) * 70ms)}
${G} [data-cx-draw="scroll"][data-cx-live] .cx-ol-p{stroke-dasharray:1;stroke-dashoffset:clamp(0px,calc((1 - (var(--cx-p,1) - min(var(--cx-k,0),10) * .04 - var(--cx-j,0) * .015) / .4) * 1px),1px)}
@media print{.cx-ol-p{stroke-dasharray:none!important;stroke-dashoffset:0!important;transition:none!important}}
`;

export const ORNAMENT_LINE_CSS: string = minifyCss(LAYOUT + DRAW);
