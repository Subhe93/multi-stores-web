// Stylesheet of "impact-arc": one constant string. Per-instance values come
// through inline CSS variables on the root (--cx-ia-bg / -fg / -arc = the
// three colours) and on the progress path (--cx-ia-f = the reached fraction).
//
// Default state = complete: the arc is drawn to its value in the markup (the
// dash array is the real fraction) and the figure is final. Everything that
// hides or moves sits behind the gate G and keys on the reveal state of the
// stage (the element that carries the fade recipe), so no JavaScript,
// reduced motion, store motion off and the builder all show the full gauge.
//
// The SVG scales with the gauge box, so stroke widths are stepped per
// breakpoint (user units) to stay close to 1 px and 2.5 px on screen.
// non-scaling-stroke is not used: it breaks pathLength-normalised dashes.

import { G, G_RTL, minifyCss, wipe, wipeFrom, wipeT } from './base.css';

const RTL = '.store-root[dir="rtl"]';
const TABLET = '@media (min-width:768px)';
const DESKTOP = '@media (min-width:1024px)';
const PHONE = '@media (max-width:767.98px)';
const FINE = '@media (hover:hover) and (pointer:fine)';

const LAYOUT = `
.cx-ia{--cx-ia-bg:var(--theme-colors-background,#fff);--cx-ia-fg:var(--theme-colors-text,#111);--cx-ia-arc:var(--theme-colors-accent,currentColor);--cx-ia-hair:color-mix(in srgb,currentColor 18%,transparent);--cx-ia-muted:color-mix(in srgb,currentColor 64%,transparent);--cx-ia-ridge:0%;--cx-ia-tw:2.2;--cx-ia-pw:5.6;position:relative;background:var(--cx-ia-bg);color:var(--cx-ia-fg);padding-block:72px;font-family:var(--theme-font-body,inherit)}
.cx-ia-in{box-sizing:border-box;max-inline-size:var(--theme-container-max,1280px);margin-inline:auto;padding-inline:24px}
.cx-ia-head{max-inline-size:640px;text-align:start}
.cx-ia-label{margin:0;font-size:12px;line-height:1.4;font-weight:600;letter-spacing:.14em;text-transform:uppercase}
.cx-ia-label:lang(ar){font-size:13px;letter-spacing:0;text-transform:none}
.cx-ia-eyebrow{color:var(--cx-ia-arc)}
.cx-ia-h{margin:16px 0 0;font-family:var(--theme-font-heading,inherit);font-weight:var(--theme-weight-heading,600);font-size:clamp(1.75rem,1.2rem + 1.8vw,2.75rem);line-height:1.12;white-space:pre-line;text-wrap:balance}
.cx-ia-h:lang(ar){line-height:1.3}
.cx-ia-body{margin:20px 0 0;max-inline-size:46ch;font-size:16px;line-height:1.65;color:var(--cx-ia-muted);white-space:pre-line}
.cx-ia-stage{margin-block-start:48px}
.cx-ia-sky{position:relative}
.cx-ia-gauge{position:relative;inline-size:100%;margin-inline:auto;aspect-ratio:2/1}
.cx-ia[data-cx-ridge]{--cx-ia-ridge:18%}
.cx-ia-ridge{position:absolute;inset-inline:0;inset-block-end:0;block-size:var(--cx-ia-ridge);z-index:0;pointer-events:none}
.cx-ia-ridge img{object-fit:cover;object-position:50% 100%}
.cx-ia-ridge[data-cx-vector] img{object-fit:fill}
.cx-ia-svg{position:absolute;inset:0;display:block;inline-size:100%;block-size:100%;overflow:visible;z-index:1}
.cx-ia-track{fill:none;stroke:currentColor;stroke-opacity:.3;stroke-width:var(--cx-ia-tw)}
.cx-ia-stage[data-cx-planned] .cx-ia-track{stroke-opacity:.6;stroke-dasharray:calc(var(--cx-ia-tw) * 2) calc(var(--cx-ia-tw) * 6)}
.cx-ia-tick{stroke:currentColor;stroke-opacity:.3;stroke-width:var(--cx-ia-tw)}
.cx-ia-prog{fill:none;stroke:var(--cx-ia-arc);stroke-width:var(--cx-ia-pw);stroke-linecap:round}
.cx-ia-horizon{position:absolute;inset-inline:0;inset-block-end:0;block-size:1px;background:color-mix(in srgb,currentColor 30%,transparent);z-index:1}
.cx-ia-mark{--cx-ia-ms:26px;position:absolute;z-index:3;inline-size:var(--cx-ia-ms);block-size:var(--cx-ia-ms);margin:calc(var(--cx-ia-ms) / -2) 0 0 calc(var(--cx-ia-ms) / -2);display:grid;place-items:center;pointer-events:none}
.cx-ia-mark img{display:block;inline-size:100%;block-size:100%;object-fit:contain}
.cx-ia-disc{display:block;inline-size:12px;block-size:12px;border-radius:50%;background:var(--cx-ia-arc);box-shadow:0 0 0 4px var(--cx-ia-bg)}
.cx-ia-core{position:absolute;z-index:2;inset-inline:18%;inset-block-end:max(10%,calc(var(--cx-ia-ridge) + 6px));display:flex;flex-direction:column;align-items:center;text-align:center}
.cx-ia-chip{display:inline-block;padding:4px 12px;border:1px solid color-mix(in srgb,currentColor 34%,transparent);border-radius:999px;background:var(--cx-ia-bg)}
.cx-ia-fig{margin:8px 0 0;font-family:var(--theme-font-heading,inherit);font-weight:var(--theme-weight-heading,600);font-size:40px;line-height:1.1;font-variant-numeric:tabular-nums lining-nums;white-space:nowrap}
.cx-ia-num{display:inline-block;text-align:center}
.cx-ia-of{margin-inline-start:.4em;font-size:.45em;color:var(--cx-ia-muted)}
.cx-ia-unit{margin:4px 0 0;font-size:13px;line-height:1.5}
.cx-ia-item{margin:0}
.cx-ia-title{display:block;font-size:15px;line-height:1.4;font-weight:600}
.cx-ia-meta{display:block;font-size:13px;line-height:1.5;color:var(--cx-ia-muted)}
.cx-ia-core .cx-ia-item{display:none;margin-block-start:14px}
.cx-ia-ends{display:flex;align-items:flex-start;justify-content:space-between;margin-block-start:20px;font-size:13px;line-height:1.5;font-variant-numeric:tabular-nums}
.cx-ia-end{flex:none;min-inline-size:10%;text-align:center;color:var(--cx-ia-muted)}
.cx-ia-ends .cx-ia-item{flex:1;min-inline-size:0;padding-inline:8px;text-align:center}
.cx-ia-steps{list-style:none;margin:40px 0 0;padding:0;display:grid;grid-template-columns:1fr}
.cx-ia-step{position:relative;display:grid;grid-template-columns:28px 1fr;column-gap:20px;padding-block:20px}
.cx-ia-step+.cx-ia-step::before{content:"";position:absolute;inset-block-start:0;inset-inline:48px 0;block-size:1px;background:var(--cx-ia-hair)}
.cx-ia-step:not(:last-child)::after{content:"";position:absolute;inset-inline-start:13.5px;inset-block:54px -16px;inline-size:1px;background:var(--cx-ia-arc)}
.cx-ia-n{font-family:var(--theme-font-heading,inherit);font-size:20px;line-height:28px;color:var(--cx-ia-arc);font-variant-numeric:tabular-nums lining-nums;text-align:center}
.cx-ia-st{margin:3px 0 0;font-size:15px;line-height:1.4;font-weight:600}
.cx-ia-sx{margin:6px 0 0;max-inline-size:30ch;font-size:13px;line-height:1.5;color:var(--cx-ia-muted);white-space:pre-line}
.cx-ia-arrow{display:none}
.cx-ia-foot{margin-block-start:32px;display:flex;flex-direction:column;align-items:stretch;gap:24px}
.cx-ia-note{margin:0;max-inline-size:60ch;font-size:13px;line-height:1.5;color:var(--cx-ia-muted);white-space:pre-line}
.cx-ia-cta{display:flex}
.cx-ia-btn{flex:1;box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;min-block-size:48px;padding:0 28px;border:1px solid currentColor;border-radius:var(--theme-radius-md,0);color:inherit;background:transparent;font-size:14px;line-height:1.2;font-weight:600;letter-spacing:.04em;text-decoration:none;text-align:center}
.cx-ia-btn:lang(ar){letter-spacing:0;font-size:15px}
.cx-ia-btn:focus-visible{outline:2px solid currentColor;outline-offset:3px}
${FINE}{
.cx-ia-btn:hover{background:var(--cx-ia-fg);color:var(--cx-ia-bg);border-color:var(--cx-ia-fg)}
}
${PHONE}{
.cx-ia-tick[data-cx-minor]{display:none}
}
${TABLET}{
.cx-ia{--cx-ia-tw:1.5;--cx-ia-pw:3.6;padding-block:96px}
.cx-ia[data-cx-ridge]{--cx-ia-ridge:22%}
.cx-ia-in{padding-inline:40px}
.cx-ia-head{margin-inline:auto;text-align:center}
.cx-ia-label{font-size:11px}
.cx-ia-label:lang(ar){font-size:13px}
.cx-ia-body{margin-inline:auto}
.cx-ia-stage{margin-block-start:64px}
.cx-ia-mark{--cx-ia-ms:32px}
.cx-ia-ends{margin-block-start:24px}
.cx-ia-gauge,.cx-ia-ends{inline-size:calc(83.333% - 4px);margin-inline:auto}
.cx-ia-core{inset-block-end:max(12%,calc(var(--cx-ia-ridge) + 14px))}
.cx-ia-fig{font-size:48px}
.cx-ia-core .cx-ia-item{display:block}
.cx-ia-ends .cx-ia-item{display:none}
.cx-ia-steps{inline-size:calc(83.333% - 4px);margin:48px auto 0;grid-template-columns:repeat(var(--cx-ia-n,3),minmax(0,1fr))}
.cx-ia-step{display:block;padding:4px 28px 8px}
.cx-ia-step:first-child{padding-inline-start:0}
.cx-ia-step:last-child{padding-inline-end:0}
.cx-ia-step+.cx-ia-step::before{inset-block:0;inset-inline:0 auto;inline-size:1px;block-size:auto}
.cx-ia-step:not(:last-child)::after{content:none}
.cx-ia-n{display:block;text-align:start}
.cx-ia-st{margin-block-start:10px}
.cx-ia-arrow{display:block;position:absolute;inset-block-start:4px;inset-inline-start:-8px;inline-size:16px;block-size:28px;padding-block:6px;box-sizing:border-box;background:var(--cx-ia-bg);color:var(--cx-ia-arc);z-index:1}
${RTL} .cx-ia-arrow{transform:scaleX(-1)}
.cx-ia-foot{margin-block-start:40px;align-items:center;text-align:center}
.cx-ia-btn{flex:none}
}
${DESKTOP}{
.cx-ia{--cx-ia-tw:1.1;--cx-ia-pw:2.7;padding-block:128px}
.cx-ia-in{padding-inline:64px}
.cx-ia-body{font-size:17px}
.cx-ia-gauge,.cx-ia-ends{inline-size:calc(66.667% - 8px)}
.cx-ia-fig{font-size:56px}
.cx-ia-step{padding-inline:36px}
}
`;

