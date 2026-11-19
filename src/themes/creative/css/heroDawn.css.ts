// Stylesheet of "hero-dawn" (one constant string). A night sky turning into
// dawn: a sun (built-in or the owner's emblem layers) rises behind a far
// ridge, an arch photograph rises in front of it, a small graded photo card
// follows, the copy enters line by line and a light ridge (the colour of the
// next section) closes the first screen.
//
// Layers, back to front: sky (CSS dawn gradients; the WebGL light of the
// `dawn` behaviour is inserted here) 0, sun 1, far ridge 2, arch 3, light
// ridge 4, card 5, copy and scroll cue 6. Every moving layer has a wrapper
// for the scroll layer (`*par`, moved by the behaviour) and an inner element
// for the CSS intro, so the two never fight over one transform.
//
// Colours are tones (sections/tones.ts): the built-in shades are the
// fallbacks below, an owner colour moves its whole group through inline
// variables. Every animation sits behind the motion gate G: without it the
// hero is at rest and complete.

import { G, G_RTL, minifyCss } from './base.css';
import { HD_PREFIX, HD_TONES } from '../sections/dawnTones';
import { toneRef } from '../sections/tones';

export { HD_GROUPS, HD_PREFIX, HD_TONES } from '../sections/dawnTones';

/** Shade reference for the stylesheet and for inline SVG stops. */
export const hdTone = (name: string, alpha = 1): string => toneRef(HD_PREFIX, HD_TONES, name, alpha);
const t = hdTone;

const R = '.store-root';
const RTL = '.store-root[dir="rtl"]';

// The rays layer: clear inside the disc (radius 28.2 % of the box), full
// strength just outside it, fading out towards the tips (92.8 %).
const RAY_MASK =
  'radial-gradient(circle closest-side,transparent 56.4%,#000 56.4%,#000 57.54%,rgba(0,0,0,.651) 74.24%,rgba(0,0,0,.227) 87.23%,transparent 92.8%)';
const BEAM_MASK = 'radial-gradient(circle closest-side,transparent 30%,#000 42%,rgba(0,0,0,.5) 70%,transparent 100%)';
const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 .6 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

const ROOT = `
.cx-hd{--cx-hd-dir:1;--cx-hd-ease:cubic-bezier(.16,1,.3,1);--cx-hd-wipe:cubic-bezier(.77,0,.18,1);--cx-hd-hdr2:var(--cx-hd-hdr,var(--store-header-h,0px));--cx-hd-aw:clamp(260px,min(30vw,56svh),450px);--cx-hd-cw:calc(var(--cx-hd-aw) * .4);--cx-hd-dayh:clamp(56px,8vw,124px);--cx-hd-pad:clamp(20px,5vw,64px);--cx-hd-gx:69%;--cx-hd-gy:calc(100% - var(--cx-hd-aw) * .86);--cx-hd-gr:calc(var(--cx-hd-aw) * 1.7);position:relative;box-sizing:border-box;display:grid;align-items:center;min-height:clamp(600px,calc(100svh - var(--cx-hd-top,0px)),1100px);overflow:hidden;isolation:isolate;background:${t('ink')};color:${t('cream')};font-family:var(--theme-font-body);-webkit-font-smoothing:antialiased}
.cx-hd[data-cx-height="compact"]{min-height:clamp(540px,calc(76svh - var(--cx-hd-top,0px)),900px)}
${RTL} .cx-hd{--cx-hd-dir:-1;--cx-hd-gx:31%}
.cx-hd *,.cx-hd *::before,.cx-hd *::after{box-sizing:border-box}
.cx-hd :where(p,h1,h2,h3,h4,h5,h6){margin:0}
.cx-hd svg{display:block;overflow:visible}
${R} .cx-hd :where(span){font:inherit;color:inherit;letter-spacing:inherit}
`;

