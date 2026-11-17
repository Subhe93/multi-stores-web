// Default colours of a call-to-action button for `buttonStyles`
// (themes/elementStyles.ts): the theme's primary or accent colour, inverted
// when the section background already uses that colour.

import type { ButtonDefaults } from '../../../elementStyles';
import type { Tone } from './tone';

export type CtaTone = 'primary' | 'accent';

/** Radius of buttons in the newer sections: a store-level token when one exists. */
export const BUTTON_RADIUS = 'var(--theme-radius-button, var(--theme-radius-full))';

/** Stored button tone; unset or unknown reads as `primary`. */
export function ctaToneValue(raw: unknown): CtaTone {
  return raw === 'accent' ? 'accent' : 'primary';
}

/**
 * `radius` defaults to the button token; sections that predate it pass their
 * own literal so their output stays as it was.
 */
export function ctaDefaults(ctaTone: CtaTone, sectionTone: Tone, radius: string = BUTTON_RADIUS): ButtonDefaults {
  const color = `var(--theme-colors-${ctaTone})`;
  const contrast = `var(--theme-colors-${ctaTone}Contrast, #fff)`;
  // A primary button on a primary band would vanish: swap the two colours.
  if (sectionTone === ctaTone) return { bg: contrast, text: color, radius };
  return { bg: color, text: contrast, radius };
}
