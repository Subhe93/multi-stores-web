// Stylesheet of "look-spread": one constant string; per-instance colours come
// through inline CSS variables (--cx-ls-bg, --cx-ls-text, --cx-ls-mark,
// --cx-ls-mark-text).
//
// Default state = the complete spread at rest. Everything that hides or moves
// sits behind the gate G: the frame of the small photograph waits for its
// mask, and the row / marker hover pairs (fine pointers only) are plain
// :has() selectors, one per row index, so no JavaScript is involved.
//
// Layout is logical; the only physical values are the marker coordinates
// (inline left / top percentages of the photograph, the same in every
// direction).

import { G, G_RTL, minifyCss } from './base.css';

const RTL = '.store-root[dir="rtl"]';
const HAIR = 'color-mix(in srgb,currentColor 18%,transparent)';
const MUTED = 'color-mix(in srgb,currentColor 62%,transparent)';
/** Row indices the hover pairs are generated for (the list renders at most six rows). */
const ROWS = [1, 2, 3, 4, 5, 6];

const LAYOUT = `
.cx-ls{--cx-ls-bg:var(--theme-colors-background,#fff);--cx-ls-text:var(--theme-colors-text,#111);--cx-ls-mark:var(--theme-colors-accent,#111);--cx-ls-mark-text:#fff;--cx-ls-g:24px;background:var(--cx-ls-bg);color:var(--cx-ls-text);padding-block:72px}
.cx-ls-in{box-sizing:border-box;max-inline-size:var(--theme-container-max,1280px);margin-inline:auto;padding-inline:var(--cx-ls-g)}
.cx-ls-head{margin-block-end:32px}
.cx-ls-photos{position:relative}
.cx-ls-a{position:relative;margin:0}
.cx-ls-frame{position:relative;overflow:clip;aspect-ratio:4/5;background:color-mix(in srgb,currentColor 6%,transparent)}
.cx-ls-b{position:relative;z-index:1;inline-size:56%;margin-inline-start:auto;margin-block-start:-40px}
.cx-ls-bframe{position:relative;padding:6px;background:var(--cx-ls-bg)}
.cx-ls-bframe .cx-ls-frame{aspect-ratio:3/4}
.cx-ls-img{object-fit:cover}
.cx-ls-side{margin-block-start:40px}
.cx-ls-list{list-style:none;margin:0;padding:0;border-block-end:1px solid ${HAIR}}
.cx-ls-row{position:relative;scroll-margin-block-start:128px;transition:background-color .3s ease}
.cx-ls-row:target{background:color-mix(in srgb,currentColor 5%,transparent)}
.cx-ls-hair{position:absolute;inset-block-start:0;inset-inline:0;block-size:1px;background:${HAIR}}
.cx-ls-link{display:grid;grid-template-columns:28px 56px minmax(0,1fr) auto;column-gap:16px;align-items:center;min-block-size:44px;padding-block:20px;color:inherit;text-decoration:none;outline-color:currentColor}
.cx-ls-link:focus-visible,.cx-ls-more:focus-visible,.cx-ls-m:focus-visible{outline:2px solid currentColor;outline-offset:3px}
.cx-ls-dot{display:block;inline-size:6px;block-size:6px;margin-inline-start:4px;background:var(--cx-ls-mark);rotate:45deg}
.cx-ls-thumb{position:relative;display:block;overflow:clip;aspect-ratio:1;background:color-mix(in srgb,currentColor 6%,transparent)}
.cx-ls-text{display:block;min-inline-size:0}
.cx-ls-pricebox{display:flex;flex-direction:column;align-items:flex-end;gap:2px;text-align:end}
.cx-ls-more{display:inline-flex;align-items:center;gap:10px;min-block-size:44px;margin-block-start:28px;color:inherit;text-decoration:none}
.cx-ls-arrow{flex:none;inline-size:16px;block-size:16px;transition:translate .3s cubic-bezier(.16,1,.3,1)}
.cx-ls-more:hover .cx-ls-arrow{translate:4px 0}
${RTL} .cx-ls-arrow{scale:-1 1}
${RTL} .cx-ls-more:hover .cx-ls-arrow{translate:-4px 0}
.cx-ls-m{position:absolute;z-index:2;display:block;inline-size:44px;block-size:44px;translate:-50% -50%;border-radius:50%;text-decoration:none;outline-color:var(--cx-ls-text)}
.cx-ls-mi{position:absolute;inset:0;margin:auto;display:flex;align-items:center;justify-content:center;inline-size:24px;block-size:24px;border-radius:50%;background:var(--cx-ls-mark);box-shadow:0 0 0 2px var(--cx-ls-bg)}
`;

