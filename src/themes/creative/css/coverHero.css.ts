// Stylesheet of "cover-hero": one constant string, travelling with the
// section through CxSection. Per-instance values come in as inline CSS
// variables on the root (--cx-ch-bg / -text / -accent, button colours).
//
// The layout is the whole section: at rest everything is visible. The only
// rule behind the gate G caps the entrance sequence on phones; every entrance
// itself comes from the shared recipes (recipes.ts) through data attributes.
//
// Text rules start with `.store-root` plus a class (see css/base.css.ts).
// Logical properties only. Photographs, the seal and the woven edge are
// never mirrored; the grid mirrors by itself in right-to-left pages.
//
// Grid from 1024 px: 12 columns, 24 px gap. Text 1-5, column 6 empty, large
// photograph 7-10 with the woven edge in the gap before it, small photograph
// 11-12 starting 38 % down the large one. 768 to 1023 px: text 1-6, large
// photograph 7-12, no small photograph (its caption sits under the buttons).

import { G, minifyCss, wipe, wipeFrom, wipeT } from './base.css';

const RTL = '.store-root[dir="rtl"]';

const BASE = `
.cx-ch{--cx-ch-bg:var(--theme-colors-surface);--cx-ch-text:var(--theme-colors-text);--cx-ch-accent:var(--theme-colors-accent);--cx-ch-accent-fg:var(--theme-colors-accentContrast,#fff);--cx-ch-g:24px;--cx-ch-seal:56px;--cx-ch-disc:68px;--cx-ch-edge:12px;position:relative;background:var(--cx-ch-bg);color:var(--cx-ch-text);--cx-ch-hair:color-mix(in srgb,currentColor 18%,transparent);--cx-ch-btn-bg:var(--cx-ch-accent);--cx-ch-btn-fg:var(--cx-ch-accent-fg)}
.cx-ch[data-cx-tone="primary"]{--cx-ch-btn-bg:var(--theme-colors-primary);--cx-ch-btn-fg:var(--theme-colors-primaryContrast,#fff)}
.cx-ch-in{box-sizing:border-box;display:flex;flex-direction:column;max-inline-size:1280px;margin-inline:auto;padding-inline:var(--cx-ch-g);padding-block:12px 56px}
.cx-ch a:focus-visible{outline:2px solid currentColor;outline-offset:3px}
.cx-ch-fill{position:absolute;inset:0}
`;

// Row A: the masthead. Phones show one label (the centre one, else the start
// one); from 768 px the three sit on the hairline.
const MAST = `
.cx-ch-mast{position:relative;display:flex;align-items:center;justify-content:center;min-block-size:44px}
.cx-ch-hair{position:absolute;inset-inline:0;inset-block-end:0;block-size:1px;background:var(--cx-ch-hair)}
.store-root .cx-ch-lb{margin:0;font-family:var(--theme-font-body);font-size:12px;line-height:1.4;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:inherit}
.store-root .cx-ch-lb[data-cx-script="arabic"]{font-size:13px;letter-spacing:0;text-transform:none}
.store-root .cx-ch-mast .cx-ch-lb{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-inline-size:100%}
.cx-ch-mast[data-cx-mast="center"] :is(.cx-ch-ms,.cx-ch-me){display:none}
.cx-ch-mast[data-cx-mast="start"] .cx-ch-me{display:none}
@media (min-width:768px){
.store-root .cx-ch-lb{font-size:11px}
.store-root .cx-ch-lb[data-cx-script="arabic"]{font-size:13px}
.cx-ch-mast{display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);column-gap:24px}
.cx-ch-mast[data-cx-mast] :is(.cx-ch-ms,.cx-ch-me){display:block}
.cx-ch-ms{grid-column:1;justify-self:start}
.cx-ch-mc{grid-column:2}
.cx-ch-me{grid-column:3;justify-self:end}
.cx-ch[data-cx-seal] .cx-ch-mc{position:absolute;grid-column:1 / -1;inset-block-start:50%;translate:0 -50%;inset-inline-end:calc(50% + 12px + var(--cx-ch-disc) / 2 + 20px);max-inline-size:32%}
}
`;

