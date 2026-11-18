// Availability reader of the card model. OWNER: builder W1.
// Foundation stub: returns null (nothing shown) until W1 implements it.

import type { CardSourceRow, CardStock } from './model';

/**
 * Stock of a product row as a card may show it; null when stock is not
 * tracked or cannot be known. See PRODUCT-CARD-CONTRACT.md, "Availability".
 */
export function cardStock(_row: CardSourceRow): CardStock | null {
  return null;
}