// Scroll reveal: the stage carries the fade recipe; its parts follow from
// its state. Horizon first, then the ridge line is uncovered along it by one
// soft-edged wipe, then the track, then the stroke runs to its value and the
// mark appears where it arrives (it never travels). The ridge carries a
// recipe attribute of its own; inside a stage it is taken over here, so it
// follows the stage's clock instead of a second observer (it used to rise in
// on its own, late, together with the mark).
const S = '.cx-ia-stage[data-cx-reveal]';
const QUIET = '.cx-ia-track,.cx-ia-tick,.cx-ia-ends'.split(',');
const each = (prefix: string, rule: string) => QUIET.map((q) => `${prefix} ${q}`).join(',') + rule;

const RIDGE_T = '1.6s var(--cx-ease-io) .3s';

const MOTION = `
${G} ${S} .cx-ia-horizon{transform-origin:0 50%}
${G_RTL} ${S} .cx-ia-horizon{transform-origin:100% 50%}
${G} ${S}[data-cx-state="pending"] .cx-ia-horizon{transform:scaleX(0)}
${G} ${S}[data-cx-state="shown"] .cx-ia-horizon{transition:transform 1.3s var(--cx-ease-io)}
${G} ${S} .cx-ia-ridge[data-cx-reveal]{opacity:1;transform:none}
${G} ${S}[data-cx-state="pending"] .cx-ia-ridge{${wipe('x', false)}}
${G_RTL} ${S}[data-cx-state="pending"] .cx-ia-ridge{${wipe('x-rtl', false)}}
${G} ${S}[data-cx-state="shown"] .cx-ia-ridge[data-cx-reveal]{${wipe('x', true)};${wipeT(RIDGE_T)}}
${G_RTL} ${S}[data-cx-state="shown"] .cx-ia-ridge[data-cx-reveal]{${wipe('x-rtl', true)}}
${each(`${G} ${S}[data-cx-state="pending"]`, '{opacity:0}')}
${each(`${G} ${S}[data-cx-state="shown"]`, '{transition:opacity .8s ease .3s}')}
${G} ${S}[data-cx-state="pending"] .cx-ia-prog{stroke-dashoffset:var(--cx-ia-f,0);opacity:0}
${G} ${S}[data-cx-state="shown"] .cx-ia-prog{transition:stroke-dashoffset 1.7s var(--cx-ease-io) .6s,opacity .2s linear .6s}
${G} ${S}[data-cx-state="pending"] .cx-ia-mark{opacity:0;translate:0 8px}
${G} ${S}[data-cx-state="shown"] .cx-ia-mark{transition:opacity .9s ease 1.9s,translate .9s var(--cx-ease) 1.9s}
${G} ${S}[data-cx-planned][data-cx-state="shown"] .cx-ia-mark{transition-delay:.9s}
`;

