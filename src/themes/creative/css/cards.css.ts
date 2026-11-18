// Motion stylesheet slot of builder S2 (product cards and product rows). Rendered by the store layout
// only for a store that switched its motion style on (css/sections.css.ts).
//
// Rules of the house (see css/base.css.ts): every rule that hides, moves or
// animates starts with the gate G (or G_RTL); hover rules also sit inside
// the fine-pointer query; logical properties only; `translate` / `scale`
// instead of `transform` on elements that already carry a transform.
//
// What lives here:
// - product-slider: the row is ONE reveal (data-cx-reveal="slides"). A slide
//   outside the visible part of the track would otherwise wait for its own
//   observer and pop in late while the visitor swipes; here every slide
//   cascades once when the row enters, the first six in sequence.
// - "load more": appended cards (data-cx-more) rise once on mount; on a
//   phone the wave is capped at two steps (two columns).
// - the "view all" link of a product row: its chevron leans 3 px with the
//   underline sweep.

import { G, G_RTL, minifyCss } from './base.css';

const FINE = '@media (hover:hover) and (pointer:fine)';
const SLIDES = '[data-cx-reveal="slides"]';

export const CARDS_CSS: string = minifyCss(`
${G} ${SLIDES}[data-cx-state="pending"] [data-cx-slide]{opacity:0;translate:0 var(--cx-dist)}
${G} ${SLIDES}[data-cx-state="shown"] [data-cx-slide]{transition:opacity var(--cx-dur) var(--cx-ease),translate var(--cx-dur) var(--cx-ease);transition-delay:calc(var(--cx-i,0) * var(--cx-stagger))}
${G} ${SLIDES} [aria-roledescription="carousel"]>button:active{scale:.97}
${G} [data-cx-hover="press"][data-cx-more-btn]{transition:scale .2s ease,border-color .25s ease,box-shadow .25s ease}
@media (max-width:767px){
${G} ${SLIDES}[data-cx-state="shown"] [data-cx-slide]{transition-delay:calc(min(var(--cx-i,0),1) * var(--cx-stagger))}
${G} [data-cx-more][data-cx-intro="rise"]{animation-delay:calc(min(var(--cx-i,0),1) * var(--cx-stagger))}
}
${FINE}{
${G} [data-cx-hover="underline"][data-cx-arrow]>svg{transition:translate .5s var(--cx-ease)}
${G} [data-cx-hover="underline"][data-cx-arrow]:is(:hover,:focus-visible)>svg{translate:3px 0}
${G_RTL} [data-cx-hover="underline"][data-cx-arrow]:is(:hover,:focus-visible)>svg{translate:-3px 0}
}
@media print{${SLIDES} [data-cx-slide],[data-cx-more]{opacity:1!important;translate:none!important;transition:none!important;animation:none!important}}
`);
