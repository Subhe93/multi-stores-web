// Motion stylesheet slot of builder S1 (hero sections and the hero emblem). Rendered by the store layout
// only for a store that switched its motion style on (css/sections.css.ts).
//
// Rules of the house (see css/base.css.ts): every rule that hides, moves or
// animates starts with the gate G (or G_RTL); hover rules also sit inside
// the fine-pointer query; logical properties only; `translate` / `scale`
// instead of `transform` on elements that already carry a transform.
//
// Class hooks, set by the hero sections only when they got a `motion` prop:
//   .cx-hero-t      eyebrow, subheading and buttons (the rise recipe)
//   .cx-hero-h      the heading element (MotionText + the heading accent)
//   .cx-hero-btn    call-to-action links (rise + press + magnetic)
//   .cx-hero-media  the mask around a hero image

import { G, G_RTL, minifyCss, wipe, wipeFrom, wipeT } from './base.css';

// On load a hero text rises to ITS OWN resting values: the keyframes have no
// end state and do not fill forwards, so an eyebrow that rests at 70 %
// opacity ends there, and a button keeps its hover and press response once
// the entrance is over (a filling animation would pin opacity and transform).
const TEXT = `
@keyframes cx-hero-rise{from{opacity:0;transform:translateY(var(--cx-dist))}}
${G} .cx-hero-t[data-cx-intro="rise"]{animation-name:cx-hero-rise;animation-fill-mode:backwards}
`;

// A button carries three recipes (rise, press, magnetic) whose transitions
// would replace each other: one list for all three. It steps aside while the
// scroll entrance runs ("shown"), which brings its own transition.
const BUTTON = `
${G} a.cx-hero-btn:not([data-cx-state="shown"]){transition:translate .35s var(--cx-ease),scale .2s ease,opacity .3s ease,box-shadow .3s ease}
`;

// Heading accent (line or brush stroke under the heading): draws from the
// inline start once the words are on their way, as one soft-edged wipe (a
// feathered mask, so the brush has no hard cut travelling along it). A mask,
// not a scale: the brush stroke is mirrored with a transform in
// right-to-left pages, and the mask is applied before that transform, so
// only the plain line needs a right-to-left variant.
const A = '~.heading-accent';
const AL = '~.heading-accent[data-variant="line"]';
const H = '.cx-hero-h>.cx-ht';
const ACCENT = `
@keyframes cx-hero-draw{${wipeFrom('x')}}
@keyframes cx-hero-draw-r{${wipeFrom('x-rtl')}}
${G} ${H}[data-cx-intro]${A}{${wipe('x', true)};animation:cx-hero-draw var(--cx-dur-clip) var(--cx-ease-io) .45s backwards}
${G_RTL} ${H}[data-cx-intro]${AL}{${wipe('x-rtl', true)};animation-name:cx-hero-draw-r}
${G} ${H}[data-cx-state="pending"]${A}{${wipe('x', false)}}
${G_RTL} ${H}[data-cx-state="pending"]${AL}{${wipe('x-rtl', false)}}
${G} ${H}[data-cx-state="shown"]${A}{${wipe('x', true)};${wipeT('var(--cx-dur-clip) var(--cx-ease-io) .3s')}}
${G_RTL} ${H}[data-cx-state="shown"]${AL}{${wipe('x-rtl', true)}}
`;

// Phones: a hero image further down the page is not wiped open, it only
// settles inside its frame (the columns are stacked, a sideways wipe has no
// text side to open towards).
const MEDIA = `
@media (max-width:767.98px){
${G} div.cx-mask.cx-hero-media[data-cx-reveal="mask"][data-cx-state="pending"]{clip-path:none}
}
`;

export const HERO_CSS: string = minifyCss(TEXT + BUTTON + ACCENT + MEDIA);