// First section of a page: the same sequence on load, CSS only.
const I = '.cx-ia-stage[data-cx-intro]';
const INTRO = `
@keyframes cx-ia-h{from{transform:scaleX(0)}}
@keyframes cx-ia-o{from{opacity:0}}
@keyframes cx-ia-w{${wipeFrom('x')}}
@keyframes cx-ia-w-r{${wipeFrom('x-rtl')}}
@keyframes cx-ia-p{0%{stroke-dashoffset:var(--cx-ia-f,0);opacity:0}8%{opacity:1}}
@keyframes cx-ia-m{from{opacity:0;translate:0 8px}}
${G} ${I} .cx-ia-horizon{transform-origin:0 50%;animation:cx-ia-h 1.3s var(--cx-ease-io) both}
${G_RTL} ${I} .cx-ia-horizon{transform-origin:100% 50%}
${G} ${I} .cx-ia-ridge[data-cx-intro]{${wipe('x', true)};animation:cx-ia-w ${RIDGE_T} both}
${G_RTL} ${I} .cx-ia-ridge[data-cx-intro]{${wipe('x-rtl', true)};animation-name:cx-ia-w-r}
${each(`${G} ${I}`, '{animation:cx-ia-o .8s ease .3s both}')}
${G} ${I} .cx-ia-prog{animation:cx-ia-p 1.7s var(--cx-ease-io) .6s both}
${G} ${I} .cx-ia-mark{animation:cx-ia-m .9s var(--cx-ease) 1.9s both}
${G} ${I}[data-cx-planned] .cx-ia-mark{animation-delay:.9s}
@media print{.cx-ia-ridge{-webkit-mask:none!important;mask:none!important;animation:none!important;transition:none!important}.cx-ia-horizon,.cx-ia-track,.cx-ia-tick,.cx-ia-ends,.cx-ia-prog,.cx-ia-mark{animation:none!important;transition:none!important;transform:none!important;translate:none!important;opacity:1!important;stroke-dashoffset:0!important}}
`;

export const IMPACT_ARC_CSS: string = minifyCss(LAYOUT + MOTION + INTRO);
