// Stylesheet of the "motion-path" section: one constant string, per-instance
// values through inline CSS variables (--cx-n, --cx-mp-art, the three
// colours). Everything here is the static, complete page; the passed /
// not-passed states exist only under the gate G and the behaviour's
// data-cx-live marker.
//
// Layouts. Below 1024 px: a plain vertical line at the inline start with the
// cards stacked beside it (rows of their own height). From 1024 px the rows
// are equal (grid 1fr), so the chosen shape, which crosses the centre line
// at every stop, meets each marker; cards alternate around a centred line
// or sit on one side of a line at the inline start.

import { G, minifyCss } from './base.css';

// Text rules start with `.store-root .cx-mp` (0,3,0): above the store
// typography rule for p / li / span (0,1,2).
const LAYOUT = `
.cx-mp{position:relative;padding-block:clamp(4rem,9vw,7.5rem)}
.cx-mp-in{max-inline-size:var(--theme-container-max);margin-inline:auto;padding-inline:1.5rem}
.cx-mp-head{display:grid;gap:1rem;max-inline-size:44rem;margin-block-end:clamp(2.5rem,5vw,4rem)}
.store-root .cx-mp .cx-mp-heading{margin:0}
.store-root .cx-mp .cx-mp-sub{margin:0;max-inline-size:36rem;font-family:var(--theme-font-body);font-size:1.0625rem;line-height:1.7;color:var(--theme-colors-muted)}
.cx-mp-body{position:relative;isolation:isolate;--cx-mp-rail:40px;--cx-mp-o:0px;--cx-mp-pc:var(--cx-mp-path,var(--theme-colors-border));--cx-mp-tc:var(--cx-mp-trail,var(--theme-colors-accent));--cx-mp-mc:var(--cx-mp-marker,var(--theme-colors-accent))}
.cx-mp-stops{position:relative;z-index:1;display:grid;margin:0;padding:0;list-style:none}
.cx-mp-stop{display:grid;grid-template-columns:var(--cx-mp-rail) minmax(0,1fr);column-gap:1rem;margin:0;padding:0 0 1.5rem}
.cx-mp-stop:last-child{padding-block-end:0}
.cx-mp-dot{grid-column:1;grid-row:1;justify-self:center;align-self:start;margin-block-start:22px;inline-size:12px;block-size:12px;border-radius:50%;background:var(--cx-mp-mc);box-shadow:0 0 0 5px color-mix(in srgb,var(--cx-mp-mc) 20%,transparent)}
.cx-mp-card{grid-column:2;grid-row:1;display:flex;flex-direction:column;gap:.625rem;min-inline-size:0;padding:1.5rem;border:1px solid var(--theme-colors-border);border-radius:var(--cx-radius-card);background:var(--theme-colors-surface)}
.cx-mp-media{position:relative;aspect-ratio:16/10;margin-block-end:.5rem;border-radius:18px;overflow:clip;background:color-mix(in srgb,currentColor 6%,transparent)}
.store-root .cx-mp .cx-mp-label{margin:0;font-family:var(--theme-font-body);font-size:12px;line-height:1.4;font-weight:600;letter-spacing:.16em;text-transform:uppercase;color:var(--cx-mp-mc)}
.store-root .cx-mp .cx-mp-label[data-cx-script="arabic"]{letter-spacing:0;text-transform:none;font-size:13px}
.store-root .cx-mp .cx-mp-title{margin:0;font-family:var(--theme-font-heading);font-size:1.375rem;line-height:1.25;font-weight:var(--theme-weight-heading)}
.store-root .cx-mp .cx-mp-text{margin:0;font-family:var(--theme-font-body);font-size:.9375rem;line-height:1.65;color:var(--theme-colors-muted)}
.store-root .cx-mp .cx-mp-link{display:inline-flex;align-items:center;gap:.5rem;align-self:flex-start;margin-block-start:.375rem;font-family:var(--theme-font-body);font-size:.875rem;font-weight:600;line-height:1.4;color:var(--theme-colors-text);text-decoration:none;outline-color:currentColor}
.cx-mp-arrow{flex:none;inline-size:1em;block-size:1em;transition:translate .3s cubic-bezier(.16,1,.3,1)}
.cx-mp-link:hover .cx-mp-arrow{translate:4px 0}
.store-root[dir="rtl"] .cx-mp-arrow{scale:-1 1}
.store-root[dir="rtl"] .cx-mp-link:hover .cx-mp-arrow{translate:-4px 0}
`;

