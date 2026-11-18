// Motion stylesheet slot of builder S7 (page level: curtain, scroll progress, cursor). Rendered by the store layout
// only for a store that switched its motion style on (css/sections.css.ts).
//
// Rules of the house (see css/base.css.ts): every rule that hides, moves or
// animates starts with the gate G (or G_RTL); hover rules also sit inside
// the fine-pointer query; logical properties only; `translate` / `scale`
// instead of `transform` on elements that already carry a transform.
//
// The curtain, the progress bar and the cursor dot are created by their
// runtime modules on <body> and styled inline there (they exist only while
// motion is allowed), so this slot holds the page-level guards only.

import { G, minifyCss } from './base.css';

// Keyboard first: an element that receives focus while its entrance is
// still pending (Tab into a block below the fold) is shown at once, whole
// and in place, instead of fading in under the focus ring.
const FOCUS = `
${G} [data-cx-reveal][data-cx-reveal][data-cx-state="pending"][data-cx-state]:focus-within{opacity:1;transform:none;clip-path:none}
${G} [data-cx-reveal][data-cx-reveal][data-cx-state="pending"][data-cx-state]:focus-within :is(.cx-wi,.cx-mask-in){transform:none}
${G} .cx-mask:has(:focus-visible){overflow-clip-margin:6px}
`;

// While the page glides, an embedded frame under the pointer would swallow
// the wheel and stop the glide half way (Lenis sets the class on <html>).
const SMOOTH = `
html[data-cx-motion].lenis-smooth .store-root iframe{pointer-events:none}
`;

const PRINT = `
@media print{[data-cx-curtain],[data-cx-progress],[data-cx-cursor-dot]{display:none!important}}
`;

export const PAGE_CSS: string = minifyCss(FOCUS + SMOOTH + PRINT);