const SKY = `
.cx-hd-sky{position:absolute;inset:0;z-index:0;pointer-events:none;background:linear-gradient(180deg,${t('sky0')} 0%,${t('sky1')} 42%,${t('sky2')} 74%,${t('sky3')} 100%)}
.cx-hd-glow,.cx-hd-warm,.cx-hd-grain,.cx-hd-scrim,.cx-hd-gl{position:absolute;inset:0}
.cx-hd-glow{background:radial-gradient(circle var(--cx-hd-gr) at var(--cx-hd-gx) var(--cx-hd-gy),${t('glow', 0.34)} 0%,${t('copper', 0.16)} 34%,${t('red', 0.1)} 56%,${t('red', 0)} 100%);transform-origin:var(--cx-hd-gx) var(--cx-hd-gy)}
.cx-hd-warm{opacity:0;background:radial-gradient(circle calc(var(--cx-hd-gr) * 1.25) at var(--cx-hd-gx) var(--cx-hd-gy),${t('warmlt', 0.3)} 0%,${t('red', 0.22)} 45%,${t('red', 0)} 100%),linear-gradient(180deg,${t('red', 0)} 40%,${t('red', 0.14)} 100%)}
.cx-hd-gl{width:100%;height:100%;display:block;opacity:0;transition:opacity 1.2s ease}
.cx-hd-gl[data-on]{opacity:1}
.cx-hd[data-cx-gl] .cx-hd-warm{display:none}
.cx-hd-scrim{background:linear-gradient(180deg,${t('scrim', 0.5)} 0,${t('scrim', 0)} calc(var(--cx-hd-hdr2) + 90px)),linear-gradient(90deg,${t('scrim', 0.62)} 0%,${t('scrim', 0.38)} 30%,${t('scrim', 0)} 52%)}
${RTL} .cx-hd-scrim{background:linear-gradient(180deg,${t('scrim', 0.5)} 0,${t('scrim', 0)} calc(var(--cx-hd-hdr2) + 90px)),linear-gradient(270deg,${t('scrim', 0.62)} 0%,${t('scrim', 0.38)} 30%,${t('scrim', 0)} 52%)}
.cx-hd-grain{opacity:.06;background-image:${GRAIN}}
`;

const VISUAL = `
.cx-hd-vis{position:absolute;top:0;bottom:0;inset-inline-start:38%;inset-inline-end:0}
.cx-hd-sunpar{position:absolute;z-index:1;left:50%;bottom:calc(var(--cx-hd-aw) * -.105);width:calc(var(--cx-hd-aw) * 1.93);height:calc(var(--cx-hd-aw) * 1.93);margin-left:calc(var(--cx-hd-aw) * -.965);pointer-events:none}
.cx-hd-sun{position:absolute;inset:0}
.cx-hd-halo{position:absolute;inset:14%;border-radius:50%;background:radial-gradient(circle closest-side,${t('halo', 0.34)} 0%,${t('halo2', 0.16)} 50%,${t('red', 0.06)} 78%,${t('red', 0)} 100%)}
.cx-hd-raysturn,.cx-hd-spin{position:absolute;inset:0}
.cx-hd-rays,.cx-hd-disc,.cx-hd-front,.cx-hd-art{position:absolute;inset:0;width:100%;height:100%}
.cx-hd-rays{opacity:.9;-webkit-mask:${RAY_MASK};mask:${RAY_MASK}}
.cx-hd-front{opacity:0}
.cx-hd-beams{position:absolute;inset:-22%;border-radius:50%;pointer-events:none;background:repeating-conic-gradient(from 0deg,${t('beam', 0)} 0deg,${t('beam', 0.16)} 5deg,${t('beam', 0)} 11deg,${t('beam', 0)} 17deg);-webkit-mask:${BEAM_MASK};mask:${BEAM_MASK};filter:blur(6px);mix-blend-mode:screen;opacity:.8}
.cx-hd-archpar{position:absolute;z-index:3;left:50%;bottom:0;width:var(--cx-hd-aw);height:calc(var(--cx-hd-aw) * 1.36);margin-left:calc(var(--cx-hd-aw) / -2)}
.cx-hd-arch{position:absolute;inset:0;overflow:hidden;border-radius:calc(var(--cx-hd-aw) / 2) calc(var(--cx-hd-aw) / 2) 0 0;background:${t('archbg')}}
.cx-hd-arch::after{content:"";position:absolute;inset:0;pointer-events:none;background:radial-gradient(120% 60% at 50% 0%,${t('archlt', 0.1)},${t('archlt', 0)} 60%),linear-gradient(180deg,${t('ink', 0)} 64%,${t('ink', 0.55)} 84%,${t('ink')} 100%)}
.cx-hd-archzoom,.cx-hd-img{position:absolute;inset:0}
.cx-hd-img{transform-origin:50% 40%}
.cx-hd-cardpar{position:absolute;z-index:5;inset-inline-start:calc(50% - var(--cx-hd-aw) * .5 - var(--cx-hd-cw) * .6);bottom:calc(var(--cx-hd-aw) * .24);width:var(--cx-hd-cw);aspect-ratio:4/5}
.cx-hd-card{position:absolute;inset:0;filter:drop-shadow(0 26px 30px rgba(0,0,0,.6)) drop-shadow(0 0 22px rgba(120,40,20,.25))}
.cx-hd-cardclip{position:absolute;inset:0;overflow:hidden;border-radius:2px;isolation:isolate;background:${t('cardbg')}}
.cx-hd-cardimg{position:absolute;inset:0;filter:sepia(.3) saturate(1.05) contrast(1.12) brightness(.8)}
.cx-hd-tone{position:absolute;inset:0;mix-blend-mode:multiply;background:radial-gradient(90% 70% at 54% 42%,rgba(255,228,196,1) 12%,rgba(118,62,42,1) 100%),linear-gradient(180deg,#C8906A 0%,#7A3E2B 100%)}
.cx-hd-sheen{position:absolute;inset:0;mix-blend-mode:screen;opacity:.55;background:linear-gradient(calc(90deg * var(--cx-hd-dir)),rgba(240,170,100,0) 45%,rgba(240,170,100,.32) 100%)}
.cx-hd-card::after{content:"";position:absolute;inset:-7px;pointer-events:none;border:1px solid ${t('gold', 0.7)};border-radius:3px}
`;

