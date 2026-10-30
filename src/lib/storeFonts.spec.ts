import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import {
  buildGoogleFontsHref,
  fontContentType,
  isAllowedGoogleCssUrl,
  isValidFontPath,
  loadInlineFonts,
  resetFontFailureBackoff,
  pickPreloadUrls,
  rewriteFontCss,
} from './storeFonts';
import { GET } from '@/app/fonts-cdn/[...path]/route';

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