// Row B: the cover. Phones stack (photograph, small photograph with its
// caption, text); `data-cx-order="text"` puts the text first.
const COVER = `
.cx-ch-cover{display:flex;flex-direction:column}
.cx-ch-photo{position:relative;order:1;margin-block-start:20px}
.cx-ch-frame{position:relative;overflow:clip;aspect-ratio:4/5;background:color-mix(in srgb,currentColor 6%,transparent)}
.cx-ch-edge{position:absolute;inset-block:0;inset-inline-end:100%;inline-size:var(--cx-ch-edge);background-repeat:repeat-y;background-position:center top;background-size:var(--cx-ch-edge) auto}
.cx-ch-seal{position:absolute;z-index:2;inset-block-start:0;inset-inline-start:16px;translate:0 -50%;display:grid;place-items:center;inline-size:var(--cx-ch-disc);block-size:var(--cx-ch-disc);border-radius:50%;background:var(--cx-ch-bg)}
.cx-ch-seal-in{position:relative;inline-size:var(--cx-ch-seal);block-size:var(--cx-ch-seal)}
.cx-ch-detail{position:relative;z-index:1;order:2;display:flex;align-items:flex-end;justify-content:space-between;gap:16px;margin-block-start:-56px}
.cx-ch-detail-in{display:contents}
.cx-ch-dimg{position:relative;order:2;flex:none;box-sizing:border-box;inline-size:38%;aspect-ratio:3/4;border:6px solid var(--cx-ch-bg);background:var(--cx-ch-bg);overflow:clip}
.cx-ch-detail .cx-ch-capw{order:1;flex:1;min-inline-size:0}
.cx-ch-text{order:3;display:flex;flex-direction:column;align-items:flex-start;padding-block-start:36px}
.cx-ch[data-cx-order="text"] .cx-ch-text{order:0;padding-block:28px 12px}
`;

const TEXT = `
.store-root .cx-ch-eb{color:var(--cx-ch-accent);margin-block-end:18px}
.store-root .cx-ch-h{margin:0;font-family:var(--theme-font-heading);font-size:clamp(2.25rem,1.2rem + 3.4vw,3.875rem);line-height:1.06;font-weight:var(--theme-weight-heading,500);letter-spacing:var(--theme-tracking-heading,normal);color:inherit;white-space:pre-line;text-wrap:balance;overflow-wrap:break-word;max-inline-size:100%}
.store-root .cx-ch-h[data-cx-script="arabic"]{line-height:1.35;letter-spacing:0}
.cx-ch-rule{display:block;inline-size:48px;block-size:2px;margin-block:28px 20px;background:var(--cx-ch-accent)}
.store-root .cx-ch-sub{margin:0;max-inline-size:40ch;font-family:var(--theme-font-body);font-size:16px;line-height:1.65;color:color-mix(in srgb,currentColor 76%,transparent);white-space:pre-line}
.cx-ch-btns{display:flex;flex-direction:column;align-self:stretch;gap:12px;margin-block-start:32px}
.store-root a.cx-ch-btn{display:inline-flex;align-items:center;justify-content:center;box-sizing:border-box;min-block-size:48px;padding:10px 28px;border:1.5px solid var(--cx-ch-btn-bg);border-radius:var(--theme-radius-button,0px);background:var(--cx-ch-btn-bg);color:var(--cx-ch-btn-fg);font-family:var(--theme-font-body);font-size:14px;line-height:1.2;font-weight:600;letter-spacing:.04em;text-align:center;text-decoration:none}
.store-root a.cx-ch-btn[data-cx-variant="outline"]{border-color:currentColor;background:transparent;color:inherit}
.store-root a.cx-ch-btn[data-cx-script="arabic"]{letter-spacing:0}
@media (hover:hover){
.store-root a.cx-ch-btn:hover{opacity:.86}
.store-root a.cx-ch-btn[data-cx-variant="outline"]:hover{opacity:1;background:color-mix(in srgb,currentColor 7%,transparent)}
}
`;

