import { GOOGLE_FONT_SET } from '@/lib/google-fonts';

// Self-hosted store fonts: the Google CSS2 stylesheet is fetched server-side
// and inlined, and every fonts.gstatic.com file is served same-origin through
// the /fonts-cdn route (no render-blocking request, no visitor IP to Google).
// When the inline fetch fails, the page links the same CSS from our own
// origin (/fonts-cdn/css2), never from fonts.googleapis.com: a visitor's
// browser never contacts Google for a store font.

/** Same-origin prefix that proxies https://fonts.gstatic.com/<path>. */
export const FONTS_PROXY_PREFIX = '/fonts-cdn';

/** Same-origin stylesheet that serves the rewritten Google CSS2 response. */
export const FONTS_CSS_PATH = `${FONTS_PROXY_PREFIX}/css2`;

const GOOGLE_CSS_PREFIX = 'https://fonts.googleapis.com/css2?';
const GSTATIC_ORIGIN = 'https://fonts.gstatic.com';

// A modern Chrome UA: Google then answers with woff2 + unicode-range subsets.
export const MODERN_FONT_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

export const FONT_CSS_REVALIDATE_SECONDS = 86400 * 7;
export const FONT_CSS_TAG = 'store-fonts';
// A cold Google CSS answer takes about 1.2 s; the result is cached for a week.
const FONT_CSS_TIMEOUT_MS = 2500;
// After a failed fetch, skip the inline path for a while (same-origin <link>).
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
 * Same-origin stylesheet URL for a Google CSS2 URL built by
 * buildGoogleFontsHref: `/fonts-cdn/css2?<same query>`. Null for any other URL.
 */
export function selfHostedFontsHref(googleHref: string | null | undefined): string | null {
  if (!googleHref || !isAllowedGoogleCssUrl(googleHref)) return null;
  return `${FONTS_CSS_PATH}?${googleHref.slice(GOOGLE_CSS_PREFIX.length)}`;
}

/**
 * The Google CSS2 URL behind a `/fonts-cdn/css2` query string (with or
 * without the leading `?`). Null unless it has the exact allowed shape.
 */
export function googleCssUrlFromQuery(search: string): string | null {
  const url = `${GOOGLE_CSS_PREFIX}${search.replace(/^\?/, '')}`;
  return isAllowedGoogleCssUrl(url) ? url : null;
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
  arabic: boolean;
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
      // Google's "arabic" subset starts at U+0600-06FF.
      arabic: /^\s*U\+0600-06FF/i.test(range),
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

/** An Arabic-script family to preload, with the weight the page draws it in. */
export interface ArabicPreload {
  family: string;
  /** Preferred weight; 400 when omitted. */
  weight?: number;
}

// Distance of a face's `font-weight` (one value, or a "min max" range of a
// variable font) from the wanted weight, and the weight used to break a tie.
function weightDistance(faceWeight: string, wanted: number): { distance: number; weight: number } {
  const nums = faceWeight.split(/\s+/).map(Number).filter((n) => Number.isFinite(n));
  if (!nums.length) return { distance: Math.abs(400 - wanted), weight: 400 };
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  if (wanted >= min && wanted <= max) return { distance: 0, weight: wanted };
  const nearest = wanted < min ? min : max;
  return { distance: Math.abs(nearest - wanted), weight: nearest };
}

/**
 * Up to two woff2 URLs of Google's "arabic" subset worth preloading on an
 * Arabic-script page: per wanted family the normal-style face whose weight is
 * closest to the wanted one (a tie goes to the heavier), in the given order,
 * deduped (variable fonts share one file). Never a Latin face.
 */
export function pickArabicPreloadUrls(css: string, wanted: readonly ArabicPreload[]): string[] {
  if (!wanted.length) return [];
  const faces = parseFaces(css).filter((f) => f.arabic && f.style === 'normal');
  const out: string[] = [];
  for (const { family, weight = 400 } of wanted) {
    if (!family || out.length >= 2) continue;
    let best: { src: string; distance: number; weight: number } | null = null;
    for (const face of faces) {
      if (face.family !== family) continue;
      const d = weightDistance(face.weight, weight);
      if (!best || d.distance < best.distance || (d.distance === best.distance && d.weight > best.weight)) {
        best = { src: face.src, ...d };
      }
    }
    if (best && !out.includes(best.src)) out.push(best.src);
  }
  return out;
}

const FONT_FACE_RE = /@font-face\s*\{[^}]*\}/g;

function faceFamily(block: string): string | undefined {
  return /font-family:\s*['"]?([^;'"]+)['"]?\s*;/.exec(block)?.[1]?.trim();
}

