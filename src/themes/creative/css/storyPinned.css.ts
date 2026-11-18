// Stylesheet of "story-pinned" (one constant string; per-instance values come
// through inline CSS variables: --cx-n, --cx-card-w, --cx-sp-ac).
//
// Default layout (no JavaScript, phones, touch, reduced motion, store motion
// off, builder): a native swipe row with scroll snap, or a stack on phones.
// Pinned layout: only under the gate G and on a desktop with a fine pointer.
// The track is taller than the viewport and the stage sticks inside it; the
// height is pure CSS (from the card count), so nothing shifts when the
// behaviour starts. The view keeps its native horizontal scroll until the
// behaviour marks the track `data-cx-live`.

import { DESKTOP_FINE, G, G_RTL, minifyCss } from './base.css';

const P = '.store-root .cx-sp';
// The pinned stage needs some height to hold a heading and a card.
const PINNED = `${DESKTOP_FINE} and (min-height: 620px)`;

const BASE = `
.cx-sp{position:relative;padding-block:clamp(3.5rem,8vw,6rem);--cx-gap:1.25rem;--cx-pad:max(1.5rem,calc((100vw - var(--theme-container-max,80rem)) / 2 + 1.5rem));--cx-sp-ac:var(--theme-colors-accent);--cx-ar:1.25}
.cx-sp[data-cx-aspect="square"]{--cx-ar:1}
.cx-sp[data-cx-aspect="landscape"]{--cx-ar:.6667}
${P} .cx-sp-skip{position:absolute;inset-inline-start:var(--cx-pad);inset-block-start:.5rem;z-index:3;padding:.5rem 1rem;border-radius:999px;background:var(--theme-colors-text);color:var(--theme-colors-background);font-family:var(--theme-font-body);font-size:.8125rem;font-weight:600;line-height:1.2;text-decoration:none;opacity:0;clip-path:inset(50%);pointer-events:none}
${P} .cx-sp-skip:focus-visible{opacity:1;clip-path:none;pointer-events:auto}
.cx-sp-end{display:block;outline:none}
.cx-sp-top{display:flex;align-items:flex-end;justify-content:space-between;gap:2rem;padding-inline:var(--cx-pad);margin-block-end:clamp(1.5rem,4vw,2.5rem)}
.cx-sp-top[data-cx-bare]{margin-block-end:0}
.cx-sp-head{min-inline-size:0;max-inline-size:44rem}
${P} .cx-sp-h{margin:0}
${P} .cx-eyebrow+.cx-sp-h,${P} [data-cx-reveal]+.cx-sp-h{margin-block-start:.875rem}
${P} .cx-sp-sub{margin:1rem 0 0;max-inline-size:36rem;font-family:var(--theme-font-body);font-size:var(--theme-scale-body);line-height:var(--theme-line-body);color:var(--theme-colors-muted)}
.cx-sp-prog{display:none}
.cx-track-view{overflow-x:auto;overflow-y:hidden;scroll-snap-type:x mandatory;scroll-padding-inline:var(--cx-pad);scrollbar-width:none;overscroll-behavior-x:contain;padding-block-end:1.75rem;margin-block-end:-1.75rem}
.cx-track-view::-webkit-scrollbar{display:none}
@media (hover:hover) and (pointer:fine){.cx-track-view{scrollbar-width:thin;scrollbar-color:var(--theme-colors-border) transparent;padding-block-end:1.25rem;margin-block-end:0}.cx-track-view::-webkit-scrollbar{display:block;block-size:6px}.cx-track-view::-webkit-scrollbar-thumb{border-radius:3px;background:var(--theme-colors-border)}}
.cx-track-row{display:flex;gap:var(--cx-gap);inline-size:max-content;box-sizing:border-box;margin:0;padding:0 var(--cx-pad);list-style:none}
.cx-sp-card,.cx-sp-intro{flex:none;box-sizing:border-box;inline-size:min(85vw,var(--cx-card-w,28rem));scroll-snap-align:start}
.cx-sp-intro{display:flex;flex-direction:column;justify-content:center;padding-inline-end:1rem}
.cx-sp-card{position:relative;display:flex;flex-direction:column;overflow:clip;border:1px solid var(--theme-colors-border);border-radius:var(--cx-radius-card);background:var(--theme-colors-surface);--cx-dist:24px}
.cx-sp-media{flex:none;aspect-ratio:4/5;background:color-mix(in srgb,var(--theme-colors-text) 7%,transparent)}
.cx-sp[data-cx-aspect="square"] .cx-sp-media{aspect-ratio:1}
.cx-sp[data-cx-aspect="landscape"] .cx-sp-media{aspect-ratio:3/2}
.cx-sp-meta{display:flex;align-items:center;gap:.75rem;padding:1.5rem 1.5rem 0}
.cx-sp-body{display:flex;flex-direction:column;gap:.625rem;padding:1.5rem}
.cx-sp-meta+.cx-sp-body{padding-block-start:.875rem}
${P} .cx-sp-n{font-family:var(--theme-font-heading);font-weight:var(--theme-weight-heading);font-size:1.5rem;line-height:1;font-variant-numeric:lining-nums tabular-nums;direction:ltr;unicode-bidi:isolate;color:var(--theme-colors-muted)}
${P} .cx-sp-meta .cx-num{color:var(--theme-colors-muted)}
${P} .cx-sp-label{font-family:var(--theme-font-body);font-size:.6875rem;font-weight:600;line-height:1.4;letter-spacing:.16em;text-transform:uppercase;color:var(--cx-sp-ac)}
${P} .cx-sp-label[data-cx-script="arabic"]{font-size:.8125rem;letter-spacing:0;text-transform:none}
.cx-sp-icon{display:inline-flex;align-items:center;justify-content:center;flex:none;inline-size:2.75rem;block-size:2.75rem;margin-inline-start:auto;border-radius:999px;background:var(--cx-sp-ac)}
.cx-sp-icon img{inline-size:1.25rem;block-size:1.25rem;object-fit:contain}
${P} .cx-sp-title{margin:0;font-family:var(--theme-font-heading);font-weight:var(--theme-weight-heading);font-size:1.375rem;line-height:1.2;letter-spacing:var(--theme-tracking-heading);color:var(--theme-colors-text)}
${P} .cx-sp-text{margin:0;font-family:var(--theme-font-body);font-size:.9375rem;line-height:1.6;color:var(--theme-colors-muted)}
${P} .cx-sp-link{display:inline-flex;align-items:center;gap:.5rem;align-self:flex-start;margin-block-start:.5rem;padding-block-end:.125rem;border-block-end:1px solid currentColor;font-family:var(--theme-font-body);font-size:.875rem;font-weight:600;line-height:1.3;color:var(--theme-colors-text);text-decoration:none;outline-color:currentColor}
${P} .cx-sp-link:hover .cx-btn-arrow{translate:4px 0}
.store-root[dir="rtl"] .cx-sp .cx-sp-link:hover .cx-btn-arrow{translate:-4px 0}
`;

