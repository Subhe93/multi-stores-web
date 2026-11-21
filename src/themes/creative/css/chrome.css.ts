// Motion stylesheet slot of builder S4 (header, menus, drawers, footer). Rendered by the store layout
// only for a store that switched its motion style on (css/sections.css.ts).
//
// Rules of the house (see css/base.css.ts): every rule that hides, moves or
// animates starts with the gate G (or G_RTL); hover rules also sit inside
// the fine-pointer query; logical properties only; `translate` / `scale`
// instead of `transform` on elements that already carry a transform.
//
// What lives here:
// - Navigation links: the underline sweep sits under the label (not under
//   the padded box) and replaces the grey hover tint.
// - Dropdown lists, mega panels, the language list: opacity + 8 px over
//   0.35 s on the expo curve, 0.2 s to close.
// - Mobile menu drawer and cart drawer: the panel slides from its inline
//   side over 0.6 s, the backdrop fades over 0.35 s, the rows rise with the
//   fast timing after the panel started; 0.35 s to close.
// - Country/region dialog: the list timing, outside `.store-root` (gate GB).
// - Announcement bar: 0.45 s cross-fade between messages.
//
// Open animations are keyframes with only a `from` and fill "backwards":
// once they end the element is back on its own styles, so the close is a
// plain transition from rest and nothing depends on a held end state.
//
// The cart drawer is portalled to <body>, outside `.store-root`: its rules
// use the gate GB (same conditions, read from the document) and fixed curve
// values, because the tokens are scoped to the store root. A browser
// without :has() keeps today's 0.3 s slide.

import { G, G_RTL, minifyCss } from './base.css';

const FINE = '@media (hover:hover) and (pointer:fine)';
/** The gate for store overlays that live outside `.store-root`. */
const GB =
  'html[data-cx-motion]:not(:has(.store-root[data-motion-reveal="off"],.store-root[data-cx-builder]))';
const EXPO = 'cubic-bezier(.16,1,.3,1)';
const IN_OUT = 'cubic-bezier(.65,0,.35,1)';

const KEYFRAMES = `
@keyframes cx-drawer-in{from{translate:var(--cx-drawer-from,-100%) 0}}
@keyframes cx-backdrop-in{from{opacity:0}}
@keyframes cx-menu-in{from{opacity:0;translate:0 8px}}
@keyframes cx-row-in{from{opacity:0;translate:0 14px}}
`;

const NAV = `
${FINE}{
${G} [data-cx-nav][data-cx-hover="underline"]{background-origin:content-box;background-position:100% calc(100% + 4px)}
${G} [data-cx-nav][data-cx-hover="underline"]:is(:hover,:focus-visible){background-position:0% calc(100% + 4px);background-color:transparent}
${G_RTL} [data-cx-nav][data-cx-hover="underline"]{background-position:0% calc(100% + 4px)}
${G_RTL} [data-cx-nav][data-cx-hover="underline"]:is(:hover,:focus-visible){background-position:100% calc(100% + 4px)}
${G} [data-cx-section="footer"] [data-cx-hover="underline"]{transition:background-size .5s var(--cx-ease),opacity .35s ease}
}
`;

const DROP_OPEN = [
  `${G} .group:hover>[data-cx-menu="drop"]`,
  `${G} .group:focus-within>[data-cx-menu="drop"]`,
  `${G} [data-cx-menu="drop"][data-cx-open]`,
].join(',');
const HOVER_OPEN = (tail = '') =>
  [
    `${G} .mega-menu-group:hover>[data-cx-menu="hover"]${tail}`,
    `${G} .mega-menu-group:focus-within>[data-cx-menu="hover"]${tail}`,
  ].join(',');

