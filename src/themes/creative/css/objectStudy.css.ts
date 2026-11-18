// Stylesheet of "object-study": one constant string; per-instance values
// come through inline CSS variables on the section root (--cx-os-bg,
// --cx-os-text, --cx-os-lc = line colour, --cx-os-ground) and on each note
// (--cx-os-ny = its height beside the plate, in percent).
//
// Two compositions:
// - below 980 px: plate, then the notes as a numbered list, then the buy
//   block. The points on the photograph carry their numbers; no lines.
// - from 980 px: the plate in the middle of the 12-column grid with the
//   notes in the two margins, joined to their points by leader lines.
//   The plate, its points and the sides of the notes are PHYSICAL (a note
//   stays on the side of the point it describes), so the frame is laid out
//   left to right in every language and only the text direction follows
//   the store. That is why this file uses left / right in that block.
//
// Default state = everything drawn. The hidden start of the leader lines
// exists only behind the gate G, keyed on the reveal state of the wrapper
// that carries a recipe attribute.

import { G, minifyCss } from './base.css';

const WIDE = '@media (min-width:980px)';
const NARROW = '@media (max-width:979.98px)';
const RTL = '.store-root[dir="rtl"]';

const LAYOUT = `
.cx-os{background:var(--cx-os-bg,var(--theme-colors-surface));color:var(--cx-os-text,var(--theme-colors-text));--cx-os-accent:var(--theme-colors-accent);--cx-os-line:var(--cx-os-lc,var(--theme-colors-accent));--cx-os-hair:color-mix(in srgb,currentColor 18%,transparent);--cx-os-muted:color-mix(in srgb,currentColor 64%,transparent)}
.cx-os-in{box-sizing:border-box;max-inline-size:var(--theme-container-max,1280px);margin-inline:auto;padding:72px 24px}
@media (min-width:768px){.cx-os-in{padding:96px 40px}}
@media (min-width:1024px){.cx-os-in{padding:128px 64px}}
.cx-os-flow{max-inline-size:560px;margin-inline:auto}
.cx-os-head{display:flex;justify-content:space-between;align-items:baseline;gap:16px;padding-block-end:12px}
.cx-os-rule{block-size:1px;background:var(--cx-os-hair);margin-block-end:16px}
.store-root .cx-os-label{margin:0;font-family:var(--theme-font-body);font-size:12px;line-height:1.4;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:inherit}
.store-root .cx-os-label[data-cx-quiet]{margin-inline-start:auto;color:var(--cx-os-muted)}
.store-root .cx-os-label[data-cx-script="arabic"]{font-size:13px;letter-spacing:0;text-transform:none}
.cx-os-frame{position:relative}
.cx-os-plate{position:relative;aspect-ratio:4/5;background:var(--cx-os-ground,transparent)}
.cx-os[data-cx-aspect="square"] .cx-os-plate{aspect-ratio:1}
.cx-os-img{object-fit:contain}
.cx-os[data-cx-fit="cover"] .cx-os-img{object-fit:cover}
.cx-os-lines{position:absolute;inset:0;display:none;pointer-events:none}
.cx-os-lines svg{display:block;inline-size:100%;block-size:100%;overflow:visible}
.cx-os-l{fill:none;stroke:var(--cx-os-line);stroke-width:1;shape-rendering:crispEdges}
.store-root .cx-os-dot{position:absolute;box-sizing:border-box;display:flex;align-items:center;justify-content:center;inline-size:22px;block-size:22px;translate:-50% -50%;border-radius:50%;background:var(--cx-os-accent);box-shadow:0 0 0 2px var(--cx-os-bg,var(--theme-colors-surface));color:var(--theme-colors-accentContrast,#fff);font-family:var(--theme-font-body);font-size:12px;line-height:1;font-weight:600;font-variant-numeric:tabular-nums}
.store-root .cx-os-notes{margin:24px 0 0;padding:0;list-style:none}
.store-root .cx-os-note{display:grid;grid-template-columns:28px minmax(0,1fr);column-gap:16px;margin:0;padding:16px 0;border-block-start:1px solid var(--cx-os-hair);color:inherit}
.store-root .cx-os-note:last-child{border-block-end:1px solid var(--cx-os-hair)}
.store-root .cx-os-n{font-family:var(--theme-font-heading);font-size:20px;line-height:28px;font-weight:var(--theme-weight-heading,600);color:var(--cx-os-accent);font-variant-numeric:lining-nums tabular-nums}
.store-root .cx-os-nt{margin:0;padding-block-start:3px;font-family:var(--theme-font-body);font-size:15px;line-height:1.4;font-weight:600;letter-spacing:0;color:inherit}
.store-root .cx-os-nx{margin:4px 0 0;font-family:var(--theme-font-body);font-size:13px;line-height:1.5;color:var(--cx-os-muted);white-space:pre-line}
.cx-os-buy{margin-block-start:40px;max-inline-size:520px}
.store-root .cx-os-h{margin:0;font-family:var(--theme-font-heading);font-size:clamp(1.75rem,1.2rem + 1.8vw,2.75rem);line-height:1.12;font-weight:var(--theme-weight-heading,600);letter-spacing:var(--theme-tracking-heading,normal);color:inherit;white-space:pre-line}
.store-root .cx-os-h[data-cx-script="arabic"]{line-height:1.35;letter-spacing:0}
.store-root .cx-os-body{margin:16px 0 0;max-inline-size:44ch;font-family:var(--theme-font-body);font-size:16px;line-height:1.65;color:var(--cx-os-muted);white-space:pre-line}
.cx-os-row{display:flex;flex-direction:column;align-items:stretch;gap:16px;margin-block-start:28px}
.store-root .cx-os-price{display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 10px;margin:0;font-family:var(--theme-font-body);font-size:20px;line-height:1.3;font-weight:500;font-variant-numeric:tabular-nums;color:inherit}
.store-root .cx-os-was{font-size:15px;font-weight:400;text-decoration:line-through;color:var(--cx-os-muted)}
.store-root .cx-os-vat,.store-root .cx-os-meta{font-size:13px;line-height:1.5;font-weight:400;color:var(--cx-os-muted)}
.store-root .cx-os-btn{min-block-size:48px}
.store-root .cx-os-btn:focus-visible{outline:2px solid var(--cx-os-text,var(--theme-colors-text));outline-offset:3px}
${NARROW}{
.store-root .cx-os-btn{inline-size:100%;box-sizing:border-box}
}
${WIDE}{
.cx-os-flow{max-inline-size:none}
.cx-os-grid{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));column-gap:24px;--cx-os-mw:calc((100% - 264px) / 12 * 2 + 24px)}
.cx-os-mid{grid-column:3 / span 8;min-inline-size:0}
.cx-os-frame{direction:ltr}
.cx-os-lines{display:block}
.store-root .cx-os-label{font-size:11px}
.store-root .cx-os-label[data-cx-script="arabic"]{font-size:13px}
.store-root .cx-os-dot{inline-size:7px;block-size:7px;background:var(--cx-os-accent)}
.cx-os-dot-n{display:none}
.store-root .cx-os-notes{position:absolute;inset:0;margin:0;pointer-events:none}
.store-root .cx-os-note{position:absolute;top:var(--cx-os-ny,50%);display:block;box-sizing:border-box;inline-size:var(--cx-os-mw);margin-top:-14px;padding:0;border:0;pointer-events:auto}
.store-root .cx-os-note:last-child{border:0}
.store-root .cx-os-note[data-cx-side="left"]{left:0;padding-right:12px;text-align:right}
.store-root .cx-os-note[data-cx-side="right"]{right:0;padding-left:12px;text-align:left}
${RTL} .cx-os-note{direction:rtl}
.store-root .cx-os-n{display:block}
.store-root .cx-os-nt{padding-block-start:4px}
.store-root .cx-os-nx{max-inline-size:18ch}
.store-root .cx-os-note[data-cx-side="left"] .cx-os-nx{margin-left:auto;margin-right:0}
.store-root .cx-os-note[data-cx-side="right"] .cx-os-nx{margin-right:auto;margin-left:0}
.cx-os-buy{margin-inline:auto;text-align:center}
.store-root .cx-os-body{margin-inline:auto;font-size:17px}
.cx-os-row{flex-direction:row;flex-wrap:wrap;align-items:center;justify-content:center;gap:16px 28px}
.store-root .cx-os-price{justify-content:center}
}
@media (min-width:1024px){
.cx-os-grid{--cx-os-mw:calc((100% - 264px) / 12 * 3 + 48px)}
.cx-os-mid{grid-column:4 / span 6}
.store-root .cx-os-nx{max-inline-size:26ch}
}
`;