// Google's "arabic" subset starts at U+0600-06FF.
function isArabicFace(block: string): boolean {
  return /unicode-range:\s*U\+0600-06FF/i.test(block);
}

/**
 * For the given families only, keep just the faces of Google's "arabic"
 * subset. Such a family is a fallback behind a Latin font (theme token
 * `typography.fontFamilyArabic`): with its Latin subsets not declared, it can
 * never draw (or flash, during font-display: swap) a Latin character, and
 * the browser fetches its file only when Arabic text is rendered.
 *
 * A family left without any face keeps all its blocks. An empty list returns
 * the string as it is.
 */
export function keepArabicFaces(css: string, families: readonly string[]): string {
  if (!families.length) return css;
  const wanted = new Set(families);
  const filterable = new Set<string>();
  for (const block of css.match(FONT_FACE_RE) ?? []) {
    const family = faceFamily(block);
    if (family && wanted.has(family) && isArabicFace(block)) filterable.add(family);
  }
  if (!filterable.size) return css;
  return css.replace(FONT_FACE_RE, (block) => {
    const family = faceFamily(block);
    return family && filterable.has(family) && !isArabicFace(block) ? '' : block;
  });
}

export interface InlineFonts {
  css: string;
  preloads: string[];
}

type FetchFontCssResult = { css: string } | { error: 'network' | 'invalid' };

/**
 * Fetch the Google CSS for an allowed `href` (Next data cache, weekly) and
 * rewrite it for the same-origin proxy. `network`: Google could not be
 * reached or answered an error; `invalid`: the answer is unsafe to serve.
 */
export async function fetchFontCss(
  href: string,
  fetchImpl: typeof fetch = fetch,
  timeoutMs: number = FONT_CSS_TIMEOUT_MS,
): Promise<FetchFontCssResult> {
  if (!isAllowedGoogleCssUrl(href)) return { error: 'invalid' };
  try {
    const res = await fetchImpl(href, {
      headers: { 'User-Agent': MODERN_FONT_UA, Accept: 'text/css,*/*;q=0.1' },
      signal: AbortSignal.timeout(timeoutMs),
      next: { revalidate: FONT_CSS_REVALIDATE_SECONDS, tags: [FONT_CSS_TAG] },
    } as RequestInit);
    if (!res.ok) return { error: 'network' };
    const raw = await res.text();
    if (raw.length > MAX_CSS_BYTES) return { error: 'invalid' };
    const css = rewriteFontCss(raw);
    return css ? { css } : { error: 'invalid' };
  } catch {
    return { error: 'network' };
  }
}

/**
 * Fetch the Google CSS for `href` and return it rewritten for the
 * same-origin proxy. Null on any failure: the caller then links the same
 * CSS from our own origin (selfHostedFontsHref).
 *
 * `arabicOnly`: families requested only as an Arabic-script fallback; their
 * other subsets are dropped (keepArabicFaces). They are never preloaded as
 * a Latin font.
 *
 * `arabicPreload`: passed on an Arabic-script page only. The "arabic" faces
 * of these families are added after the Latin preloads (at most two), so the
 * files start loading with the HTML. Empty: the result is the same as before.
 */
export async function loadInlineFonts(
  href: string,
  preloadFamilies: (string | undefined | null)[],
  fetchImpl: typeof fetch = fetch,
  arabicOnly: readonly string[] = [],
  arabicPreload: readonly ArabicPreload[] = [],
): Promise<InlineFonts | null> {
  if (!isAllowedGoogleCssUrl(href)) return null;
  if (lastFailureAt && Date.now() - lastFailureAt < FAILURE_BACKOFF_MS) return null;
  const result = await fetchFontCss(href, fetchImpl);
  if ('error' in result) {
    if (result.error === 'network') lastFailureAt = Date.now();
    return null;
  }
  const css = keepArabicFaces(result.css, arabicOnly);
  // An Arabic-only family is never a preload candidate.
  const preloadable = arabicOnly.length
    ? preloadFamilies.filter((f) => !f || !arabicOnly.includes(f))
    : preloadFamilies;
  const preloads = pickPreloadUrls(css, preloadable);
  for (const url of pickArabicPreloadUrls(css, arabicPreload)) {
    if (!preloads.includes(url)) preloads.push(url);
  }
  return { css, preloads };
}

/** Test hook: forget a previous failure. */
export function resetFontFailureBackoff(): void {
  lastFailureAt = 0;
}

/** Upstream URL for a validated proxy path. */
export function gstaticUrl(path: string): string {
  return `${GSTATIC_ORIGIN}/${path}`;
}