// Three kinds of panel:
//   drop  = shown through `display` (CSS-only dropdown, small JS dropdown)
//   mega / hover = shown through `visibility` (full-width panels; the panel
//           fades, its content rises, so the panel's top edge stays on the bar)
//   list  = mounted while open (language list)
const MENUS = `
${G} [data-cx-menu="drop"]{opacity:0;translate:0 8px;transition:opacity .2s ease,translate .2s ease,display .2s allow-discrete}
${DROP_OPEN}{opacity:1;translate:none;transition:opacity .35s var(--cx-ease),translate .35s var(--cx-ease),display .35s allow-discrete}
@starting-style{
${DROP_OPEN}{opacity:0;translate:0 8px}
}
${G} [data-cx-menu="mega"]{transition:opacity .2s ease,visibility 0s linear .2s}
${G} [data-cx-menu="mega"]>*{translate:0 8px;transition:translate .2s ease}
${G} [data-cx-menu="mega"][data-cx-open]{transition:opacity .35s var(--cx-ease),visibility 0s}
${G} [data-cx-menu="mega"][data-cx-open]>*{translate:none;transition:translate .35s var(--cx-ease)}
${G} [data-cx-menu="hover"]{transition:opacity .2s ease .12s,visibility 0s linear .32s}
${G} [data-cx-menu="hover"]>*{translate:0 8px;transition:translate .2s ease .12s}
${HOVER_OPEN()}{transition:opacity .35s var(--cx-ease),visibility 0s}
${HOVER_OPEN('>*')}{translate:none;transition:translate .35s var(--cx-ease)}
${G} [data-cx-menu="list"]{animation:cx-menu-in .35s var(--cx-ease) backwards}
${G} [data-cx-menu="list"][data-cx-closing]{animation:none;opacity:0;translate:0 8px;transition:opacity .2s ease,translate .2s ease;pointer-events:none}
`;

// Mobile menu drawer (inside the store root, at the inline start).
const DRAWER = `
${G} [data-cx-drawer="start"]{animation:cx-drawer-in .6s var(--cx-ease) backwards}
${G_RTL} [data-cx-drawer="start"]{--cx-drawer-from:100%}
${G} [data-cx-drawer="start"][data-cx-closing]{animation:none;translate:var(--cx-drawer-from,-100%) 0;transition:translate .35s var(--cx-ease-io);pointer-events:none}
${G} [data-cx-backdrop=""]{animation:cx-backdrop-in .35s ease backwards}
${G} [data-cx-backdrop=""][data-cx-closing]{animation:none;opacity:0;transition:opacity .35s ease;pointer-events:none}
`;

// Cart drawer (portalled to <body>, at the inline end). Only the lines
// cascade: the totals and the checkout button are there with the panel.
const rowDelays = [0.16, 0.2, 0.24]
  .map(
    (s, n) =>
      `${GB} [data-cx-drawer="cart"][data-cx-open] [data-cx-rows]>:nth-child(${n + 2}){animation-delay:${s.toFixed(2)}s}`,
  )
  .join('\n');
const CART = `
${GB} [data-cx-drawer="cart"]{--cx-drawer-from:100%;transition:translate .35s ${IN_OUT}}
${GB} [data-cx-drawer="cart"]:dir(rtl){--cx-drawer-from:-100%}
${GB} [data-cx-drawer="cart"][data-cx-open]{transition:none;animation:cx-drawer-in .6s ${EXPO} backwards}
${GB} [data-cx-backdrop="cart"]{transition:opacity .35s ease}
${GB} [data-cx-backdrop="cart"][data-cx-open]{animation:cx-backdrop-in .35s ease backwards}
${GB} [data-cx-drawer="cart"][data-cx-open] [data-cx-rows]>*{animation:cx-row-in .6s ${EXPO} .12s backwards}
${rowDelays}
${GB} [data-cx-drawer="cart"][data-cx-open] [data-cx-rows]>:nth-child(n+5){animation-delay:.28s}
`;

// Country/region dialog (portalled to <body>): the list timing of the
// menus above (0.35 s in on the expo curve, 0.2 s out), the backdrop fades.
const REGION = `
${GB} [data-cx-dialog="region"]{animation:cx-menu-in .35s ${EXPO} backwards}
${GB} [data-cx-dialog="region"][data-cx-closing]{animation:none;opacity:0;translate:0 8px;transition:opacity .2s ease,translate .2s ease}
${GB} [data-cx-backdrop="region"]{animation:cx-backdrop-in .35s ease backwards}
${GB} [data-cx-backdrop="region"][data-cx-closing]{animation:none;opacity:0;transition:opacity .2s ease}
`;

const ANNOUNCEMENT = `
${G} [data-cx-swap]{transition:opacity .45s ease}
`;

export const CHROME_CSS: string = minifyCss(KEYFRAMES + NAV + MENUS + DRAWER + CART + REGION + ANNOUNCEMENT);