// The line. Two stacked layers (base and trail) hold the same SVG; the trail
// is revealed by a clip from the top, which is exact because every preset
// only moves downward. The artwork is parked at the end of the line; its
// centre is put there with margins, so the behaviour owns its transform.
const LINE = `
.cx-mp-rail{position:absolute;inset-block:28px 0;inset-inline-start:0;inline-size:var(--cx-mp-rail);pointer-events:none}
.cx-mp-layer{position:absolute;inset:0}
.cx-mp-trail{clip-path:inset(-24px -24px var(--cx-mp-clip,-24px) -24px)}
.cx-mp-svg{display:block;inline-size:100%;block-size:100%;overflow:visible}
.store-root[dir="rtl"] .cx-mp-svg{transform:scaleX(-1)}
.cx-mp-p{stroke-linecap:round;stroke-linejoin:round}
.cx-mp-p-shape{display:none}
.cx-mp-base .cx-mp-p{stroke:var(--cx-mp-pc);stroke-width:1.5px}
.cx-mp-trail .cx-mp-p{stroke:var(--cx-mp-tc);stroke-width:2.5px}
.cx-mp-body[data-cx-style="dashed"] .cx-mp-base .cx-mp-p{stroke-width:2.5px;stroke-dasharray:.1 9}
.cx-mp-body[data-cx-style="band"] .cx-mp-base .cx-mp-p{stroke-width:16px}
.cx-mp-body[data-cx-style="band"] .cx-mp-trail .cx-mp-p{stroke-width:2px}
.cx-mp-art{position:absolute;z-index:2;top:100%;left:50%;inline-size:var(--cx-mp-art,64px);block-size:var(--cx-mp-art,64px);margin:calc(var(--cx-mp-art,64px) / -2) 0 0 calc(var(--cx-mp-art,64px) / -2)}
.cx-mp-art::before{content:"";position:absolute;inset:-40%;border-radius:50%;background:radial-gradient(closest-side,color-mix(in srgb,var(--cx-mp-tc) 36%,transparent),transparent)}
.cx-mp-art-in{position:relative;display:grid;place-items:center;inline-size:100%;block-size:100%}
.cx-mp-art-img{inline-size:100%;block-size:100%}
.store-root[dir="rtl"] .cx-mp-art-img[data-cx-flip]{transform:scaleX(-1)}
.cx-mp-bead{inline-size:16px;block-size:16px;border-radius:50%;background:var(--cx-mp-tc);box-shadow:0 0 0 6px color-mix(in srgb,var(--cx-mp-tc) 24%,transparent)}
`;

