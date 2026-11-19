import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import {
  buildGoogleFontsHref,
  fontContentType,
  isAllowedGoogleCssUrl,
  isValidFontPath,
  keepArabicFaces,
  loadInlineFonts,
  resetFontFailureBackoff,
  pickArabicPreloadUrls,
  pickPreloadUrls,
  rewriteFontCss,
  googleCssUrlFromQuery,
  selfHostedFontsHref,
} from './storeFonts';
import { GET } from '@/app/fonts-cdn/[...path]/route';
import { mergeTokens, tokenArabicFonts, tokenFonts } from '@/themes/tokens';
import { minimalTokens } from '@/themes/minimal/tokens';
import type { ThemeCustomizations } from '@/themes/types';

const CSS = `/* latin-ext */
@font-face {
  font-family: 'Open Sans';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url(https://fonts.gstatic.com/s/opensans/v40/ext.woff2) format('woff2');
  unicode-range: U+0100-02BA, U+02BD-02C5;
}
/* latin */
@font-face {
  font-family: 'Open Sans';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url(https://fonts.gstatic.com/s/opensans/v40/latin.woff2) format('woff2');
  unicode-range: U+0000-00FF, U+0131, U+0152-0153;
}
/* latin */
@font-face {
  font-family: 'Open Sans';
  font-style: normal;
  font-weight: 700;
  font-display: swap;
  src: url(https://fonts.gstatic.com/s/opensans/v40/latin.woff2) format('woff2');
  unicode-range: U+0000-00FF, U+0131, U+0152-0153;
}
/* latin */
@font-face {
  font-family: 'Playfair Display';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url(https://fonts.gstatic.com/s/playfairdisplay/v37/pf.woff2) format('woff2');
  unicode-range: U+0000-00FF, U+0131;
}
`;

function ok(body: string, status = 200): Response {
  return new Response(body, { status });
}

describe('buildGoogleFontsHref / isAllowedGoogleCssUrl', () => {
  it('builds an allowlisted CSS2 URL', () => {
    const href = buildGoogleFontsHref(['Open Sans', 'Open Sans', 'Arial', undefined]);
    expect(href).toBe('https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;500;600;700&display=swap');
    expect(isAllowedGoogleCssUrl(href!)).toBe(true);
  });

  it('returns null when no Google font is used', () => {
    expect(buildGoogleFontsHref(['Arial', undefined])).toBeNull();
  });

  it('rejects any other URL', () => {
    expect(isAllowedGoogleCssUrl('https://evil.example/css2?family=A:wght@400;500;600;700&display=swap')).toBe(false);
    expect(isAllowedGoogleCssUrl('https://fonts.googleapis.com.evil.example/css2?x')).toBe(false);
    expect(isAllowedGoogleCssUrl('https://fonts.googleapis.com/css2?family=A:wght@400;500;600;700&display=swap&x=http://a')).toBe(false);
  });
});

describe('rewriteFontCss', () => {
  it('rewrites gstatic URLs to the same-origin proxy and keeps swap', () => {
    const out = rewriteFontCss(CSS)!;
    expect(out).toContain('url(/fonts-cdn/s/opensans/v40/latin.woff2)');
    expect(out).not.toContain('fonts.gstatic.com');
    expect(out).toContain('font-display:swap');
    expect(out).not.toContain('/*');
  });

  it('rejects CSS with foreign URLs, invalid paths or markup', () => {
    expect(rewriteFontCss(CSS.replace('https://fonts.gstatic.com/s/opensans/v40/ext.woff2', 'https://evil.example/x.woff2'))).toBeNull();
    expect(rewriteFontCss(CSS.replace('s/opensans/v40/ext.woff2', 's/../x.woff2'))).toBeNull();
    expect(rewriteFontCss(`${CSS}</style><script>`)).toBeNull();
    expect(rewriteFontCss('body{}')).toBeNull();
  });
});

