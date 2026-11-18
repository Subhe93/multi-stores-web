// Stylesheet of the motion recipes (recipes.ts), rendered once by the store
// layout and only for a store that switched its motion style on.
//
// Everything sits behind the gate G: no JavaScript, visitor reduced motion,
// store motion "off" and the builder preview give the plain store. Hover
// recipes also require a fine pointer, so touch screens never get a stuck
// hover state. `translate` and `scale` are used instead of `transform`, so a
// recipe never fights a transform the element already has.

import { G, G_RTL, minifyCss } from './base.css';

const FINE = '@media (hover:hover) and (pointer:fine)';

// data-cx-i="1..8" and data-cx-d="1..12" (tenths of a second) as variables:
// attributes only, so the helpers never have to merge an inline style.
const steps = Array.from({ length: 8 }, (_, n) => `[data-cx-i="${n + 1}"]{--cx-i:${n + 1}}`).join('\n');
const delays = Array.from({ length: 12 }, (_, n) => `[data-cx-d="${n + 1}"]{--cx-delay:${((n + 1) / 10).toFixed(1)}s}`).join(
  '\n',
);

const HOVER = `
${FINE}{
${G} [data-cx-hover="lift"]{transition:translate .5s var(--cx-ease),box-shadow .5s ease}
${G} [data-cx-hover="lift"]:hover{translate:0 -4px}
${G} [data-cx-hover="media"] :is(img,video){transition:scale 1.2s cubic-bezier(.2,0,0,1)}
${G} [data-cx-hover="media"]:hover :is(img,video),${G} a:hover [data-cx-hover="media"] :is(img,video),${G} a:focus-visible [data-cx-hover="media"] :is(img,video){scale:1.045}
${G} [data-cx-hover="underline"]{background-image:linear-gradient(currentColor,currentColor);background-repeat:no-repeat;background-size:0% 1px;background-position:100% 100%;transition:background-size .5s var(--cx-ease);text-decoration:none}
${G} [data-cx-hover="underline"]:hover,${G} [data-cx-hover="underline"]:focus-visible{background-size:100% 1px;background-position:0% 100%}
${G_RTL} [data-cx-hover="underline"]{background-position:0% 100%}
${G_RTL} [data-cx-hover="underline"]:hover,${G_RTL} [data-cx-hover="underline"]:focus-visible{background-position:100% 100%}
${G} [data-cx-magnetic]:not(.cx-btn){translate:var(--cx-mx,0px) var(--cx-my,0px);transition:translate .35s var(--cx-ease)}
}
${G} [data-cx-hover="press"]{transition:scale .2s ease}
${G} [data-cx-hover="press"]:active{scale:.97}
`;

// media-parallax: the layer is oversized so its travel never shows an edge.
// Same conditions as the scrub behaviour (768 px and up, not calm, not fast).
const PARALLAX = `
@media (min-width:768px){
html[data-cx-motion] .store-root:not([data-motion-reveal]):not([data-cx-builder]) [data-cx-behavior~="scrub"][data-cx-y]:not([data-cx-drift]){scale:1.14}
html[data-cx-motion] .store-root:not([data-motion-reveal]):not([data-cx-builder]) [data-cx-tier="fast"] [data-cx-behavior~="scrub"][data-cx-y]{scale:none}
}
`;

export const MOTION_CSS: string = minifyCss(steps + '\n' + delays + HOVER + PARALLAX);