const STYLES = `
.cx-sp[data-cx-card="overlay"] .cx-sp-card{justify-content:space-between;aspect-ratio:4/5;border:0;background:#111}
.cx-sp[data-cx-card="overlay"][data-cx-aspect="square"] .cx-sp-card{aspect-ratio:1}
.cx-sp[data-cx-card="overlay"][data-cx-aspect="landscape"] .cx-sp-card{aspect-ratio:3/2}
.cx-sp[data-cx-card="overlay"] .cx-sp-media{position:absolute;inset:0;aspect-ratio:auto}
.cx-sp[data-cx-card="overlay"] .cx-sp-card::after{content:"";position:absolute;inset:0;background:linear-gradient(to top,rgba(0,0,0,.76),rgba(0,0,0,.12) 56%,rgba(0,0,0,.28));pointer-events:none}
.cx-sp[data-cx-card="overlay"] :is(.cx-sp-meta,.cx-sp-body){position:relative;z-index:1}
.cx-sp[data-cx-card="overlay"] .cx-sp-body{margin-block-start:auto}
${P}[data-cx-card="overlay"] :is(.cx-sp-title,.cx-sp-link,.cx-sp-n,.cx-sp-label,.cx-num){color:#fff}
${P}[data-cx-card="overlay"] .cx-sp-text{color:rgba(255,255,255,.84)}
.cx-sp[data-cx-card="panel"] .cx-sp-card{min-block-size:22rem}
.cx-sp[data-cx-card="panel"] .cx-sp-meta{align-items:flex-start;padding:1.75rem 1.75rem 0}
.cx-sp[data-cx-card="panel"] .cx-sp-body{margin-block-start:auto;padding:1.75rem}
@media (max-width:1023.98px){
.cx-sp[data-cx-mobile="stack"] .cx-track-view{overflow:visible;scroll-snap-type:none;padding-block-end:0;margin-block-end:0}
.cx-sp[data-cx-mobile="stack"] .cx-track-row{flex-direction:column;inline-size:auto}
.cx-sp[data-cx-mobile="stack"] :is(.cx-sp-card,.cx-sp-intro){inline-size:auto}
}
`;

