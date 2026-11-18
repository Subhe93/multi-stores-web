// Recognising what a variant option is from its name (the seller types the
// name freely, in the store's language). Pure module: shared by the product
// page picker, the product card and anything that needs "the size option".

/**
 * Words that mark a colour option. The product page picker draws such an
 * option as swatches, so this list decides visible output there: do not
 * extend it without checking the picker.
 */
export const COLOR_KEYWORDS = ['color', 'colour', 'لون', 'farbe', 'couleur', 'renk'];

export function isColorOptionKey(key: string): boolean {
  return COLOR_KEYWORDS.some((kw) => key.toLowerCase().includes(kw));
}

/** Words that mark a size option (en, sv, de, fr, tr, es, ar). */
export const SIZE_KEYWORDS = [
  'size',
  'storlek',
  'größe',
  'groesse',
  'grosse',
  'taille',
  'beden',
  'talla',
  'مقاس',
  'قياس',
];

export function isSizeOptionKey(key: string): boolean {
  const k = key.toLowerCase();
  return SIZE_KEYWORDS.some((kw) => k.includes(kw));
}
