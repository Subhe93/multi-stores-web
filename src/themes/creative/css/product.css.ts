// Motion stylesheet slot of builder S5 (product page). Rendered by the store layout
// only for a store that switched its motion style on (css/sections.css.ts).
//
// Rules of the house (see css/base.css.ts): every rule that hides, moves or
// animates starts with the gate G (or G_RTL); hover rules also sit inside
// the fine-pointer query; logical properties only; `translate` / `scale`
// instead of `transform` on elements that already carry a transform.
//
// Commerce rule of this slot: the title, the price, the stock message, the
// buy button and errors are never transparent, clipped or delayed. What
// moves here is feedback on a control the shopper just used (0.2-0.45 s).
// The hooks are `data-cx-pd` attributes written by
// components/product/productMotion.tsx, only with the store motion style on.

import { G, G_RTL, minifyCss } from './base.css';

// The product lightbox is portalled to <body>, outside `.store-root`: the
// same gate expressed from the document root (no JavaScript, reduced motion,
// store motion "off" and the builder preview leave it as it is today). The
// motion tokens live on `.store-root`, so the curve is written out here.
const LIGHTBOX =
  'html[data-cx-motion]:has(.store-root:not([data-motion-reveal="off"]):not([data-cx-builder])) [data-cx-pd="lightbox"]';

// Controls keep their own colour transitions next to the press response
// (the plain `press` recipe would replace the whole transition list). OWN
// lifts these rules above the generic button rules of the other slots.
const OWN = ':not(.cx-btn):not([hidden])';
const CONTROLS = `
${G} button[data-cx-pd="chip"][data-cx-hover="press"]${OWN}{transition:scale .2s ease,transform .2s ease,background-color .25s ease,color .25s ease,border-color .25s ease,box-shadow .25s ease,opacity .25s ease}
${G} button[data-cx-pd="step"][data-cx-hover="press"]${OWN}{transition:scale .2s ease,background-color .25s ease,color .25s ease}
${G} button[data-cx-pd="buy"][data-cx-hover="press"]${OWN}{transition:scale .2s ease,transform .3s ease,background-color .25s ease,color .25s ease,border-color .25s ease,box-shadow .3s ease,opacity .25s ease}
${G} [data-cx-pd][data-cx-hover="press"]:disabled:active{scale:none}
`;

// Add to cart feedback: the "added" label fades in over 0.25 s while its
// check mark draws from the short stroke (0.45 s after 0.1 s): 0.55 s in
// all, driven by the state the button already has.
const ADDED = `
@keyframes cx-pd-check{from{stroke-dashoffset:-23}to{stroke-dashoffset:0}}
${G} [data-cx-pd="added"]{animation:cx-fade .25s ease both}
${G} [data-cx-pd="added"]>svg{stroke-dasharray:23;animation:cx-pd-check .45s var(--cx-ease-io) .1s both}
`;

// Gallery: thumbnails of a scrolling strip enter by opacity only (a rise
// would overflow the strip), and the incoming main image waits (transparent,
// over the outgoing one) until it has loaded, then fades in. Never on the
// first image.
const GALLERY = `
${G} [data-cx-pd="thumbs"] [data-cx-reveal="rise"][data-cx-state="pending"]{transform:none}
${G} [data-cx-pd="wait"]{opacity:0}
${G} [data-cx-pd="in"]{animation:cx-fade .35s ease both}
`;

// Tabs: the panel content of a tab the shopper picked fades in with a short
// rise and the marker under the tab draws from the inline start. The tab
// shown on load does not animate.
const TABS = `
@keyframes cx-pd-panel{from{opacity:0;translate:0 6px}to{opacity:1;translate:0 0}}
${G} [data-cx-pd="panel"]>*{animation:cx-pd-panel .35s var(--cx-ease) both}
${G} [data-cx-pd="tab-line"]{transform-origin:0 50%;animation:cx-rule .35s var(--cx-ease) both}
${G_RTL} [data-cx-pd="tab-line"]{transform-origin:100% 50%}
`;

// Accordions: height and opacity over 0.35 s where the browser can
// interpolate to the content height; elsewhere they open as today.
// "details" = native <details> rows (FAQ panel of the tabs), "acc" = the
// product FAQ block (buttons with regions that carry `hidden`).
const ACCORDION = `
${G} [data-cx-pd="details"] details{interpolate-size:allow-keywords}
${G} [data-cx-pd="details"] details::details-content{block-size:0;opacity:0;overflow:clip;transition:block-size .35s var(--cx-ease),opacity .35s ease,content-visibility .35s allow-discrete}
${G} [data-cx-pd="details"] details[open]::details-content{block-size:auto;opacity:1}
${G} [data-cx-pd="acc"] [role="region"]{interpolate-size:allow-keywords;overflow:clip;transition:block-size .35s var(--cx-ease),padding-block .35s var(--cx-ease),opacity .35s ease,display .35s allow-discrete}
${G} [data-cx-pd="acc"] [role="region"][hidden]{block-size:0;padding-block:0;opacity:0}
@starting-style{${G} [data-cx-pd="acc"] [role="region"]:not([hidden]){block-size:0;padding-block:0;opacity:0}}
`;

// Lightbox: the backdrop fades in over 0.3 s and the image settles from
// 0.98 to 1 over 0.35 s (also when the shopper moves to the next image).
const LIGHTBOX_RULES = `
@keyframes cx-pd-zoom{from{scale:.98}to{scale:1}}
${LIGHTBOX}{animation:cx-fade .3s ease both}
${LIGHTBOX} :is(img[data-lightbox-full],[data-lightbox-placeholder],[data-cx-pd="lightbox-media"]){animation:cx-pd-zoom .35s cubic-bezier(.16,1,.3,1) both}
`;

export const PRODUCT_CSS: string = minifyCss(CONTROLS + ADDED + GALLERY + TABS + ACCORDION + LIGHTBOX_RULES);
