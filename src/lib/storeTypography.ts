// The legacy per-element typography of a store (`store.theme.typography`),
// as the scoped CSS the store layout injects. Pure: no React, no request.

/** One element style of `store.theme.typography`. */
export interface TypographyStyle {
  fontFamily?: string;
  color?: string;
  fontSize?: number;
}

export interface StoreTypography {
  heading?: TypographyStyle;
  body?: TypographyStyle;
  button?: TypographyStyle;
  link?: TypographyStyle;
  header?: TypographyStyle;
}

/** The Arabic-script family per slot (theme token), when the store set one. */
export interface ArabicSlots {
  heading?: string;
  body?: string;
}

// Escape `</style>` and backslashes when injecting user-supplied values into a <style> block.
export function cssSafe(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/<\/style/gi, '<\\/style');
}

// Quote a font family name so values like "Playfair Display" survive the CSS parser.
function quoteFont(name: string): string {
  const escaped = cssSafe(name).replace(/"/g, '\\"');
  return `"${escaped}"`;
}

// Build a scoped <style> rule body for a typography element. The optional
// Arabic family follows the element's own font, so it only draws characters
// that font lacks.
function typoBlock(selector: string, style?: TypographyStyle, arabic?: string): string {
  if (!style) return '';
  const parts: string[] = [];
  if (style.fontFamily) {
    parts.push(
      arabic
        ? `font-family: ${quoteFont(style.fontFamily)}, ${quoteFont(arabic)}, system-ui, sans-serif;`
        : `font-family: ${quoteFont(style.fontFamily)}, system-ui, sans-serif;`,
    );
  }
  if (style.color) parts.push(`color: ${cssSafe(style.color)};`);
  if (typeof style.fontSize === 'number' && style.fontSize > 0) {
    // Clamp into a sane range so a stray edit can't break layout.
    const px = Math.max(8, Math.min(160, style.fontSize));
    parts.push(`font-size: ${px}px;`);
  }
  if (!parts.length) return '';
  return `${selector} { ${parts.join(' ')} }`;
}

/**
 * Scope typography under `.store-root main` so colors don't leak into the
 * dark-bg footer (text-white) or into the dashboard. The header has its own
 * rule because it lives outside <main>. `.store-overlay` covers the portaled
 * cart drawer, which is visually part of the store but not a DOM descendant.
 *
 * `arabic`: the store's Arabic-script families (theme token). The heading
 * rule takes the heading family, every other rule the body family. Without
 * one the string is the one the layout always built.
 */
export function buildTypographyCss(typography: StoreTypography, arabic?: ArabicSlots | null): string {
  const heading = arabic?.heading;
  const body = arabic?.body;
  return [
    // A section text carries data-text-look (builder-chosen tag): style it by
    // its role, not by the tag, so changing the tag never changes the look.
    // :where() keeps the old (0,1,2) specificity, so overrides such as
    // .store-muted and the designer opt-out still win.
    typoBlock('.store-root main :is(h1, h2, h3, h4, h5, h6):where(:not([data-text-look="body"])), .store-root main :where([data-text-look="heading"])', typography.heading, heading),
    typoBlock('.store-root main :is(p, li, span):where(:not([data-text-look="heading"])), .store-root main :where([data-text-look="body"])', typography.body, body),
    typoBlock('.store-root main button', typography.button, body),
    typoBlock('.store-root main a', typography.link, body),
    typoBlock('.store-root header, .store-root header *', typography.header, body),
    typoBlock('.store-overlay p, .store-overlay li, .store-overlay span', typography.body, body),
    typoBlock('.store-overlay button', typography.button, body),
    typoBlock('.store-overlay a', typography.link, body),
  ].filter(Boolean).join('\n');
}