const RIDGES = `
.cx-hd-ridgepar{position:absolute;z-index:2;left:0;right:0;bottom:0;height:clamp(110px,25%,270px);pointer-events:none}
.cx-hd-ridgewrap{position:absolute;inset:0}
.cx-hd-ridge,.cx-hd-ridgeline{position:absolute;inset:0;width:100%;height:100%}
.cx-hd-ridge path{fill:${t('ink')}}
.cx-hd-ridgeline path{fill:none;stroke:${t('gold', 0.75)};stroke-width:1;stroke-linejoin:round;stroke-linecap:round}
.cx-hd-daypar{position:absolute;z-index:4;left:0;right:0;bottom:-1px;height:var(--cx-hd-dayh);pointer-events:none}
.cx-hd-day{width:100%;height:100%}
.cx-hd-day path{fill:${t('cream')}}
`;

const COPY = `
.cx-hd-inner{position:relative;z-index:6;width:100%;max-width:1280px;margin-inline:auto;padding:calc(var(--cx-hd-hdr2) + 88px) var(--cx-hd-pad) calc(var(--cx-hd-dayh) + 56px)}
.cx-hd-copy{max-width:min(42vw,560px)}
${R} .cx-hd-eb{display:flex;align-items:center;gap:14px;font-family:var(--theme-font-body);font-size:12px;font-weight:600;letter-spacing:.24em;text-transform:uppercase;color:${t('gold')}}
${R} .cx-hd-ebt[data-cx-script="arabic"]{letter-spacing:.02em;font-size:14px}
.cx-hd-rule{display:block;width:40px;height:1px;background:currentColor;transform-origin:left center}
${RTL} .cx-hd-rule{transform-origin:right center}
${R} .cx-hd-title{margin-top:24px;font-family:var(--theme-font-heading);font-weight:400;font-size:clamp(38px,3.9vw,58px);line-height:1.08;letter-spacing:-.012em;color:${t('cream')}}
.cx-hd-line{display:block;overflow:hidden;padding-bottom:.1em;margin-bottom:-.1em}
.cx-hd-line>span{display:inline-block}
${R} .cx-hd-line2{color:${t('gold')}}
${R} .cx-hd-ht[data-cx-script="arabic"]{font-weight:600;font-size:.9em;line-height:1.5;letter-spacing:0}
.cx-hd-ht[data-cx-script="arabic"] .cx-hd-line{padding-block:.06em .14em;margin-bottom:-.12em}
${R} .cx-hd-lead{margin-top:26px;max-width:30em;font-family:var(--theme-font-body);font-size:16.5px;line-height:1.65;color:${t('cream', 0.76)}}
${R} .cx-hd-leadt[data-cx-script="arabic"]{font-size:16px;line-height:1.9}
.cx-hd-actions{display:flex;flex-wrap:wrap;align-items:center;gap:18px 30px;margin-top:38px}
${R} .cx-hd-btn,${R} .cx-hd-link{position:relative;display:inline-flex;align-items:center;gap:12px;font-family:var(--theme-font-body);font-size:14px;font-weight:600;letter-spacing:.02em;text-decoration:none;-webkit-tap-highlight-color:transparent}
${R} .cx-hd-btn{height:52px;padding:0 24px 0 26px;overflow:hidden;border-radius:var(--theme-radius-button,4px);background:${t('red')};color:#fff}
.cx-hd-btnfill{position:absolute;inset:0;background:${t('redd')};transform:scaleX(0);transform-origin:left center;transition:transform .7s var(--cx-hd-ease)}
${RTL} .cx-hd-btnfill{transform-origin:right center}
.cx-hd-btntext,.cx-hd-btn .cx-hd-arrow{position:relative}
.cx-hd-btn:hover .cx-hd-btnfill,.cx-hd-btn:focus-visible .cx-hd-btnfill{transform:scaleX(1)}
${R} .cx-hd-link{height:52px;color:${t('cream')}}
.cx-hd-link::after{content:"";position:absolute;left:0;right:0;bottom:14px;height:1px;background:${t('cream', 0.35)};transform-origin:right center;transition:transform .6s var(--cx-hd-ease),background-color .3s}
${R} .cx-hd-link:hover{color:#fff}
.cx-hd-link:hover::after{background:${t('gold')}}
.cx-hd-arrow{width:18px;height:18px;flex:none;fill:none;stroke:currentColor;stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round;transition:transform .5s var(--cx-hd-ease)}
${RTL} .cx-hd-arrow{transform:scaleX(-1)}
.cx-hd-btn:hover .cx-hd-arrow,.cx-hd-link:hover .cx-hd-arrow{transform:translateX(4px)}
${RTL} .cx-hd-btn:hover .cx-hd-arrow,${RTL} .cx-hd-link:hover .cx-hd-arrow{transform:scaleX(-1) translateX(4px)}
.cx-hd-btn:focus-visible,.cx-hd-link:focus-visible{outline:2px solid ${t('gold')};outline-offset:4px}
${R} .cx-hd-btn [data-cx-script="arabic"],${R} .cx-hd-link [data-cx-script="arabic"]{letter-spacing:0;font-size:15px}
.cx-hd-cue{position:absolute;z-index:6;inset-inline-start:max(var(--cx-hd-pad),calc((100% - 1280px) / 2 + var(--cx-hd-pad)));bottom:calc(var(--cx-hd-dayh) + 22px);display:flex;align-items:center;gap:14px;font-size:10.5px;font-weight:500;letter-spacing:.26em;text-transform:uppercase;color:${t('cream', 0.55)};pointer-events:none}
${R} .cx-hd-cuet[data-cx-script="arabic"]{letter-spacing:0;font-size:12px}
.cx-hd-cueline{position:relative;display:block;width:1px;height:46px;overflow:hidden;background:${t('cream', 0.18)}}
.cx-hd-cuedot{position:absolute;left:0;top:0;width:1px;height:16px;background:${t('gold')};transform:translateY(15px)}
`;

