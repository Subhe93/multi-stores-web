// Size of the logo in the header bar (pure, no React rendering).
//
// `box` (the stored behaviour): the logo is contained in a square of
// `logo_size`. `height` (opt-in, header setting `logo_fit`): the logo is as
// tall as `logo_size` and keeps its own proportions, so a wide wordmark is
// readable. The natural ratio is not known on the server, so the width comes
// from CSS (`width: auto` under a cap), not from fetched dimensions.

import type { CSSProperties } from 'react';

export type LogoFit = 'box' | 'height';

/** Tallest logo the fixed 64px bar holds. */
export const LOGO_HEIGHT_MAX = 56;
/** Widest logo: five times its height. */
export const LOGO_MAX_ASPECT = 5;

/** `height` only for that exact string; unset or anything else is `box`. */
export function parseLogoFit(raw: unknown): LogoFit {
  return raw === 'height' ? 'height' : 'box';
}

export interface HeaderLogoBox {
  width: number;
  height: number;
  sizes: string;
  style: CSSProperties;
  className: string;
  /** Extra class of the store name drawn beside the logo ('' = none). */
  nameClassName: string;
}

export function headerLogoBox(fit: LogoFit, logoSize: number): HeaderLogoBox {
  if (fit === 'height') {
    const h = Math.min(logoSize, LOGO_HEIGHT_MAX);
    const w = h * LOGO_MAX_ASPECT;
    return {
      // Square attributes: the box is h x h until the image arrives, then it
      // takes the natural ratio (a square or tall logo never shifts).
      width: h,
      height: h,
      sizes: `${w}px`,
      style: { height: h, width: 'auto', maxWidth: `min(${w}px, 50vw)` },
      // min-w-0: on a narrow phone the logo shrinks instead of overflowing.
      className: 'object-contain min-w-0',
      // The logo can shrink here, so the name must give way first: without
      // this both shrink together and a long store name squeezes the logo
      // (a square one became narrower than in the square box). With it the
      // name truncates as it does beside the square box, and the logo only
      // shrinks once the name has no room left.
      nameClassName: 'shrink-[999]',
    };
  }
  return {
    width: logoSize,
    height: logoSize,
    sizes: `${logoSize}px`,
    style: { width: logoSize, height: logoSize },
    className: 'object-contain shrink-0',
    nameClassName: '',
  };
}
