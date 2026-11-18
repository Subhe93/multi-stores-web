// Curated Arabic-script fonts a store may pair with its Latin heading / body
// fonts (theme token `typography.fontFamilyArabic`). Every family is in the
// Google catalog (GOOGLE_FONT_SET) and serves the four weights the store font
// URL asks for (400, 500, 600, 700) in an `arabic` subset.
//
// The dashboard mirrors this list (src/lib/themeTokens.ts,
// ARABIC_FONT_FAMILIES): same names, same order.

export const ARABIC_FONTS = [
  'Noto Naskh Arabic',
  'Markazi Text',
  'Noto Kufi Arabic',
  'Noto Sans Arabic',
  'IBM Plex Sans Arabic',
  'Cairo',
] as const;

export type ArabicFont = (typeof ARABIC_FONTS)[number];

const ARABIC_FONT_SET: ReadonlySet<string> = new Set(ARABIC_FONTS);

/**
 * The allow-listed family for a stored value (compared after trim), else
 * null: absent, empty, a wrong type and an unknown name all mean "unset".
 */
export function arabicFontOrNull(raw: unknown): ArabicFont | null {
  if (typeof raw !== 'string') return null;
  const name = raw.trim();
  return ARABIC_FONT_SET.has(name) ? (name as ArabicFont) : null;
}