// Phone and small tablet: one centred poster. Sun, arch and card on top, the
// headline overlaps the dark foot of the arch, the light ridge closes the
// first screen.
const PHONE = `
@media (max-width:899px){
.cx-hd,.cx-hd[data-cx-height]{--cx-hd-cw:calc(var(--cx-hd-aw) * .46);--cx-hd-dayh:46px;--cx-hd-aw:min(46vw,220px);--cx-hd-vis:calc(var(--cx-hd-aw) * 1.78);--cx-hd-gx:50%;--cx-hd-gy:calc(var(--cx-hd-hdr2) + var(--cx-hd-aw) * .62);--cx-hd-gr:calc(var(--cx-hd-aw) * 1.5);display:block;min-height:0;padding-top:var(--cx-hd-hdr2)}
${RTL} .cx-hd{--cx-hd-gx:50%}
.cx-hd-scrim,${RTL} .cx-hd-scrim{background:linear-gradient(180deg,${t('scrim', 0.5)} 0,${t('scrim', 0)} calc(var(--cx-hd-hdr2) + 70px)),linear-gradient(0deg,${t('scrim2', 0.9)} 0%,${t('scrim2', 0.72)} 38%,${t('scrim2', 0)} 60%)}
.cx-hd-vis{position:relative;inset:auto;height:var(--cx-hd-vis)}
.cx-hd-archpar{clip-path:inset(-50vh -50vw 0 -50vw)}
.cx-hd-cardpar{bottom:calc(var(--cx-hd-aw) * .2);inset-inline-start:calc(50% - var(--cx-hd-aw) * .5 - var(--cx-hd-cw) * .55)}
.cx-hd-card::after{inset:-5px}
.cx-hd-ridgepar{top:calc(var(--cx-hd-hdr2) + var(--cx-hd-vis) - var(--cx-hd-aw) * .46);bottom:0;height:auto}
.cx-hd-ridgewrap{inset:0 0 auto;height:calc(var(--cx-hd-aw) * .5)}
.cx-hd-ridgewrap::after{content:"";position:absolute;left:0;right:0;top:calc(100% - 1px);height:100vh;background:linear-gradient(180deg,${t('ink')},${t('ground')})}
.cx-hd-inner{margin-top:14px;padding:0 20px calc(var(--cx-hd-dayh) + 18px)}
.cx-hd-copy{max-width:30rem;margin-inline:auto;text-align:center}
${R} .cx-hd-eb{justify-content:center}
${R} .cx-hd-title{margin-top:14px;font-size:clamp(31px,8.4vw,42px)}
${R} .cx-hd-lead{margin:14px auto 0;font-size:15px;line-height:1.6;max-width:26em}
${R} .cx-hd-leadt[data-cx-script="arabic"]{font-size:14.5px;line-height:1.8}
.cx-hd-actions{justify-content:center;margin-top:22px;gap:10px 24px}
${R} .cx-hd-btn,${R} .cx-hd-link{height:50px}
.cx-hd-cue{display:none}
}
`;

