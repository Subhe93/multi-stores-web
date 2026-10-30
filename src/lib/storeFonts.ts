import { GOOGLE_FONT_SET } from '@/lib/google-fonts';

// Self-hosted store fonts: the Google CSS2 stylesheet is fetched server-side
// and inlined, and every fonts.gstatic.com file is served same-origin through
// the /fonts-cdn route (no render-blocking request, no visitor IP to Google).

/** Same-origin prefix that proxies https://fonts.gstatic.com/<path>. */
export const FONTS_PROXY_PREFIX = '/fonts-cdn';

const GOOGLE_CSS_PREFIX = 'https://fonts.googleapis.com/css2?';
const GSTATIC_ORIGIN = 'https://fonts.gstatic.com';

// A modern Chrome UA: Google then answers with woff2 + unicode-range subsets.
export const MODERN_FONT_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

export const FONT_CSS_REVALIDATE_SECONDS = 86400 * 7;
export const FONT_CSS_TAG = 'store-fonts';
const FONT_CSS_TIMEOUT_MS = 1200;
// After a failed fetch, skip the inline path for a while (fallback <link>).
const FAILURE_BACKOFF_MS = 5 * 60 * 1000;
let lastFailureAt = 0;
const MAX_CSS_BYTES = 512 * 1024;

const FONT_CONTENT_TYPES: Record<string, string> = {
  woff2: 'font/woff2',
  woff: 'font/woff',
  ttf: 'font/ttf',
};

/**
 * One Google Fonts CSS2 URL covering every distinct font the store uses.
 * The family catalog is the allowlist: anything outside it is treated as a
 * system font and skipped.
 */
export function buildGoogleFontsHref(fonts: (string | undefined | null)[]): string | null {
  const unique = Array.from(new Set(
    fonts.filter((f): f is string => !!f && GOOGLE_FONT_SET.has(f)),
  ));
  if (!unique.length) return null;
  const families = unique
    .map((f) => `family=${encodeURIComponent(f).replace(/%20/g, '+')}:wght@400;500;600;700`)
    .join('&');
  return `${GOOGLE_CSS_PREFIX}${families}&display=swap`;
}

/** Only CSS2 URLs in the exact shape buildGoogleFontsHref emits (no SSRF). */
export function isAllowedGoogleCssUrl(url: string): boolean {
  if (!url.startsWith(GOOGLE_CSS_PREFIX)) return false;
  const query = url.slice(GOOGLE_CSS_PREFIX.length);
  return /^(family=[A-Za-z0-9+%._~-]+:wght@400;500;600;700&)+display=swap$/.test(query);
}

/**
 * Strict gstatic path check for the proxy route: safe charset, a font
 * extension, under /s/, no traversal or empty segments.
 */
export function isValidFontPath(path: string): boolean {
  if (!path || path.length > 300) return false;
  if (!/^[A-Za-z0-9/_.-]+$/.test(path)) return false;
  if (path.includes('..') || path.includes('//')) return false;
  if (!path.startsWith('s/')) return false;
  return /\.(woff2|woff|ttf)$/.test(path);
}

/** Content-Type by extension; null for anything that is not a font. */
export function fontContentType(path: string): string | null {
  const ext = path.slice(path.lastIndexOf('.') + 1).toLowerCase();
  return FONT_CONTENT_TYPES[ext] ?? null;
}