describe('pickPreloadUrls', () => {
  it('picks the latin regular face of body then heading, max 2, deduped', () => {
    const css = rewriteFontCss(CSS)!;
    expect(pickPreloadUrls(css, ['Open Sans', 'Playfair Display'])).toEqual([
      '/fonts-cdn/s/opensans/v40/latin.woff2',
      '/fonts-cdn/s/playfairdisplay/v37/pf.woff2',
    ]);
    expect(pickPreloadUrls(css, ['Open Sans', 'Open Sans'])).toEqual(['/fonts-cdn/s/opensans/v40/latin.woff2']);
    expect(pickPreloadUrls(css, ['Arial', undefined])).toEqual([]);
  });
});

describe('isValidFontPath / fontContentType', () => {
  it('accepts gstatic font paths', () => {
    expect(isValidFontPath('s/opensans/v40/abc-DEF_1.woff2')).toBe(true);
    expect(fontContentType('s/a/v1/x.woff2')).toBe('font/woff2');
    expect(fontContentType('s/a/v1/x.ttf')).toBe('font/ttf');
  });

  it('rejects traversal, non-font and odd paths', () => {
    for (const p of [
      '', 's/../etc/passwd.woff2', 's/a/x.css', 's/a/x.woff2?x=1', 'l/font.woff2',
      's//a.woff2', 's/a/x.woff2/', 's/a%2e%2e/x.woff2', 's/a%5Cx.woff2','s/a x.woff2',
    ]) {
      expect(isValidFontPath(p)).toBe(false);
    }
    expect(fontContentType('s/a/x.svg')).toBeNull();
  });
});