// Text rules start with `.store-root` plus a class (see base.css.ts).
const TEXT = `
.store-root .cx-ls-label{margin:0;font-family:var(--theme-font-body);font-size:12px;line-height:1.4;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:var(--cx-ls-mark)}
.store-root .cx-ls-label:lang(ar),${RTL} .cx-ls-label{font-size:13px;letter-spacing:0;text-transform:none}
.store-root .cx-ls-heading{margin:12px 0 0;font-family:var(--theme-font-heading);font-size:clamp(1.75rem,1.2rem + 1.8vw,2.75rem);line-height:1.12;color:inherit;white-space:pre-line;text-wrap:balance}
.store-root .cx-ls-heading:lang(ar),${RTL} .cx-ls-heading{line-height:1.35;letter-spacing:0}
.store-root .cx-ls-note{margin:16px 0 0;max-inline-size:32ch;font-family:var(--theme-font-body);font-size:13px;line-height:1.5;color:${MUTED};white-space:pre-line}
.store-root .cx-ls-num{font-family:var(--theme-font-heading);font-size:20px;line-height:1;font-variant-numeric:tabular-nums;color:var(--cx-ls-mark)}
.store-root .cx-ls-title{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:3;overflow:hidden;overflow-wrap:anywhere;font-family:var(--theme-font-body);font-size:15px;line-height:1.35;font-weight:500;color:inherit}
.store-root .cx-ls-meta{display:block;margin-block-start:4px;font-family:var(--theme-font-body);font-size:13px;line-height:1.5;font-weight:400;color:${MUTED}}
.store-root .cx-ls-price{font-family:var(--theme-font-body);font-size:15px;line-height:1.35;font-weight:500;font-variant-numeric:tabular-nums;white-space:nowrap;color:inherit}
.store-root .cx-ls-vat{font-family:var(--theme-font-body);font-size:11px;line-height:1.3;color:${MUTED}}
.store-root .cx-ls-more-l{font-family:var(--theme-font-body);font-size:14px;line-height:1.4;font-weight:600;color:inherit}
.store-root .cx-ls-mi{font-family:var(--theme-font-body);font-size:12px;line-height:1;font-weight:600;font-variant-numeric:tabular-nums;color:var(--cx-ls-mark-text)}
`;

// Tablet: the desktop composition without the small photograph.
const TABLET = `
@media (min-width:768px){
.cx-ls{--cx-ls-g:40px;padding-block:96px}
.cx-ls-head{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));column-gap:24px;align-items:end;margin-block-end:56px}
.cx-ls-head-main{grid-column:1/7}
.store-root .cx-ls-note{grid-column:9/13;margin:0}
.cx-ls-spread{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));column-gap:24px;align-items:start}
.cx-ls-photos{display:contents}
.cx-ls-a{grid-row:1;grid-column:1/8}
.cx-ls-b{display:none}
.cx-ls-side{grid-row:1;grid-column:8/13;margin-block-start:0}
.cx-ls-link{grid-template-columns:28px 48px minmax(0,1fr) auto;column-gap:12px}
.cx-ls[data-cx-list="start"] .cx-ls-side{grid-column:1/6}
.cx-ls[data-cx-list="start"] .cx-ls-a{grid-column:6/13}
.cx-ls-mi{inline-size:28px;block-size:28px}
.store-root .cx-ls-mi{font-size:13px}
}
`;

const DESKTOP = `
@media (min-width:1024px){
.cx-ls{--cx-ls-g:64px;padding-block:128px}
.cx-ls-a{grid-column:1/8}
.cx-ls[data-cx-b] .cx-ls-a{grid-column:1/7}
.cx-ls-b{display:block;grid-row:1;grid-column:7/9;inline-size:auto;margin-block-start:96px;margin-inline:-48px -12px}
.cx-ls-bframe{padding:8px}
.cx-ls-side{grid-column:9/13}
.cx-ls-link{grid-template-columns:24px 64px minmax(0,1fr) auto;column-gap:14px}
.cx-ls[data-cx-list="start"] .cx-ls-side{grid-column:1/5}
.cx-ls[data-cx-list="start"] .cx-ls-a{grid-column:6/13}
.cx-ls[data-cx-list="start"][data-cx-b] .cx-ls-a{grid-column:7/13}
.cx-ls[data-cx-list="start"] .cx-ls-b{grid-column:5/7;margin-inline:-12px -48px}
}
`;

const pair = (g: string, shift: string) => `
${g} .cx-ls-row:is(:hover,:focus-within) .cx-ls-title{translate:${shift} 0}`;

const MOTION = `
${G} .cx-ls-bframe{transition:background-color .6s ease .2s}
${G} .cx-ls-bframe:has([data-cx-reveal="mask"][data-cx-state="pending"]){background-color:transparent}
@media (hover:hover) and (pointer:fine){
${G} .cx-ls-title{transition:translate .5s var(--cx-ease)}
${G} .cx-ls-mi{transition:scale .45s var(--cx-ease)}${pair(G, '4px')}${pair(G_RTL, '-4px')}
${ROWS.map(
  (n) => `${G} .cx-ls:has(.cx-ls-row[data-ls-n="${n}"]:is(:hover,:focus-within)) .cx-ls-m[data-ls-n="${n}"] .cx-ls-mi,${G} .cx-ls-m[data-ls-n="${n}"]:is(:hover,:focus-visible) .cx-ls-mi{scale:1.18}
${G} .cx-ls:has(.cx-ls-m[data-ls-n="${n}"]:is(:hover,:focus-visible)) .cx-ls-row[data-ls-n="${n}"]{background-color:color-mix(in srgb,currentColor 5%,transparent)}`,
).join('\n')}
}
@media print{.cx-ls-bframe{background-color:var(--cx-ls-bg)!important}}
`;

export const LOOK_SPREAD_CSS: string = minifyCss(LAYOUT + TEXT + TABLET + DESKTOP + MOTION);