const GSTATIC_URL_RE = /url\((['"]?)https:\/\/fonts\.gstatic\.com\/([^'")\s]+)\1\)/g;

/**
 * Rewrite gstatic font URLs to the same-origin proxy and minify. Returns
 * null when the CSS contains anything unsafe to inline or an unexpected
 * URL (any other origin / invalid path), so callers fall back to <link>.
 */
export function rewriteFontCss(css: string): string | null {
  if (!css.includes('@font-face') || css.includes('<')) return null;
  let invalid = false;
  const rewritten = css.replace(GSTATIC_URL_RE, (_m, _q: string, path: string) => {
    if (!isValidFontPath(path)) invalid = true;
    return `url(${FONTS_PROXY_PREFIX}/${path})`;
  });
  // Every remaining url() must already point at the proxy.
  const urls = rewritten.match(/url\([^)]*\)/g) ?? [];
  if (invalid || urls.some((u) => !u.startsWith(`url(${FONTS_PROXY_PREFIX}/`))) return null;
  if (rewritten.includes(GSTATIC_ORIGIN)) return null;
  return rewritten
    .replace(/\/\*[^*]*\*\//g, '')
    .replace(/\s*([{};:,])\s*/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

interface FontFace {
  family: string;
  weight: string;
  style: string;
  src: string;
  latin: boolean;
}

function parseFaces(css: string): FontFace[] {
  const faces: FontFace[] = [];
  for (const block of css.match(/@font-face\s*\{[^}]*\}/g) ?? []) {
    const family = /font-family:\s*['"]?([^;'"]+)['"]?\s*;/.exec(block)?.[1]?.trim();
    const src = /url\(([^)]+\.woff2)\)/.exec(block)?.[1];
    if (!family || !src) continue;
    const range = /unicode-range:\s*([^;}]+)/.exec(block)?.[1] ?? '';
    faces.push({
      family,
      weight: /font-weight:\s*([^;}]+)/.exec(block)?.[1]?.trim() ?? '400',
      style: /font-style:\s*([^;}]+)/.exec(block)?.[1]?.trim() ?? 'normal',
      src: src.replace(/^['"]|['"]$/g, ''),
      // Google's "latin" subset starts at U+0000-00FF (latin-ext does not).
      latin: /^\s*U\+0000-00FF/i.test(range),
    });
  }
  return faces;
}

/**
 * Up to two woff2 URLs worth preloading: the latin regular face of the body
 * font, then of the heading font (deduped; variable fonts share one file).
 */
export function pickPreloadUrls(css: string, families: (string | undefined | null)[]): string[] {
  const faces = parseFaces(css).filter((f) => f.latin && f.style === 'normal');
  const out: string[] = [];
  for (const family of families) {
    if (!family || out.length >= 2) continue;
    const own = faces.filter((f) => f.family === family);
    const face = own.find((f) => f.weight === '400') ?? own[0];
    if (face && !out.includes(face.src)) out.push(face.src);
  }
  return out;
}

export interface InlineFonts {
  css: string;
  preloads: string[];
}

/**
 * Fetch the Google CSS for `href` (Next data cache, weekly) and return it
 * rewritten for the same-origin proxy. Null on any failure: the caller then
 * keeps the classic <link rel="stylesheet">.
 */
export async function loadInlineFonts(
  href: string,
  preloadFamilies: (string | undefined | null)[],
  fetchImpl: typeof fetch = fetch,
): Promise<InlineFonts | null> {
  if (!isAllowedGoogleCssUrl(href)) return null;
  if (lastFailureAt && Date.now() - lastFailureAt < FAILURE_BACKOFF_MS) return null;
  const fail = () => {
    lastFailureAt = Date.now();
    return null;
  };
  try {
    const res = await fetchImpl(href, {
      headers: { 'User-Agent': MODERN_FONT_UA, Accept: 'text/css,*/*;q=0.1' },
      signal: AbortSignal.timeout(FONT_CSS_TIMEOUT_MS),
      next: { revalidate: FONT_CSS_REVALIDATE_SECONDS, tags: [FONT_CSS_TAG] },
    } as RequestInit);
    if (!res.ok) return fail();
    const raw = await res.text();
    if (raw.length > MAX_CSS_BYTES) return null;
    const css = rewriteFontCss(raw);
    if (!css) return null;
    return { css, preloads: pickPreloadUrls(css, preloadFamilies) };
  } catch {
    return fail();
  }
}

/** Test hook: forget a previous failure. */
export function resetFontFailureBackoff(): void {
  lastFailureAt = 0;
}

/** Upstream URL for a validated proxy path. */
export function gstaticUrl(path: string): string {
  return `${GSTATIC_ORIGIN}/${path}`;
}