// Pinned layout. --cx-len is the horizontal overflow of the row, computed
// from the item count: the track height exists at first paint.
const PINNED_CSS = `
${PINNED}{
${G} .cx-sp{padding-block:0}
${G} .cx-track{--cx-len:max(0px,calc(var(--cx-n,1) * var(--cx-card-w,28rem) + (var(--cx-n,1) - 1) * var(--cx-gap) + 2 * var(--cx-pad) - 100vw));block-size:calc(100svh + min(var(--cx-len),300svh))}
${G} .cx-track-stage{position:sticky;inset-block-start:var(--cx-header-h,0px);box-sizing:border-box;block-size:calc(100svh - var(--cx-header-h,0px));display:flex;flex-direction:column;justify-content:center;padding-block:clamp(1.5rem,5svh,3.5rem)}
${G} .cx-sp-top{flex:none}
${G} .cx-sp-top[data-cx-bare]{margin-block-end:1.25rem}
${G} .cx-sp-prog{display:flex;flex:none;flex-direction:column;align-items:flex-end;gap:.75rem;min-inline-size:14rem;margin-inline-start:auto}
${G} .cx-sp-bar{position:relative;inline-size:16rem;max-inline-size:100%;block-size:1px;background:var(--theme-colors-border)}
${G} .cx-sp-bar>span{position:absolute;inset:-.5px 0;background:var(--cx-sp-ac);transform:scaleX(var(--cx-p,0));transform-origin:0 50%}
${G_RTL} .cx-sp-bar>span{transform-origin:100% 50%}
${G} .cx-sp-pmeta{display:flex;align-items:center;gap:1.25rem}
${G} .cx-sp .cx-sp-count{font-family:var(--theme-font-body);font-size:.75rem;font-weight:600;line-height:1;letter-spacing:.12em;font-variant-numeric:lining-nums tabular-nums;direction:ltr;unicode-bidi:isolate;color:var(--theme-colors-text)}
${G} .cx-sp .cx-sp-hint{font-family:var(--theme-font-body);font-size:.6875rem;font-weight:600;line-height:1;letter-spacing:.18em;text-transform:uppercase;color:var(--theme-colors-muted)}
${G} .cx-sp .cx-sp-hint[data-cx-script="arabic"]{font-size:.8125rem;letter-spacing:0;text-transform:none}
${G} .cx-track-view{display:flex;flex:0 1 auto;min-block-size:0;scroll-snap-type:none;scrollbar-width:none;padding-block-end:0;margin-block-end:0}
${G} .cx-track-view::-webkit-scrollbar{display:none}
${G} .cx-track[data-cx-live] .cx-track-view{overflow-x:clip;overflow-y:visible}
${G} .cx-track-row{flex:none}
${G} .cx-sp :is(.cx-sp-card,.cx-sp-intro){inline-size:var(--cx-card-w,28rem)}
${G} .cx-sp-card{max-block-size:calc(var(--cx-card-w,28rem) * var(--cx-ar) + 13rem)}
${G} .cx-sp-media{flex:1 1 auto;min-block-size:7rem}
${G} .cx-sp[data-cx-card="overlay"] .cx-sp-card{max-block-size:calc(var(--cx-card-w,28rem) * var(--cx-ar))}
${G} .cx-sp[data-cx-card="panel"] .cx-sp-card{min-block-size:clamp(22rem,52svh,30rem);max-block-size:30rem}
}
`;

export const STORY_PINNED_CSS: string = minifyCss(BASE + STYLES + PINNED_CSS);