const DESKTOP = `
@media (min-width:1024px){
.cx-mp-in[data-cx-head="above"][data-cx-layout="alternate"] .cx-mp-head{margin-inline:auto;justify-items:center;text-align:center}
.cx-mp-in[data-cx-head="above"][data-cx-layout="alternate"] .cx-mp-sub{margin-inline:auto}
.cx-mp-in[data-cx-head="sticky"]{display:grid;grid-template-columns:minmax(0,5fr) minmax(0,7fr);column-gap:clamp(2rem,5vw,5rem);align-items:start}
.cx-mp-in[data-cx-head="sticky"] .cx-mp-head{position:sticky;top:calc(var(--cx-header-h,0px) + 6rem);margin-block-end:0}
.cx-mp-body{--cx-mp-rail:112px;--cx-mp-t:calc((100% - var(--cx-mp-o)) / var(--cx-n,1))}
.cx-mp-in[data-cx-layout="alternate"] .cx-mp-body{--cx-mp-rail:180px;--cx-mp-o:4.5rem}
.cx-mp-stops{grid-auto-rows:1fr;padding-block-start:var(--cx-mp-o)}
.cx-mp-stop,.cx-mp-stop:last-child{column-gap:0;align-items:center;margin-block-start:calc(var(--cx-mp-o) * -1);padding-block:1.5rem}
.cx-mp-dot{align-self:center;margin-block-start:0}
.cx-mp-card{inline-size:100%;max-inline-size:34rem;padding:1.75rem}
.cx-mp-rail{inset-block:calc((var(--cx-mp-t) + var(--cx-mp-o)) / 2) auto;block-size:calc(var(--cx-mp-t) * (var(--cx-n,1) - 1))}
.cx-mp-body[data-cx-shaped] .cx-mp-p-line{display:none}
.cx-mp-p-shape{display:inline}
.cx-mp-in[data-cx-layout="alternate"] .cx-mp-rail{inset-inline-start:calc(50% - var(--cx-mp-rail) / 2)}
.cx-mp-in[data-cx-layout="alternate"] .cx-mp-stop{grid-template-columns:minmax(0,1fr) var(--cx-mp-rail) minmax(0,1fr)}
.cx-mp-in[data-cx-layout="alternate"] .cx-mp-dot{grid-column:2}
.cx-mp-in[data-cx-layout="alternate"] .cx-mp-card{max-inline-size:27rem}
.cx-mp-in[data-cx-layout="alternate"] .cx-mp-stop[data-cx-side="start"] .cx-mp-card{grid-column:1;justify-self:end}
.cx-mp-in[data-cx-layout="alternate"] .cx-mp-stop[data-cx-side="end"] .cx-mp-card{grid-column:3;justify-self:start}
}
`;

// Behind the gate. Only once the behaviour is live do the stops ahead of the
// artwork step back (reversible); nothing changes size, so nothing shifts.
const MOTION = `
@keyframes cx-mp-halo{from{opacity:.5;transform:scale(.88)}to{opacity:1;transform:scale(1.08)}}
@keyframes cx-mp-pulse{0%{transform:scale(1)}45%{transform:scale(1.45)}100%{transform:scale(1)}}
${G} .cx-mp-art::before{animation:cx-mp-halo 3.2s ease-in-out infinite alternate}
${G} [data-cx-section][data-cx-watch]:not([data-cx-inview]) .cx-mp-art::before{animation-play-state:paused}
${G} .cx-mp-body[data-cx-live] .cx-mp-card{transition:opacity .9s var(--cx-ease),transform var(--cx-dur) var(--cx-ease)}
${G} .cx-mp-body[data-cx-live] .cx-mp-stop:not([data-cx-passed]) .cx-mp-card{opacity:.35;transform:translateY(24px)}
${G} .cx-mp-body[data-cx-live] .cx-mp-dot{transition:background-color .4s ease,box-shadow .4s ease}
${G} .cx-mp-body[data-cx-live] .cx-mp-stop:not([data-cx-passed]) .cx-mp-dot{background:var(--theme-colors-background);box-shadow:inset 0 0 0 1.5px var(--cx-mp-mc),0 0 0 5px transparent}
${G} .cx-mp-body[data-cx-live] .cx-mp-stop[data-cx-passed] .cx-mp-dot{animation:cx-mp-pulse .5s var(--cx-ease) both}
@media print{.cx-mp-card{opacity:1!important;transform:none!important}.cx-mp-trail{clip-path:none!important}}
`;

export const MOTION_PATH_CSS: string = minifyCss(LAYOUT + LINE + DESKTOP + MOTION);