// The caption sells the piece in the small photograph: label, then title and
// live price on one line, the whole caption one link. A second copy sits
// under the buttons for the layouts without the small photograph.
const CAPTION = `
.store-root .cx-ch-cap{display:inline-flex;flex-direction:column;justify-content:flex-end;gap:3px;min-block-size:44px;padding-block-end:5px;color:inherit;text-decoration:none}
.store-root .cx-ch-cap .cx-ch-lb{opacity:.62}
.store-root .cx-ch-cl{display:flex;flex-wrap:wrap;align-items:baseline;column-gap:10px;row-gap:0;font-family:var(--theme-font-body);font-size:13px;line-height:1.5;font-weight:500;color:inherit}
.store-root .cx-ch-ct{font:inherit;color:inherit}
.store-root .cx-ch-price{font:inherit;color:inherit;font-variant-numeric:tabular-nums;white-space:nowrap}
.store-root .cx-ch-note{font-family:var(--theme-font-body);font-size:11px;line-height:1.5;font-weight:400;color:inherit;opacity:.62;white-space:nowrap}
.cx-ch-capw-alt{margin-block-start:24px}
.cx-ch[data-cx-detail] .cx-ch-capw-alt{display:none}
`;

const TABLET = `
@media (min-width:768px){
.cx-ch{--cx-ch-g:40px;--cx-ch-edge:16px}
.cx-ch-in{padding-block:32px 0;min-block-size:clamp(640px,calc(100svh - var(--cx-ch-header,112px)),860px)}
.cx-ch-cover{flex:1 1 auto;display:grid;grid-template-columns:repeat(12,minmax(0,1fr));grid-template-rows:1fr;column-gap:24px}
.cx-ch-photo{grid-column:7 / 13;grid-row:1;order:0;min-block-size:440px}
.cx-ch-frame{position:absolute;inset:0;aspect-ratio:auto}
.cx-ch-seal{inset-block-start:-20px;inset-inline-start:0;translate:-50% -50%}
${RTL} .cx-ch-seal{translate:50% -50%}
.cx-ch-detail{display:none}
.cx-ch-text,.cx-ch[data-cx-order="text"] .cx-ch-text{grid-column:1 / 7;grid-row:1;order:0;align-self:end;padding-block:56px 72px;padding-inline-end:28px}
.cx-ch-btns{flex-direction:row;flex-wrap:wrap;align-self:auto;gap:16px}
.cx-ch[data-cx-detail] .cx-ch-capw-alt{display:block}
}
`;

const DESKTOP = `
@media (min-width:1024px){
.cx-ch{--cx-ch-g:64px}
.cx-ch[data-cx-seal="md"]{--cx-ch-seal:72px;--cx-ch-disc:88px}
.cx-ch-text,.cx-ch[data-cx-order="text"] .cx-ch-text{grid-column:1 / 6;padding-block-end:96px;padding-inline-end:0}
.store-root .cx-ch-sub{font-size:17px}
.cx-ch[data-cx-detail] .cx-ch-photo{grid-column:7 / 11}
.cx-ch[data-cx-detail] .cx-ch-detail{display:block;grid-column:11 / 13;grid-row:1;order:0;margin:0}
.cx-ch-detail-in{display:block;position:absolute;inset-inline:0;inset-block-start:calc(20px + (100% - 20px) * .38)}
.cx-ch-dimg{inline-size:100%;border:0;background:color-mix(in srgb,currentColor 6%,transparent)}
.cx-ch-detail .cx-ch-capw{margin-block-start:12px}
.cx-ch[data-cx-detail] .cx-ch-capw-alt{display:none}
}
`;

// Phones: the entrance sequence has at most three steps.
// The woven edge beside the photograph is a repeating strip: it is uncovered
// from the top by one soft-edged wipe instead of fading in all at once.
const EDGE_T = '1.6s var(--cx-ease-io) .4s';
const MOTION = `
@keyframes cx-ch-edge{${wipeFrom('y')}}
${G} .cx-ch-edge[data-cx-intro]{${wipe('y', true)};animation:cx-ch-edge ${EDGE_T} both}
${G} .cx-ch-edge[data-cx-reveal][data-cx-state="pending"]{opacity:1;${wipe('y', false)}}
${G} .cx-ch-edge[data-cx-reveal][data-cx-state="shown"]{${wipe('y', true)};${wipeT(EDGE_T)}}
@media (max-width:767.98px){
${G} .cx-ch [data-cx-i="4"]{--cx-i:3}
}
`;

export const COVER_HERO_CSS: string = minifyCss(BASE + MAST + COVER + TEXT + CAPTION + TABLET + DESKTOP + MOTION);
