// URL safety of the "pattern-band" tile. The tile is the one owner value the
// platform writes into CSS (`background-image: url("…")`), so it is accepted
// only in three plain shapes and never with a character that could close the
// string or the function:
//
//   /uploads/tile.svg                         root-relative (not "//host")
//   https://cdn.example/tile.png              https only
//   data:image/(svg+xml|png|webp);base64,…    base64 payload only
//
// Anything else (http:, javascript:, a data URL of another type or without
// base64, quotes, backslashes, a closing bracket, control characters, an
// oversized value) is rejected and the section renders nothing. Pure module,
// no imports.

/** Longest accepted value: enough for an inlined tile, far below a page-sized payload. */
export const PATTERN_URL_MAX = 200_000;

const FORBIDDEN = /["\\)\u0000-\u001f\u007f\u2028\u2029]/;
const DATA_IMAGE = /^data:image\/(?:svg\+xml|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/;

/**
 * The tile URL as a safe, percent-encoded string, or null when it is not
 * accepted. Existing percent escapes are kept as they are (not encoded twice).
 */
export function safePatternUrl(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const url = raw.trim();
  if (!url || url.length > PATTERN_URL_MAX || FORBIDDEN.test(url)) return null;

  if (url.startsWith('data:')) return DATA_IMAGE.test(url) ? url : null;

  const rootRelative = url.startsWith('/') && !url.startsWith('//');
  const https = /^https:\/\/[^/\s]+/i.test(url);
  if (!rootRelative && !https) return null;

  let encoded: string;
  try {
    encoded = encodeURI(url);
  } catch {
    // A lone surrogate: not a URL anybody uploaded.
    return null;
  }
  // encodeURI turns an existing "%20" into "%2520": undo that for real escapes.
  encoded = encoded.replace(/%25([0-9A-Fa-f]{2})/g, '%$1');
  return FORBIDDEN.test(encoded) ? null : encoded;
}

/** The CSS value of an accepted URL: url("…"). Pass only what safePatternUrl returned. */
export function patternCssUrl(safeUrl: string): string {
  return `url("${safeUrl}")`;
}
