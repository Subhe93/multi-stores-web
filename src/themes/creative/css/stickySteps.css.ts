// Stylesheet of "sticky-steps". The sticky heading column is plain CSS (no
// gate, no JavaScript). Static state = the default: the progress line is
// full (--cx-p unset reads as 1) and every step is at full strength. Only
// when the `steps` behaviour has marked the list `data-cx-live` do the steps
// that were not passed yet step back.

import { G, minifyCss } from './base.css';

const P = '.store-root .cx-st';

const BASE = `
.cx-st{padding-block:clamp(3.5rem,8vw,7rem);--cx-st-ac:var(--theme-colors-accent)}
.cx-st-in{box-sizing:border-box;display:grid;gap:2.5rem;max-inline-size:var(--theme-container-max,80rem);margin-inline:auto;padding-inline:1.5rem}
.cx-st-head{min-inline-size:0}
${P} .cx-st-h{margin:0}
${P} [data-cx-reveal]+.cx-st-h{margin-block-start:.875rem}
${P} .cx-st-sub{margin:1.25rem 0 0;max-inline-size:30rem;font-family:var(--theme-font-body);font-size:var(--theme-scale-body);line-height:var(--theme-line-body);color:var(--theme-colors-muted)}
.cx-st-cta{margin-block-start:2rem}
.cx-st-list{position:relative;display:grid;row-gap:5rem;margin:0;padding:.25rem 0;list-style:none;--cx-st-nh:2.5rem}
.cx-st[data-cx-spacing="sm"] .cx-st-list{row-gap:3rem}
.cx-st-list[data-cx-nsize="sm"]{--cx-st-nh:1.75rem}
.cx-st-list[data-cx-nsize="none"]{--cx-st-nh:2rem}
.cx-st-list[data-cx-line]::before,.cx-st-list[data-cx-line]::after{content:"";position:absolute;inset-block:0;inset-inline-start:0;inline-size:1px}
.cx-st-list[data-cx-line]::before{background:var(--theme-colors-border)}
.cx-st-list[data-cx-line]::after{background:var(--cx-st-ac);transform:scaleY(var(--cx-p,1));transform-origin:50% 0}
.cx-st-step{position:relative}
.cx-st-list[data-cx-line] .cx-st-step{padding-inline-start:3rem}
.cx-st-dot{display:none;position:absolute;z-index:1;inset-inline-start:-3.5px;inset-block-start:calc(var(--cx-st-nh) / 2 - 4px);inline-size:8px;block-size:8px;border-radius:50%;background:var(--cx-st-ac)}
.cx-st-list[data-cx-line] .cx-st-dot{display:block}
.cx-st-c{display:flex;align-items:flex-start;gap:1.75rem}
${P} .cx-st-c .cx-num{flex:none;min-inline-size:1.5em;color:color-mix(in srgb,var(--theme-colors-text) 60%,transparent)}
${P} .cx-st-c .cx-num[data-cx-num="solid"]{color:var(--cx-st-ac)}
.cx-st-tx{min-inline-size:0}
${P} .cx-st-title{margin:0;font-family:var(--theme-font-heading);font-weight:var(--theme-weight-heading);font-size:clamp(1.25rem,2.2vw,1.625rem);line-height:1.25;letter-spacing:var(--theme-tracking-heading);color:var(--theme-colors-text)}
${P} .cx-st-list:not([data-cx-nsize="sm"]) .cx-st-title{padding-block-start:.2rem}
${P} .cx-st-text{margin:.625rem 0 0;max-inline-size:34rem;font-family:var(--theme-font-body);font-size:var(--theme-scale-body);line-height:var(--theme-line-body);color:var(--theme-colors-muted)}
@media (min-width:1024px){
.cx-st-in{grid-template-columns:5fr 7fr;column-gap:clamp(3rem,7vw,6rem);align-items:start}
.cx-st[data-cx-side="end"] .cx-st-in{grid-template-columns:7fr 5fr}
.cx-st[data-cx-side="end"] .cx-st-head{order:2}
.cx-st .cx-st-in[data-cx-solo]{grid-template-columns:minmax(0,48rem)}
.cx-st-head{position:sticky;inset-block-start:calc(var(--cx-header-h,0px) + 6rem);align-self:start}
}
@media (max-width:767.98px){
${P} .cx-st-c .cx-num{font-size:1.75rem}
.cx-st .cx-st-list{row-gap:2.5rem;--cx-st-nh:1.75rem}
.cx-st[data-cx-spacing="sm"] .cx-st-list{row-gap:2rem}
.cx-st-list[data-cx-line] .cx-st-step{padding-inline-start:1.75rem}
.cx-st-c{gap:1rem}
${P} .cx-st-list .cx-st-title{padding-block-start:0}
}
`;

const LIVE = `
@keyframes cx-st-pulse{0%{transform:scale(1)}50%{transform:scale(1.25)}100%{transform:scale(1)}}
${G} .cx-st-list[data-cx-live] .cx-st-c{transition:opacity .5s ease}
${G} .cx-st-list[data-cx-live] .cx-st-c .cx-num{transition:color .5s ease}
${G} .cx-st-list[data-cx-live] .cx-st-step:not([data-cx-passed]) .cx-st-c{opacity:.45}
${G} .cx-st-list[data-cx-live] .cx-st-step:not([data-cx-passed]) .cx-st-dot{background:var(--theme-colors-background);box-shadow:inset 0 0 0 1px var(--theme-colors-muted)}
${G} .cx-st-list[data-cx-live] .cx-st-step[data-cx-passed] .cx-st-dot{animation:cx-st-pulse .4s ease-out}
${G} .cx-st .cx-st-list[data-cx-live] .cx-st-step[data-cx-passed] .cx-num[data-cx-num="outline"]{color:var(--theme-colors-text)}
`;

export const STICKY_STEPS_CSS: string = minifyCss(BASE + LIVE);
