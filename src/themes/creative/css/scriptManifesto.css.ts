// Stylesheet of "script-manifesto": one constant string, per-instance
// colours through inline CSS variables (--cx-sm-bg / -fg / -ac).
//
// Default state = the complete stack at rest. The only own motion is the
// accent bar of the active row, which grows from its top after the row is
// shown: its hidden start state exists only behind the gate G and keys on
// the reveal state of the row's hairline (the element carrying the line
// recipe), so no JavaScript, reduced motion, store motion off and the
// builder all show the bar.
//
// Text rules start with `.store-root` plus a class: the store typography
// rule `.store-root main :is(p, li, span)` would otherwise win.

import { G, minifyCss } from './base.css';

// A manual line break shapes the active (strong) line only; in a quiet row
// it reads as a space, so the stack stays compact. Labels are styled by
// their own script (a language name is written in its own language), not by
// the page language.
//
// Type scale of the spec: active row H-M (28 to 44 px; 26 to 30 px on
// phones), other rows 22 to 26 px (19 px on phones).
const LAYOUT = `
.cx-sm{--cx-sm-bg:var(--theme-colors-text);--cx-sm-fg:var(--theme-colors-background);--cx-sm-ac:var(--theme-colors-accent);--cx-sm-muted:color-mix(in srgb,var(--cx-sm-fg) 46%,transparent);--cx-sm-hair:color-mix(in srgb,var(--cx-sm-fg) 18%,transparent);--cx-sm-afs:clamp(1.625rem,1.25rem + 1.6vw,1.875rem);--cx-sm-alh:1.16;--cx-sm-pad:20px;background:var(--cx-sm-bg);color:var(--cx-sm-fg)}
.cx-sm-in{box-sizing:border-box;max-inline-size:var(--theme-container-max,1280px);margin-inline:auto;padding:72px 24px}
.cx-sm-mark{display:flex;justify-content:center;margin-block-end:40px}
.cx-sm-mark-in{position:relative;inline-size:40px;block-size:40px}
.cx-sm-mark-in img{display:block;inline-size:100%;block-size:100%;object-fit:contain}
.cx-sm-stack{position:relative;margin-inline:auto}
.store-root .cx-sm-list{list-style:none;margin:0;padding:0}
.store-root .cx-sm-row{position:relative;display:grid;grid-template-columns:minmax(0,1fr);row-gap:8px;margin:0;padding-block:var(--cx-sm-pad);padding-inline:0}
.cx-sm-rule{position:absolute;inset-block-start:0;inset-inline:0;display:block;block-size:1px;background:var(--cx-sm-hair)}
.cx-sm-rule[data-end]{position:relative;inset:auto}
.cx-sm-cell{position:relative;min-inline-size:0}
.store-root .cx-sm-label{display:block;margin:0;font-family:var(--theme-font-body);font-size:12px;line-height:1.4;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:var(--cx-sm-muted)}
.store-root .cx-sm-label[data-cx-script="arabic"]{font-size:13px;letter-spacing:0;text-transform:none}
.store-root .cx-sm-text{display:block;margin:0;font-family:var(--theme-font-heading);font-size:19px;line-height:1.3;font-weight:var(--theme-weight-heading,500);letter-spacing:0;text-align:start;text-wrap:balance;color:var(--cx-sm-muted)}
.store-root .cx-sm-text[data-cx-script="arabic"]{line-height:1.5}
.store-root .cx-sm-row[data-active] .cx-sm-text{white-space:pre-line;font-size:var(--cx-sm-afs);line-height:var(--cx-sm-alh);color:var(--cx-sm-fg)}
.store-root .cx-sm-row[data-active] .cx-sm-text[data-cx-script="arabic"]{--cx-sm-alh:1.5}
.cx-sm-row[data-active]:has(.cx-sm-text[data-cx-script="arabic"]){--cx-sm-alh:1.5}
.cx-sm-bar{position:absolute;inset-block-start:calc((var(--cx-sm-afs) * var(--cx-sm-alh) - 24px) / 2);inset-inline-start:-12px;display:block;inline-size:2px;block-size:24px;background:var(--cx-sm-ac);transform-origin:50% 0}
.cx-sm-cta{margin-block-start:40px;text-align:center}
.store-root .cx-sm-link{display:inline-block;padding-block:20px 4px;font-family:var(--theme-font-body);font-size:14px;line-height:20px;font-weight:600;letter-spacing:.04em;color:var(--cx-sm-fg);text-decoration:underline;text-decoration-thickness:1px;text-underline-offset:6px}
.store-root .cx-sm-link:lang(ar){letter-spacing:0;font-size:15px}
.store-root .cx-sm-link:focus-visible{outline:2px solid currentColor;outline-offset:3px}
@media (min-width:768px){
.cx-sm{--cx-sm-afs:clamp(1.75rem,1.2rem + 1.8vw,2.75rem);--cx-sm-alh:1.12;--cx-sm-pad:28px}
.cx-sm-in{padding:96px 40px}
.cx-sm-stack{inline-size:calc(83.3333% - 4px)}
.store-root .cx-sm-row{grid-template-columns:96px minmax(0,1fr);column-gap:24px;row-gap:0;align-items:baseline}
.store-root .cx-sm-row[data-nolabel]{grid-template-columns:minmax(0,1fr)}
.store-root .cx-sm-label{font-size:11px}
.store-root .cx-sm-text{font-size:clamp(1.375rem,1.2rem + .45vw,1.625rem);line-height:1.25}
.cx-sm-bar{inset-inline-start:-140px}
.cx-sm-row[data-nolabel] .cx-sm-bar{inset-inline-start:-20px}
}
@media (min-width:1024px){
.cx-sm-in{padding:112px 64px}
.cx-sm-stack{inline-size:calc(66.6667% - 8px)}
}
`;

// The bar waits for the active sentence (--cx-sm-bd, written per instance:
// the row's beat plus 0.8 s) and grows from its top in 0.6 s.
const MOTION = `
@keyframes cx-sm-bar{from{transform:scaleY(0)}}
${G} .cx-sm-rule[data-cx-state="pending"]~.cx-sm-cell .cx-sm-bar{transform:scaleY(0)}
${G} .cx-sm-rule[data-cx-state="shown"]~.cx-sm-cell .cx-sm-bar{transition:transform .6s var(--cx-ease,cubic-bezier(.16,1,.3,1));transition-delay:var(--cx-sm-bd,.8s)}
${G} .cx-sm-rule[data-cx-intro]~.cx-sm-cell .cx-sm-bar{animation:cx-sm-bar .6s var(--cx-ease,cubic-bezier(.16,1,.3,1)) var(--cx-sm-bd,.8s) both}
@media print{.cx-sm-bar{transform:none!important;animation:none!important}}
`;

export const SCRIPT_MANIFESTO_CSS: string = minifyCss(LAYOUT + MOTION);