// Intro (seconds): dawn light 0 (2.8 s), sun rises 0 (3.4 s), disc .05,
// rays open .2, far ridge .1 and its line .45, light ridge .2, eyebrow .6,
// rule .7, heading lines .74 / .88, text 1.08, buttons 1.2 / 1.32, arch and
// photo 1.3, the emblem detail fades 1.7, card 2.1 (frame 2.8), cue 2.6.
// Loops: the ray crown turns once in 240 s, the beams in 160 s, the halo
// breathes over 6 s. The intro holds its first frame while the section is
// data-cx-wait (base.css.ts): until the arch photo has loaded, and until it
// is seen when it starts below the first screen.
const MOTION = `
@keyframes cx-hd-dawn{from{opacity:0;transform:scale(.82)}to{opacity:1;transform:none}}
@keyframes cx-hd-sunrise{from{transform:translate3d(0,46%,0)}to{transform:translate3d(0,0,0)}}
@keyframes cx-hd-rays{from{opacity:0;transform:rotate(calc(-22deg * var(--cx-hd-dir))) scale(.78)}to{opacity:.9;transform:rotate(0deg) scale(1)}}
@keyframes cx-hd-disc{from{opacity:0;transform:scale(.92)}to{opacity:1;transform:scale(1)}}
@keyframes cx-hd-front{from{opacity:1}to{opacity:0}}
@keyframes cx-hd-spin{to{transform:rotate(360deg)}}
@keyframes cx-hd-spinr{to{transform:rotate(-360deg)}}
@keyframes cx-hd-breathe{from{opacity:1;transform:none}to{opacity:.7;transform:scale(1.04)}}
@keyframes cx-hd-ridge{from{transform:translateY(22%)}to{transform:none}}
@keyframes cx-hd-wipe{from{clip-path:inset(-10px 100% -10px 0)}to{clip-path:inset(-10px 0 -10px 0)}}
@keyframes cx-hd-wipe-rtl{from{clip-path:inset(-10px 0 -10px 100%)}to{clip-path:inset(-10px 0 -10px 0)}}
@keyframes cx-hd-arch{from{transform:translateY(104%)}to{transform:none}}
@keyframes cx-hd-img{from{transform:translateY(-34%) scale(1.18)}to{transform:none}}
@keyframes cx-hd-fade{from{opacity:0}to{opacity:1}}
@keyframes cx-hd-frame{from{opacity:0;transform:scale(.94)}to{opacity:1;transform:none}}
@keyframes cx-hd-card{from{opacity:0;transform:translate3d(0,44px,0)}to{opacity:1;transform:translate3d(0,0,0)}}
@keyframes cx-hd-cardimg{from{clip-path:inset(100% 0 0 0);transform:scale(1.2)}to{clip-path:inset(0 0 0 0);transform:none}}
@keyframes cx-hd-day{from{transform:translateY(75%)}to{transform:none}}
@keyframes cx-hd-up{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:none}}
@keyframes cx-hd-rule{from{transform:scaleX(0)}to{transform:none}}
@keyframes cx-hd-line{from{transform:translateY(112%)}to{transform:none}}
@keyframes cx-hd-cue{0%{transform:translateY(-16px)}70%,100%{transform:translateY(46px)}}
${G} .cx-hd-glow{animation:cx-hd-dawn 2.8s cubic-bezier(.33,1,.68,1) both}
${G} .cx-hd-sun{animation:cx-hd-sunrise 3.4s cubic-bezier(.22,.8,.2,1) 0s both;will-change:transform}
${G} .cx-hd-rays{animation:cx-hd-rays 3.2s cubic-bezier(.22,.8,.2,1) .2s both;will-change:transform,opacity;transform-origin:50% 50%}
${G} .cx-hd-disc{animation:cx-hd-disc 2.6s cubic-bezier(.22,.8,.2,1) .05s both;will-change:transform,opacity}
${G} .cx-hd-front{animation:cx-hd-front 1.4s ease-in-out 1.7s both}
${G} .cx-hd-spin{animation:cx-hd-spin 240s linear 3.4s infinite;will-change:transform}
${G} .cx-hd-halo{animation:cx-hd-breathe 6s ease-in-out 3s infinite alternate}
${G} .cx-hd-beams{animation:cx-hd-fade 2.4s ease .6s both,cx-hd-spinr 160s linear infinite}
${G} .cx-hd-ridgewrap{animation:cx-hd-ridge 1.8s var(--cx-hd-ease) .1s both}
${G} .cx-hd-ridgeline{animation:cx-hd-wipe 2.2s cubic-bezier(.65,0,.35,1) .45s both}
${G_RTL} .cx-hd-ridgeline{animation-name:cx-hd-wipe-rtl}
${G} .cx-hd-arch{animation:cx-hd-arch 2.2s cubic-bezier(.22,.8,.2,1) 1.3s both;will-change:transform}
${G} .cx-hd-img{animation:cx-hd-img 2.6s cubic-bezier(.22,.8,.2,1) 1.3s both;will-change:transform}
${G} .cx-hd-card{animation:cx-hd-card 1.8s cubic-bezier(.22,.8,.2,1) 2.1s both;will-change:transform,opacity}
${G} .cx-hd-cardclip{animation:cx-hd-cardimg 1.5s var(--cx-hd-wipe) 2.1s both}
${G} .cx-hd-card::after{animation:cx-hd-frame 1.4s var(--cx-hd-ease) 2.8s both}
${G} .cx-hd-day{animation:cx-hd-day 1.9s var(--cx-hd-ease) .2s both;transform-origin:50% 100%}
${G} .cx-hd-eb{animation:cx-hd-up 1.2s var(--cx-hd-ease) .6s both}
${G} .cx-hd-rule{animation:cx-hd-rule 1.3s var(--cx-hd-ease) .7s both}
${G} .cx-hd-l1{animation:cx-hd-line 1.4s var(--cx-hd-ease) .74s both}
${G} .cx-hd-l2{animation:cx-hd-line 1.4s var(--cx-hd-ease) .88s both}
${G} .cx-hd-lead{animation:cx-hd-up 1.3s var(--cx-hd-ease) 1.08s both}
${G} .cx-hd-btn{animation:cx-hd-up 1.3s var(--cx-hd-ease) 1.2s both}
${G} .cx-hd-link{animation:cx-hd-up 1.3s var(--cx-hd-ease) 1.32s both}
${G} .cx-hd-cue{animation:cx-hd-fade 1.2s ease 2.6s both}
${G} .cx-hd-cuedot{animation:cx-hd-cue 2.4s cubic-bezier(.65,0,.35,1) 3s infinite}
`;

export const HERO_DAWN_CSS: string = minifyCss(ROOT + SKY + VISUAL + RIDGES + COPY + PHONE + MOTION);
