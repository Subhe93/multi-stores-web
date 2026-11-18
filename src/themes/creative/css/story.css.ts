// Motion stylesheet slot of builder S6 (story and proof sections). Rendered by the store layout
// only for a store that switched its motion style on (css/sections.css.ts).
//
// Rules of the house (see css/base.css.ts): every rule that hides, moves or
// animates starts with the gate G (or G_RTL); hover rules also sit inside
// the fine-pointer query; logical properties only; `translate` / `scale`
// instead of `transform` on elements that already carry a transform.

import { G, G_RTL, minifyCss } from './base.css';

const FINE = '@media (hover:hover) and (pointer:fine)';

// A card that is one link through a stretched pseudo-element (project
// cards): the pointer is over the link, not over the photo frame, so the
// slow zoom of hover-media is driven by the card. The legacy lift of the
// bordered cards (.card-lift, 0.3 s) takes the timing of the hover-lift
// recipe.
const CARDS = `
${FINE}{
${G} [data-cx-card]:hover [data-cx-hover="media"] :is(img,video),${G} [data-cx-card]:focus-within [data-cx-hover="media"] :is(img,video){scale:1.045}
${G} [data-cx-section] .card-lift{transition-duration:.5s}
}
`;

// A pressed button keeps the transitions it needs beside the press itself:
// the magnetic pull (translate) and its own colour and opacity feedback.
// Without this rule the press and the magnetic recipe replace each other's
// `transition` and one of the two snaps.
const PRESS = `
${G} :is(a,button)[data-cx-hover="press"]:not(.cx-btn){transition:scale .2s ease,translate .35s var(--cx-ease),opacity .25s ease,background-color .25s ease,color .25s ease,border-color .25s ease,box-shadow .3s ease}
`;

// Vertical variant of line-draw: the rail of a timeline grows downwards.
// The rail is as tall as the list, so it takes the long settle duration.
const RAIL = `
@keyframes cx-st-rail{from{transform:scaleY(0)}to{transform:none}}
${G} [data-cx-rail][data-cx-reveal="line"],${G_RTL} [data-cx-rail][data-cx-reveal="line"],${G} [data-cx-rail][data-cx-intro="rule"],${G_RTL} [data-cx-rail][data-cx-intro="rule"]{transform-origin:50% 0}
${G} [data-cx-rail][data-cx-reveal="line"][data-cx-state="pending"]{transform:scaleY(0)}
${G} [data-cx-rail][data-cx-reveal="line"][data-cx-state="shown"]{transition-duration:var(--cx-dur-settle)}
${G} [data-cx-rail][data-cx-intro="rule"]{animation-name:cx-st-rail;animation-duration:var(--cx-dur-settle);animation-timing-function:var(--cx-ease-io)}
`;

// Small interface answers: an accordion row opens and closes on the house
// ease, a carousel changes its quote with a short cross-fade.
const UI = `
${G} [data-cx-acc]{transition:grid-template-rows .35s var(--cx-ease)}
${G} [data-cx-swap]{transition:opacity .45s ease}
`;

export const STORY_CSS: string = minifyCss(CARDS + PRESS + RAIL + UI);
