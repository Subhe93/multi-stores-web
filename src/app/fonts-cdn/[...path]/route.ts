import {
  fetchFontCss,
  fontContentType,
  googleCssUrlFromQuery,
  gstaticUrl,
  isValidFontPath,
} from '@/lib/storeFonts';

// Same-origin proxy for Google fonts, so a visitor's browser never contacts
// Google for a store font:
// - /fonts-cdn/<path> serves https://fonts.gstatic.com/<path> (font files);
// - /fonts-cdn/css2?<query> serves https://fonts.googleapis.com/css2?<query>
//   with every font URL rewritten to /fonts-cdn/<path> (the stylesheet the
//   store layout links when it could not inline it).
// The store layout normally inlines that CSS (see src/lib/storeFonts.ts). The
// folder name has no leading underscore because `_` folders are private in
// App Router. gstatic paths are versioned, so the bytes are immutable and
// cached for a year by browsers and the Cloudflare edge.

const MAX_FONT_BYTES = 5 * 1024 * 1024;
const UPSTREAM_TIMEOUT_MS = 5000;

function notFound(status = 404): Response {
  return new Response(null, { status, headers: { 'Cache-Control': 'no-store' } });
}

async function fontCss(req: Request): Promise<Response> {
  const href = googleCssUrlFromQuery(new URL(req.url).search);
  if (!href) return notFound();
  const result = await fetchFontCss(href, fetch, UPSTREAM_TIMEOUT_MS);
  if ('error' in result) return notFound(502);
  return new Response(result.css, {
    status: 200,
    headers: {
      'Content-Type': 'text/css; charset=utf-8',
      'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
      'Access-Control-Allow-Origin': '*',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ path: string[] }> },
): Promise<Response> {
  const { path: segments } = await params;
  const path = Array.isArray(segments) ? segments.join('/') : '';
  if (path === 'css2') return fontCss(req);
  const contentType = fontContentType(path);
  if (!isValidFontPath(path) || !contentType) return notFound();

  try {
    const upstream = await fetch(gstaticUrl(path), {
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      cache: 'no-store',
    });
    if (!upstream.ok) return notFound(upstream.status === 404 ? 404 : 502);
    const body = await upstream.arrayBuffer();
    if (body.byteLength === 0 || body.byteLength > MAX_FONT_BYTES) return notFound(502);
    return new Response(body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Access-Control-Allow-Origin': '*',
        'Content-Length': String(body.byteLength),
      },
    });
  } catch {
    return notFound(502);
  }
}
