import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET } from './route';

// Next hands the route the query percent-encoded (`:`, `@`, `;`), as seen on
// the live server; the stylesheet must still be served.
const ENCODED =
  'http://localhost/fonts-cdn/css2?family=Noto+Sans%3Awght%40400%3B500%3B600%3B700&display=swap';
const PLAIN = 'http://localhost/fonts-cdn/css2?family=Noto+Sans:wght@400;500;600;700&display=swap';

const GOOGLE_CSS =
  "@font-face{font-family:'Noto Sans';src:url(https://fonts.gstatic.com/s/notosans/v42/a.woff2) format('woff2');}";

function call(url: string) {
  return GET(new Request(url), { params: Promise.resolve({ path: ['css2'] }) });
}

describe('/fonts-cdn/css2', () => {
  afterEach(() => vi.unstubAllGlobals());

  for (const [label, url] of [
    ['percent-encoded query', ENCODED],
    ['plain query', PLAIN],
  ] as const) {
    it(`serves the rewritten stylesheet for a ${label}`, async () => {
      const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(GOOGLE_CSS, { status: 200 }));
      vi.stubGlobal('fetch', fetchMock);
      const res = await call(url);
      expect(res.status).toBe(200);
      expect(res.headers.get('Content-Type')).toContain('text/css');
      const css = await res.text();
      expect(css).not.toContain('fonts.gstatic.com');
      expect(css).toContain('/fonts-cdn/');
      expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
        'https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;500;600;700&display=swap',
      );
    });
  }

  it('still refuses a query outside the allow-list', async () => {
    vi.stubGlobal('fetch', vi.fn());
    const res = await call('http://localhost/fonts-cdn/css2?family=Evil%22%3Bx&display=swap');
    expect(res.status).toBe(404);
  });
});