describe('loadInlineFonts', () => {
  beforeEach(() => resetFontFailureBackoff());

  const href = buildGoogleFontsHref(['Open Sans'])!;

  it('returns rewritten CSS and preloads, sending a modern UA', async () => {
    const fetchImpl = vi.fn(async () => ok(CSS));
    const res = await loadInlineFonts(href, ['Open Sans'], fetchImpl as unknown as typeof fetch);
    expect(res?.css).toContain('/fonts-cdn/s/opensans');
    expect(res?.preloads).toEqual(['/fonts-cdn/s/opensans/v40/latin.woff2']);
    const init = (fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect((init.headers as Record<string, string>)['User-Agent']).toMatch(/Chrome\//);
  });

  it('falls back (null) on network error, non-200 or bad CSS', async () => {
    const fail = vi.fn(async () => { throw new Error('down'); });
    expect(await loadInlineFonts(href, [], fail as unknown as typeof fetch)).toBeNull();
    const notOk = vi.fn(async () => ok('', 500));
    expect(await loadInlineFonts(href, [], notOk as unknown as typeof fetch)).toBeNull();
    const bad = vi.fn(async () => ok('<html>blocked</html>'));
    expect(await loadInlineFonts(href, [], bad as unknown as typeof fetch)).toBeNull();
  });

  it('never fetches a URL outside the allowlist', async () => {
    const fetchImpl = vi.fn(async () => ok(CSS));
    expect(await loadInlineFonts('http://169.254.169.254/latest', [], fetchImpl as unknown as typeof fetch)).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('backs off after a failure instead of waiting on every request', async () => {
    const failing = vi.fn().mockRejectedValue(new Error('down'));
    expect(await loadInlineFonts(href, [], failing as unknown as typeof fetch)).toBeNull();
    const ok = vi.fn();
    expect(await loadInlineFonts(href, [], ok as unknown as typeof fetch)).toBeNull();
    expect(ok).not.toHaveBeenCalled();
  });
});

// ── Optional Arabic-script fallback fonts (theme token) ─────────────────

// The shape Google answers for a family with an Arabic subset: one face per
// subset and weight.
const face = (family: string, weight: number, file: string, range: string) => `@font-face {
  font-family: '${family}';
  font-style: normal;
  font-weight: ${weight};
  font-display: swap;
  src: url(https://fonts.gstatic.com/s/${file}.woff2) format('woff2');
  unicode-range: ${range};
}
`;
const ARABIC_RANGE = 'U+0600-06FF, U+0750-077F, U+0870-088E, U+200C-200E, U+2010-2011, U+204F, U+2E41, U+FB50-FDFF, U+FE70-FE74, U+FE76-FEFC';
const LATIN_EXT_RANGE = 'U+0100-02BA, U+02BD-02C5';
const LATIN_RANGE = 'U+0000-00FF, U+0131, U+0152-0153';
const NASKH_CSS = [400, 700]
  .map(
    (w) =>
      `/* arabic */\n${face('Noto Naskh Arabic', w, 'notonaskharabic/v1/arabic', ARABIC_RANGE)}` +
      `/* latin-ext */\n${face('Noto Naskh Arabic', w, 'notonaskharabic/v1/latin-ext', LATIN_EXT_RANGE)}` +
      `/* latin */\n${face('Noto Naskh Arabic', w, 'notonaskharabic/v1/latin', LATIN_RANGE)}`,
  )
  .join('');
const CSS_WITH_ARABIC = `${CSS}${NASKH_CSS}`;

const faceBlocks = (css: string) => css.match(/@font-face\{[^}]*\}/g) ?? [];
const blocksOf = (css: string, family: string) => faceBlocks(css).filter((b) => b.includes(`font-family:'${family}'`));

describe('Arabic fallback fonts: no new font request when unset', () => {
  const href = (customizations?: ThemeCustomizations) => {
    const tokens = mergeTokens(minimalTokens, customizations);
    return buildGoogleFontsHref([...tokenFonts(tokens), ...tokenArabicFonts(tokens)]);
  };
  const today = buildGoogleFontsHref(tokenFonts(mergeTokens(minimalTokens, undefined)));

  it('builds the identical URL without the token or with an invalid one', () => {
    expect(today).toBe(
      'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700&family=Inter:wght@400;500;600;700&display=swap',
    );
    const unset: Array<ThemeCustomizations | undefined> = [
      undefined,
      {},
      { typography: { fontFamilyArabic: {} } },
      { typography: { fontFamilyArabic: { heading: '', body: '' } } },
      { typography: { fontFamilyArabic: { heading: 'Comic Sans' } } },
      { typography: { fontFamilyArabic: { heading: 'Playfair Display', body: 'Inter' } } },
      { typography: { fontFamilyArabic: { heading: 12 as never } } },
      { spacing: { radius: { button: '0px' } } },
    ];
    for (const customizations of unset) expect(href(customizations), JSON.stringify(customizations)).toBe(today);
  });

  it('appends the Arabic family last when set, in an allow-listed URL', () => {
    const set = href({ typography: { fontFamilyArabic: { heading: 'Noto Naskh Arabic', body: 'Noto Naskh Arabic' } } })!;
    expect(set).toBe(
      'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700&family=Inter:wght@400;500;600;700&family=Noto+Naskh+Arabic:wght@400;500;600;700&display=swap',
    );
    expect(isAllowedGoogleCssUrl(set)).toBe(true);
  });
});

describe('keepArabicFaces / loadInlineFonts with Arabic-only families', () => {
  beforeEach(() => resetFontFailureBackoff());

  const href = buildGoogleFontsHref(['Open Sans', 'Playfair Display', 'Noto Naskh Arabic'])!;

  it('an empty list returns the same CSS from one fetch of the same URL', async () => {
    const plainHref = buildGoogleFontsHref(['Open Sans'])!;
    const before = vi.fn(async () => ok(CSS));
    const after = vi.fn(async () => ok(CSS));
    const a = await loadInlineFonts(plainHref, ['Open Sans'], before as unknown as typeof fetch);
    const b = await loadInlineFonts(plainHref, ['Open Sans'], after as unknown as typeof fetch, []);
    expect(b).toEqual(a);
    expect(b?.css).toBe(rewriteFontCss(CSS));
    expect(after).toHaveBeenCalledTimes(1);
    expect((after.mock.calls[0] as unknown as [string])[0]).toBe((before.mock.calls[0] as unknown as [string])[0]);
    // Same request options (the abort signal is a fresh object per call).
    const init = (fn: typeof before) => {
      const rest = { ...(fn.mock.calls[0] as unknown as [string, RequestInit])[1] };
      delete rest.signal;
      return rest;
    };
    expect(init(after)).toEqual(init(before));
    // The pure helper too: the very same string.
    const css = rewriteFontCss(CSS)!;
    expect(keepArabicFaces(css, [])).toBe(css);
    // A listed family that is not in the CSS changes nothing either.
    expect(keepArabicFaces(css, ['Noto Naskh Arabic'])).toBe(css);
  });

  it('keeps only the Arabic faces of an Arabic-only family and leaves the others intact', async () => {
    const fetchImpl = vi.fn(async () => ok(CSS_WITH_ARABIC));
    const res = await loadInlineFonts(
      href,
      ['Open Sans', 'Playfair Display'],
      fetchImpl as unknown as typeof fetch,
      ['Noto Naskh Arabic'],
    );
    const full = rewriteFontCss(CSS_WITH_ARABIC)!;
    expect(blocksOf(full, 'Noto Naskh Arabic')).toHaveLength(6);
    const naskh = blocksOf(res!.css, 'Noto Naskh Arabic');
    expect(naskh).toHaveLength(2);
    for (const block of naskh) {
      expect(block).toContain('unicode-range:U+0600-06FF');
      expect(block).toContain('/fonts-cdn/s/notonaskharabic/v1/arabic.woff2');
    }
    expect(res!.css).not.toContain('notonaskharabic/v1/latin');
    // The store's own fonts keep every face, byte for byte.
    expect(blocksOf(res!.css, 'Open Sans')).toEqual(blocksOf(full, 'Open Sans'));
    expect(blocksOf(res!.css, 'Playfair Display')).toEqual(blocksOf(full, 'Playfair Display'));
    expect(res!.css.startsWith(rewriteFontCss(CSS)!)).toBe(true);
    // Preloads are the same two Latin files; never an Arabic one.
    expect(res!.preloads).toEqual([
      '/fonts-cdn/s/opensans/v40/latin.woff2',
      '/fonts-cdn/s/playfairdisplay/v37/pf.woff2',
    ]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('without the list the family is loaded whole (it is also a main font of the store)', async () => {
    const fetchImpl = vi.fn(async () => ok(CSS_WITH_ARABIC));
    const res = await loadInlineFonts(href, ['Open Sans'], fetchImpl as unknown as typeof fetch);
    expect(res!.css).toBe(rewriteFontCss(CSS_WITH_ARABIC));
    expect(blocksOf(res!.css, 'Noto Naskh Arabic')).toHaveLength(6);
  });

  it('a family that would be left with no face keeps all its blocks', () => {
    const css = rewriteFontCss(CSS)!;
    // Open Sans has no Arabic subset in this answer.
    expect(keepArabicFaces(css, ['Open Sans'])).toBe(css);
    const mixed = rewriteFontCss(CSS_WITH_ARABIC)!;
    const out = keepArabicFaces(mixed, ['Open Sans', 'Noto Naskh Arabic']);
    expect(blocksOf(out, 'Open Sans')).toEqual(blocksOf(mixed, 'Open Sans'));
    expect(blocksOf(out, 'Noto Naskh Arabic')).toHaveLength(2);
  });

  it('never preloads an Arabic-only family, even when it is named as a preload family', async () => {
    const fetchImpl = vi.fn(async () => ok(CSS_WITH_ARABIC));
    const res = await loadInlineFonts(
      href,
      ['Noto Naskh Arabic', 'Open Sans'],
      fetchImpl as unknown as typeof fetch,
      ['Noto Naskh Arabic'],
    );
    expect(res!.preloads).toEqual(['/fonts-cdn/s/opensans/v40/latin.woff2']);
    expect(res!.preloads.join()).not.toContain('notonaskharabic');
    // pickPreloadUrls itself only ever picks a Latin face.
    expect(pickPreloadUrls(rewriteFontCss(CSS_WITH_ARABIC)!, ['Noto Naskh Arabic'])).toEqual([
      '/fonts-cdn/s/notonaskharabic/v1/latin.woff2',
    ]);
    expect(pickPreloadUrls(res!.css, ['Noto Naskh Arabic'])).toEqual([]);
  });
});

// ── Arabic font files requested early on an Arabic-script page ──────────

describe('pickArabicPreloadUrls / loadInlineFonts with Arabic preloads', () => {
  beforeEach(() => resetFontFailureBackoff());

  const arabicFace = (family: string, weight: number | string, file: string, style = 'normal') =>
    face(family, weight as number, file, ARABIC_RANGE).replace('font-style: normal', `font-style: ${style}`);
  // Static families: one file per weight (400, 700 for the body font; 500,
  // 600, 700 for the heading font).
  const STATIC_CSS = rewriteFontCss(
    CSS +
      arabicFace('Noto Naskh Arabic', 400, 'naskh/v1/arabic-400') +
      face('Noto Naskh Arabic', 400, 'naskh/v1/latin-400', LATIN_RANGE) +
      arabicFace('Noto Naskh Arabic', 700, 'naskh/v1/arabic-700') +
      arabicFace('Noto Kufi Arabic', 500, 'kufi/v1/arabic-500') +
      arabicFace('Noto Kufi Arabic', 600, 'kufi/v1/arabic-600') +
      arabicFace('Noto Kufi Arabic', 700, 'kufi/v1/arabic-700') +
      arabicFace('Noto Kufi Arabic', 400, 'kufi/v1/arabic-italic', 'italic') +
      arabicFace('Cairo', 400, 'cairo/v1/arabic-400'),
  )!;
  const url = (file: string) => `/fonts-cdn/s/${file}.woff2`;

  it('picks the body face at 400, then the heading face at 700', () => {
    expect(
      pickArabicPreloadUrls(STATIC_CSS, [
        { family: 'Noto Naskh Arabic', weight: 400 },
        { family: 'Noto Kufi Arabic', weight: 700 },
      ]),
    ).toEqual([url('naskh/v1/arabic-400'), url('kufi/v1/arabic-700')]);
    // The weight defaults to 400.
    expect(pickArabicPreloadUrls(STATIC_CSS, [{ family: 'Noto Naskh Arabic' }])).toEqual([url('naskh/v1/arabic-400')]);
  });

  it('falls back to the closest weight; a tie goes to the heavier face', () => {
    // Kufi has no 400 here: 500 is the closest normal-style face (never the italic one).
    expect(pickArabicPreloadUrls(STATIC_CSS, [{ family: 'Noto Kufi Arabic', weight: 400 }])).toEqual([url('kufi/v1/arabic-500')]);
    expect(pickArabicPreloadUrls(STATIC_CSS, [{ family: 'Noto Kufi Arabic', weight: 800 }])).toEqual([url('kufi/v1/arabic-700')]);
    // 550 is as far from 500 as from 600.
    expect(pickArabicPreloadUrls(STATIC_CSS, [{ family: 'Noto Kufi Arabic', weight: 550 }])).toEqual([url('kufi/v1/arabic-600')]);
    // Naskh: 500 is closer to 400 than to 700; 600 is closer to 700.
    expect(pickArabicPreloadUrls(STATIC_CSS, [{ family: 'Noto Naskh Arabic', weight: 500 }])).toEqual([url('naskh/v1/arabic-400')]);
    expect(pickArabicPreloadUrls(STATIC_CSS, [{ family: 'Noto Naskh Arabic', weight: 600 }])).toEqual([url('naskh/v1/arabic-700')]);
  });

  it('dedupes a variable font (every weight shares one file) and one family in both slots', () => {
    const variable = rewriteFontCss(CSS_WITH_ARABIC)!;
    expect(
      pickArabicPreloadUrls(variable, [
        { family: 'Noto Naskh Arabic', weight: 400 },
        { family: 'Noto Naskh Arabic', weight: 700 },
      ]),
    ).toEqual(['/fonts-cdn/s/notonaskharabic/v1/arabic.woff2']);
    // A weight range ("400 700") covers every weight inside it.
    const ranged = rewriteFontCss(CSS + arabicFace('Cairo', '200 1000', 'cairo/v2/arabic-var'))!;
    expect(pickArabicPreloadUrls(ranged, [{ family: 'Cairo', weight: 600 }])).toEqual([url('cairo/v2/arabic-var')]);
  });

  it('never picks a Latin face and returns at most two URLs', () => {
    // Open Sans and Playfair Display have no Arabic subset.
    expect(pickArabicPreloadUrls(STATIC_CSS, [{ family: 'Open Sans' }, { family: 'Playfair Display' }])).toEqual([]);
    const all = pickArabicPreloadUrls(STATIC_CSS, [
      { family: 'Noto Naskh Arabic' },
      { family: 'Noto Kufi Arabic' },
      { family: 'Cairo' },
    ]);
    expect(all).toEqual([url('naskh/v1/arabic-400'), url('kufi/v1/arabic-500')]);
    for (const picked of all) expect(picked).not.toContain('latin');
    expect(pickArabicPreloadUrls(STATIC_CSS, [])).toEqual([]);
    expect(pickArabicPreloadUrls(STATIC_CSS, [{ family: 'Amiri' }])).toEqual([]);
  });

  const href = buildGoogleFontsHref(['Open Sans', 'Playfair Display', 'Noto Naskh Arabic'])!;
  const load = (arabicPreload?: { family: string; weight?: number }[]) => {
    const fetchImpl = vi.fn(async () => ok(CSS_WITH_ARABIC));
    const families = ['Open Sans', 'Playfair Display'];
    const impl = fetchImpl as unknown as typeof fetch;
    const result =
      arabicPreload === undefined
        ? loadInlineFonts(href, families, impl, ['Noto Naskh Arabic'])
        : loadInlineFonts(href, families, impl, ['Noto Naskh Arabic'], arabicPreload);
    return result.then((res) => ({ res, fetchImpl }));
  };

  it('an empty list gives the result of a call without the argument: same CSS, same preloads, one fetch', async () => {
    const without = await load();
    const empty = await load([]);
    expect(empty.res).toEqual(without.res);
    expect(empty.res!.preloads).toEqual([
      '/fonts-cdn/s/opensans/v40/latin.woff2',
      '/fonts-cdn/s/playfairdisplay/v37/pf.woff2',
    ]);
    expect(empty.fetchImpl).toHaveBeenCalledTimes(1);
    expect((empty.fetchImpl.mock.calls[0] as unknown as [string])[0]).toBe(
      (without.fetchImpl.mock.calls[0] as unknown as [string])[0],
    );
  });

  it('with the list the Latin preloads come first, unchanged, then the Arabic file', async () => {
    const without = await load();
    const withArabic = await load([
      { family: 'Noto Naskh Arabic', weight: 400 },
      { family: 'Noto Naskh Arabic', weight: 700 },
    ]);
    expect(withArabic.res!.css).toBe(without.res!.css);
    expect(withArabic.res!.preloads).toEqual([
      ...without.res!.preloads,
      '/fonts-cdn/s/notonaskharabic/v1/arabic.woff2',
    ]);
    // The same single request: preloading adds no fetch on the server.
    expect(withArabic.fetchImpl).toHaveBeenCalledTimes(1);
    expect((withArabic.fetchImpl.mock.calls[0] as unknown as [string])[0]).toBe(
      (without.fetchImpl.mock.calls[0] as unknown as [string])[0],
    );
  });

  it('a family that is not in the CSS adds nothing', async () => {
    const without = await load();
    const unknown = await load([{ family: 'Noto Kufi Arabic', weight: 700 }]);
    expect(unknown.res).toEqual(without.res);
  });
});

describe('fonts-cdn route', () => {
  afterEach(() => vi.unstubAllGlobals());

  const call = (path: string[]) =>
    GET(new Request('https://store.example/fonts-cdn/x'), { params: Promise.resolve({ path }) });

  it('proxies a valid font with immutable caching and CORS', async () => {
    const fetchMock = vi.fn(async () => new Response(new Uint8Array([1, 2, 3])));
    vi.stubGlobal('fetch', fetchMock);
    const res = await call(['s', 'opensans', 'v40', 'latin.woff2']);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('font/woff2');
    expect(res.headers.get('Cache-Control')).toBe('public, max-age=31536000, immutable');
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect((fetchMock.mock.calls[0] as unknown as [string])[0]).toBe('https://fonts.gstatic.com/s/opensans/v40/latin.woff2');
  });

  it('rejects traversal and non-font paths without fetching', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    expect((await call(['s', '..', 'x.woff2'])).status).toBe(404);
    expect((await call(['s', 'a', 'x.html'])).status).toBe(404);
    expect((await call(['x', 'y.woff2'])).status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns 502 when upstream fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('down'); }));
    expect((await call(['s', 'a', 'v1', 'x.woff2'])).status).toBe(502);
  });
});

describe('same-origin font stylesheet (/fonts-cdn/css2)', () => {
  afterEach(() => vi.unstubAllGlobals());
  const href = 'https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;500;600;700&display=swap';

  it('maps a built Google URL to our origin and back', () => {
    const own = selfHostedFontsHref(href);
    expect(own).toBe('/fonts-cdn/css2?family=Noto+Sans:wght@400;500;600;700&display=swap');
    expect(googleCssUrlFromQuery(own!.slice(own!.indexOf('?')))).toBe(href);
    expect(selfHostedFontsHref(null)).toBeNull();
    expect(selfHostedFontsHref('https://evil.example/css2?family=A:wght@400;500;600;700&display=swap')).toBeNull();
    expect(googleCssUrlFromQuery('?family=A:wght@400&display=swap&x=1')).toBeNull();
  });

  const callCss = (query: string) =>
    GET(new Request(`https://namez.se/fonts-cdn/css2${query}`), { params: Promise.resolve({ path: ['css2'] }) });

  it('serves the rewritten CSS with same-origin font URLs, CORS and caching', async () => {
    const fetchMock = vi.fn(async () => new Response(CSS));
    vi.stubGlobal('fetch', fetchMock);
    const res = await callCss('?family=Open+Sans:wght@400;500;600;700&display=swap');
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('text/css; charset=utf-8');
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(res.headers.get('Cache-Control')).toContain('public');
    const body = await res.text();
    expect(body).toContain('url(/fonts-cdn/s/opensans/v40/latin.woff2)');
    expect(body).not.toMatch(/fonts\.(googleapis|gstatic)\.com/);
    expect((fetchMock.mock.calls[0] as unknown as [string])[0]).toBe(
      'https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;500;600;700&display=swap',
    );
  });

  it('rejects any other query without fetching, and 502s when Google fails', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    expect((await callCss('?family=A&url=http://169.254.169.254')).status).toBe(404);
    expect((await callCss('')).status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('down'); }));
    const res = await callCss('?family=Open+Sans:wght@400;500;600;700&display=swap');
    expect(res.status).toBe(502);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
  });
});