// Leader lines: each stroke is normalised (pathLength 1) and draws from the
// dot outwards. --cx-k = place of the leader (0.15 s apart), --cx-b / --cx-t
// = start and length of the stroke inside its leader. The lines start 1.1 s
// after the plate is shown, so the photograph has opened before they move.
// On the narrow layout the list rows are reached later by the scroll, so the
// long delay of the margin notes is dropped there.
const DRAW = `
@keyframes cx-os-draw{from{stroke-dashoffset:1}to{stroke-dashoffset:0}}
${G} .cx-os-lines[data-cx-state] .cx-os-l{stroke-dasharray:1}
${G} .cx-os-lines[data-cx-state="pending"] .cx-os-l{stroke-dashoffset:1}
${G} .cx-os-lines[data-cx-state="shown"] .cx-os-l{stroke-dashoffset:0;transition:stroke-dashoffset var(--cx-t,1.3s) var(--cx-ease-io,cubic-bezier(.65,0,.35,1));transition-delay:calc(1.1s + var(--cx-k,0) * .15s + var(--cx-b,0s))}
${G} .cx-os-lines[data-cx-intro] .cx-os-l{stroke-dasharray:1;animation:cx-os-draw var(--cx-t,1.3s) var(--cx-ease-io,cubic-bezier(.65,0,.35,1)) both;animation-delay:calc(1.1s + var(--cx-k,0) * .15s + var(--cx-b,0s))}
${NARROW}{
${G} .cx-os-note[data-cx-reveal],${G} .cx-os-note[data-cx-intro]{--cx-delay:0s}
}
@media print{.cx-os-l{stroke-dasharray:none!important;stroke-dashoffset:0!important;animation:none!important;transition:none!important}}
`;

export const OBJECT_STUDY_CSS: string = minifyCss(LAYOUT + DRAW);
