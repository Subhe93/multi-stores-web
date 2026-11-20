// The locale handed to Intl (numbers, prices, dates) for a storefront locale.
//
// Node 22 (full ICU) formats 'ku' (Kurmanji) natively, but browsers ship
// trimmed ICU data and may not know it; a page formatted on the server with
// 'ku' and on the client with the browser's default would not hydrate. So a
// locale listed here maps to a fixed, widely available Intl locale on both
// sides:
// - numbers / prices: 'de' groups and separates exactly like CLDR 'ku'
//   (1.234,50 €, 1.234,50 SEK) and carries no words;
// - dates: 'en-GB' (19 November 2026), since Kurmanji month names would need
//   'ku' data the browser may lack.
// Arabic ('ar', 'ar-SA', ...) keeps its locale but always gets Latin digits
// (`-u-nu-latn`): 9,90 € instead of ٩٫٩٠ €. Storefront copy is written with
// Latin digits and that is what Arabic-speaking shoppers in Europe expect.
// Every other locale is returned unchanged.
const INTL_FALLBACK: Record<string, { number: string; date: string }> = {
  ku: { number: 'de', date: 'en-GB' },
};

export type IntlKind = 'number' | 'date';

export function intlLocale(locale: string | null | undefined, kind: IntlKind = 'number'): string {
  const code = (locale || 'en').trim();
  const base = code.toLowerCase().split(/[-_]/)[0];
  const mapped = INTL_FALLBACK[base];
  if (mapped) return mapped[kind];
  if (base === 'ar') return withLatinDigits(code);
  return code;
}

/** `locale` with the Latin numbering system, unless it already sets one. */
export function withLatinDigits(locale: string): string {
  return /-u-(?:.*-)?nu-/i.test(locale) ? locale : `${locale}-u-nu-latn`;
}
