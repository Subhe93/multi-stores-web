// Stylesheet of "marquee-band" (classes cx-mq; the older `.marquee` of
// marquee-text is untouched). Zero JavaScript.
//
// Static default (no gate): the real list wraps on centred rows; the copies,
// the second row and the pause control do not exist visually. Under G each
// row is one max-content track holding the list several times; the keyframes
// move it by half its width, so the loop is seamless.
//
// Direction: --cx-dir is -1 in LTR and 1 under [dir="rtl"]; the second row
// runs the opposite way (negated, starting from the shifted position).

import { G, G_RTL, minifyCss } from './base.css';

const P = '.store-root .cx-mq';

const BASE = `
.cx-mq{position:relative;padding-block:1.75rem;border-block:1px solid var(--cx-mq-bd,var(--theme-colors-border));--cx-mq-gap:1.25rem}
.cx-mq[data-cx-size="sm"]{padding-block:1rem;--cx-mq-gap:.875rem}
${P} .cx-mq-h{margin:0 0 1rem;padding-inline:1.5rem;text-align:center;font-family:var(--theme-font-body);font-size:12px;font-weight:600;line-height:1.4;letter-spacing:.18em;text-transform:uppercase;color:var(--theme-colors-muted)}
${P} .cx-mq-h[data-cx-script="arabic"]{font-size:13px;letter-spacing:0;text-transform:none}
.cx-mq-toggle,.cx-mq-ctl{display:none}
.cx-mq-rows{position:relative;display:flex;flex-direction:column;gap:.875rem}
.cx-mq-row[data-cx-row="2"]{display:none}
.cx-mq-track{display:flex;justify-content:center;padding-inline:1.5rem}
.cx-mq-list{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;row-gap:.75rem;margin:0;padding:0;list-style:none}
.cx-mq-copy{display:none}
.cx-mq-item{display:inline-flex;align-items:center;flex:none}
.cx-mq-c{display:inline-flex;align-items:center;gap:.625rem;margin-inline:var(--cx-mq-gap);color:var(--cx-mq-fg,var(--theme-colors-text));text-decoration:none;outline-color:currentColor}
.cx-mq-c img{flex:none;object-fit:contain}
.cx-mq[data-cx-gray] .cx-mq-c img{filter:grayscale(1)}
${P} a.cx-mq-c:hover .cx-mq-t{opacity:.7}
${P} .cx-mq-t{font-family:var(--theme-font-heading);font-weight:var(--theme-weight-heading);font-size:1.25rem;line-height:1.2;letter-spacing:.04em;text-transform:uppercase;white-space:nowrap;color:var(--cx-mq-fg,var(--theme-colors-text));transition:opacity .25s ease}
${P}[data-cx-size="sm"] .cx-mq-t{font-family:var(--theme-font-body);font-weight:600;font-size:.8125rem;letter-spacing:.14em}
${P} .cx-mq-t[data-cx-script="arabic"]{letter-spacing:0;text-transform:none}
${P} .cx-mq-t[data-cx-look="outline"]{-webkit-text-stroke:1px currentColor;-webkit-text-fill-color:transparent}
${P}[data-cx-size="sm"] .cx-mq-t[data-cx-look="outline"]{-webkit-text-stroke:0;-webkit-text-fill-color:currentColor;opacity:.55}
.cx-mq-sep{display:inline-flex;align-items:center;flex:none;color:var(--theme-colors-accent)}
${P} .cx-mq-sg{font-family:var(--theme-font-body);font-size:1.25rem;line-height:1;color:var(--theme-colors-accent)}
${P}[data-cx-size="sm"] .cx-mq-sg{font-size:.8125rem}
.cx-mq-list:not(.cx-mq-copy) .cx-mq-item:last-child .cx-mq-sep{display:none}
.cx-mq[data-cx-item="pill"] .cx-mq-c,.cx-mq[data-cx-item="card"] .cx-mq-c{margin-inline:calc(var(--cx-mq-gap) / 2);border:1px solid var(--cx-mq-bd,var(--theme-colors-border));background:var(--theme-colors-surface)}
.cx-mq[data-cx-item="pill"] .cx-mq-c{gap:.75rem;padding:.375rem 1.25rem;border-radius:999px}
.cx-mq[data-cx-item="pill"] .cx-mq-c[data-cx-img]{padding-inline-start:.375rem}
.cx-mq[data-cx-item="pill"] .cx-mq-c img{border-radius:50%;object-fit:cover}
.cx-mq[data-cx-item="card"] .cx-mq-c{gap:.875rem;padding:.625rem 1.25rem;border-radius:20px}
.cx-mq[data-cx-item="card"] .cx-mq-c[data-cx-img]{padding-inline-start:.625rem}
.cx-mq[data-cx-item="card"] .cx-mq-c img{border-radius:14px;object-fit:cover}
@media (min-width:768px){
${P}:not([data-cx-size="sm"]) .cx-mq-t{font-size:1.5rem}
.cx-mq:not([data-cx-size="sm"]){--cx-mq-gap:1.5rem}
}
`;

