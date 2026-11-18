// Motion stylesheet slot of builder S8 (cart, checkout and account pages). Rendered by the store layout
// only for a store that switched its motion style on (css/sections.css.ts).
//
// Rules of the house (see css/base.css.ts): every rule that hides, moves or
// animates starts with the gate G (or G_RTL); hover rules also sit inside
// the fine-pointer query; logical properties only; `translate` / `scale`
// instead of `transform` on elements that already carry a transform.
//
// Flow pages are commerce: nothing here delays a control. Entrances are the
// base intro recipes with the fast timing of the surface (0.6 s, 14 px);
// this file only adds the feedback of the cart and of the confirmation.
// - A removed cart line closes (height and opacity, 0.25 s) before it leaves.
// - A changed quantity fades its new number in (0.2 s). Totals never animate.
// - The check mark of a placed order draws once (0.6 s in all).
// - Pressed buttons keep their own colour and opacity transitions.

import { G, minifyCss } from './base.css';

/** Surfaces of the flow pages (components/cart/FlowMotion.tsx, the route layouts). */
const FLOW = ':is([data-cx-section="cart"],[data-cx-section="checkout"],[data-cx-section="account"],[data-cx-section="auth"],[data-cx-section="legal"])';

export const FLOW_CSS: string = minifyCss(`
.store-root [data-cx-swap]{display:inline-block;font:inherit;color:inherit;letter-spacing:inherit}
@keyframes cx-flow-swap{from{opacity:0}to{opacity:1}}
@keyframes cx-flow-draw{from{stroke-dashoffset:var(--cx-len)}to{stroke-dashoffset:0}}
${G} [data-cx-swap]{animation:cx-flow-swap .2s ease both}
${G} [data-cx-leave][data-cx-leave][data-cx-leave]{block-size:0!important;min-block-size:0;padding-block:0;border-block-width:0;opacity:0;overflow:clip;pointer-events:none;transition:block-size .25s var(--cx-ease-io),padding-block .25s var(--cx-ease-io),border-width .25s var(--cx-ease-io),opacity .2s ease}
${G} [data-cx-flow="check"] circle{--cx-len:63;stroke-dasharray:63;animation:cx-flow-draw .45s var(--cx-ease-io) both}
${G} [data-cx-flow="check"] path{--cx-len:9;stroke-dasharray:9;animation:cx-flow-draw .3s var(--cx-ease-io) .3s both}
${G} ${FLOW} [data-cx-hover="press"]{transition:scale .2s ease,opacity .2s ease,background-color .25s ease,border-color .25s ease,color .25s ease}
${G} ${FLOW} [data-cx-hover="press"]:disabled{scale:none}
@media print{[data-cx-swap],[data-cx-flow="check"] *{animation:none!important;stroke-dasharray:none!important}}
`);
