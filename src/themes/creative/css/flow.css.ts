// Motion stylesheet slot of builder S8 (cart, checkout and account pages). Rendered by the store layout
// only for a store that switched its motion style on (css/sections.css.ts).
//
// Rules of the house (see css/base.css.ts): every rule that hides, moves or
// animates starts with the gate G (or G_RTL); hover rules also sit inside
// the fine-pointer query; logical properties only; `translate` / `scale`
// instead of `transform` on elements that already carry a transform.

import { minifyCss } from './base.css';

export const FLOW_CSS: string = minifyCss(`
`);