const MOVING = `
@keyframes cx-mq{from{transform:translateX(calc(var(--cx-off,0) * 1%))}to{transform:translateX(calc(var(--cx-off,0) * 1% + var(--cx-dir,-1) * 50%))}}
${G} .cx-mq-row{overflow-x:clip}
${G} .cx-mq-row[data-cx-row="2"]{display:block}
${G} .cx-mq[data-cx-fade] .cx-mq-row{-webkit-mask-image:linear-gradient(90deg,transparent,#000 7%,#000 93%,transparent);mask-image:linear-gradient(90deg,transparent,#000 7%,#000 93%,transparent)}
${G} .cx-mq-track{--cx-dir:-1;--cx-off:0;justify-content:flex-start;inline-size:max-content;padding-inline:0;animation:cx-mq var(--cx-mq-dur,60s) linear infinite}
${G_RTL} .cx-mq-track{--cx-dir:1}
${G} .cx-mq-row[data-cx-row="2"] .cx-mq-track{--cx-dir:1;--cx-off:-50}
${G_RTL} .cx-mq-row[data-cx-row="2"] .cx-mq-track{--cx-dir:-1;--cx-off:50}
${G} .cx-mq-list{flex:none;flex-wrap:nowrap}
${G} .cx-mq-copy{display:flex}
${G} .cx-mq-list .cx-mq-item:last-child .cx-mq-sep{display:inline-flex}
${G} .cx-mq-row:hover .cx-mq-track,${G} .cx-mq-row:focus-within .cx-mq-track,${G} .cx-mq-toggle:checked~.cx-mq-row .cx-mq-track{animation-play-state:paused}
${G} .cx-mq-toggle{display:block;position:absolute;inset-inline-end:.75rem;inset-block-end:50%;inline-size:1px;block-size:1px;margin:0;opacity:0}
${G} .cx-mq-ctl{position:absolute;z-index:2;inset-inline-end:.75rem;inset-block-end:calc(50% - .875rem);display:inline-flex;align-items:center;justify-content:center;inline-size:1.75rem;block-size:1.75rem;border:1px solid var(--cx-mq-bd,var(--theme-colors-border));border-radius:50%;background:var(--theme-colors-background);color:var(--theme-colors-text);cursor:pointer;opacity:.6;transition:opacity .25s ease}
${G} .cx-mq-ctl:hover,${G} .cx-mq-toggle:focus-visible+.cx-mq-ctl{opacity:1}
${G} .cx-mq-toggle:focus-visible+.cx-mq-ctl{outline:2px solid currentColor;outline-offset:2px}
${G} .cx-mq-ctl svg{inline-size:.625rem;block-size:.625rem}
${G} .cx-mq-ctl>span{display:inline-flex}
${G} .cx-mq-ctl>.cx-mq-play,${G} .cx-mq-toggle:checked+.cx-mq-ctl>.cx-mq-pause{display:none}
${G} .cx-mq-toggle:checked+.cx-mq-ctl>.cx-mq-play{display:inline-flex}
.cx-mq-sr{position:absolute;inline-size:1px;block-size:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
@media print{.cx-mq-track{animation:none!important;transform:none!important}}
`;

export const MARQUEE_BAND_CSS: string = minifyCss(BASE + MOVING);
