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
// heights: the divider is exactly as tall as its tile and nothing shifts
// while it draws.

import { G, minifyCss } from './base.css';

const RTL = '.store-root[dir="rtl"]';

const LAYOUT = `
.cx-ol{position:relative;--cx-ol-ca:var(--theme-colors-text);--cx-ol-cb:var(--theme-colors-accent);--cx-ol-cc:var(--theme-colors-secondary);--cx-ol-sw:1.5px;--cx-ol-dur:1.6s}
.cx-ol[data-cx-stroke="thin"]{--cx-ol-sw:1px}
.store-root[data-motion-reveal="calm"] .cx-ol{--cx-ol-dur:2.1s}
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
${RTL} .cx-ol-plain{transform:scaleX(-1)}
`;

// "once": the behaviour arms the host below the viewport, an observer sets
// data-cx-drawn and one transition draws every stroke over 1.6 s (in-out;
// 2.1 s under the calm profile): the tiles follow each other from the inline
// start (--cx-k, capped so a strip of many small tiles never trails for
// seconds) and each tile's paths in their order (--cx-j).
// "scroll": the behaviour writes --cx-p (0..1); each path draws over 40 % of
// the range, offset by its tile and its place in the tile.
const DRAW = `
${G} [data-cx-draw="once"][data-cx-armed] .cx-ol-p{stroke-dasharray:1;stroke-dashoffset:1}
${G} [data-cx-draw="once"][data-cx-armed][data-cx-drawn] .cx-ol-p{stroke-dashoffset:0;transition:stroke-dashoffset var(--cx-ol-dur,1.6s) var(--cx-ease-io,cubic-bezier(.65,0,.35,1));transition-delay:calc(min(var(--cx-k,0),14) * 60ms + var(--cx-j,0) * 70ms)}
${G} [data-cx-draw="scroll"][data-cx-live] .cx-ol-p{stroke-dasharray:1;stroke-dashoffset:clamp(0px,calc((1 - (var(--cx-p,1) - min(var(--cx-k,0),10) * .04 - var(--cx-j,0) * .015) / .4) * 1px),1px)}
@media print{.cx-ol-p{stroke-dasharray:none!important;stroke-dashoffset:0!important;transition:none!important}}
`;

export const ORNAMENT_LINE_CSS: string = minifyCss(LAYOUT + DRAW);
