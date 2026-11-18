// Swatch and size readers of the card model. OWNER: builder W2.
// Foundation stub: both return null (nothing shown) until W2 implements them.

import type { CardSizes, CardSourceRow, CardSwatches } from './model';

/** Colour values of the product's colour option, or null without one. */
export function cardSwatches(_row: CardSourceRow): CardSwatches | null {
  return null;
}

/** Values of the product's size option with their availability, or null without one. */
export function cardSizes(_row: CardSourceRow): CardSizes | null {
  return null;
}
