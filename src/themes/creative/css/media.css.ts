// Motion stylesheet slot of builder S3 (media and editorial sections). Rendered by the store layout
// only for a store that switched its motion style on (css/sections.css.ts).
//
// Rules of the house (see css/base.css.ts): every rule that hides, moves or
// animates starts with the gate G (or G_RTL); hover rules also sit inside
// the fine-pointer query; logical properties only; `translate` / `scale`
// instead of `transform` on elements that already carry a transform.

import { G, G_RTL, minifyCss } from './base.css';

const FINE = '@media (hover:hover) and (pointer:fine)';

// Linked tile title (category tiles): the text sits in a span so the line is
// as wide as the words, not as the card. The span must not pick up the store
// body typography (`.store-root main span`), hence the ungated reset: it
// only keeps what the title already had.
const TILE_TITLE = `
.store-root .cx-tt{font:inherit;color:inherit;letter-spacing:inherit}
${FINE}{
${G} .cx-tt{background-image:linear-gradient(currentColor,currentColor);background-repeat:no-repeat;background-size:0% 1px;background-position:0% 100%;transition:background-size .5s var(--cx-ease)}
${G_RTL} .cx-tt{background-position:100% 100%}
${G} a:hover .cx-tt,${G} a:focus-visible .cx-tt{background-size:100% 1px}
}
`;

// Tile arrow: moves 4 px towards the reading direction while its link is
// hovered or focused.
const TILE_ARROW = `
${FINE}{
${G} [data-cx-arrow]{transition:translate .5s var(--cx-ease)}
${G} a:hover [data-cx-arrow],${G} a:focus-visible [data-cx-arrow]{translate:4px 0}
${G_RTL} a:hover [data-cx-arrow],${G_RTL} a:focus-visible [data-cx-arrow]{translate:-4px 0}
}
`;

// Swipe rows (mobile_scroll). Below 768 px the row is a horizontal scroller:
// it enters as ONE block (its wrapper rises) and its tiles are never hidden,
// so a tile outside the row's view does not wait for the swipe. From 768 px
// the row is a grid again: the wrapper stays still and the tiles stagger.
const SWIPE_ROW = `
@media (max-width:767.98px){
${G} [data-cx-swipe]>[data-cx-reveal][data-cx-state="pending"]{opacity:1;transform:none}
${G} [data-cx-swipe]>[data-cx-intro]{animation:none}
}
@media (min-width:768px){
${G} [data-cx-swipe-row][data-cx-reveal][data-cx-state="pending"]{opacity:1;transform:none}
${G} [data-cx-swipe-row][data-cx-intro]{animation:none}
}
`;

// Buttons of image-with-text keep their opacity fade next to the press
// response (the press recipe alone would replace their transition).
const BUTTONS = `
${G} [data-cx-section="image-with-text"] a[data-cx-hover="press"]{transition:scale .2s ease,opacity .3s ease}
`;

// Image-with-text parallax: the layer only travels upwards (0 to -5 % of its
// height), so it is oversized by 6 % from its top edge instead of the
// default 14 % from the centre: the photo loses 3 % on each side instead of
// 7 %, which matters for photos with lettering or a subject near the edge.
// Same conditions as the default rule (768 px and up, not calm).
const SOFT_PARALLAX = `
@media (min-width:768px){
html[data-cx-motion] .store-root:not([data-motion-reveal]):not([data-cx-builder]) .cx-mask-in>[data-cx-behavior~="scrub"][data-cx-y][data-cx-soft]{scale:1.06;transform-origin:50% 0}
}
`;

// Framed image (image-with-text): the frame carries a shadow of its own.
// While the mask inside is still closed the shadow is held back, then fades
// in with the image, so an empty shadow box never shows first. The frame's
// shadow is an inline style, hence the !important on this one gated rule.
// Browsers without :has() simply show the shadow from the start.
const FRAME_SHADOW = `
${G} [data-cx-frame]{transition:box-shadow var(--cx-dur) ease}
${G} [data-cx-frame]:has(>.cx-mask[data-cx-state="pending"]){box-shadow:none!important}
`;

export const MEDIA_CSS: string = minifyCss(
  TILE_TITLE + TILE_ARROW + SWIPE_ROW + BUTTONS + SOFT_PARALLAX + FRAME_SHADOW,
);
