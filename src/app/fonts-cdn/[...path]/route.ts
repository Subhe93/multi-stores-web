import { fontContentType, gstaticUrl, isValidFontPath } from '@/lib/storeFonts';

// Same-origin proxy for Google font files: /fonts-cdn/<path> serves
// https://fonts.gstatic.com/<path>. The store layout inlines the Google CSS
// with its URLs rewritten here (see src/lib/storeFonts.ts). The folder name
// has no leading underscore because `_` folders are private in App Router.
// gstatic paths are versioned, so the bytes are immutable and cached for a
// year by browsers and the Cloudflare edge.

const MAX_FONT_BYTES = 5 * 1024 * 1024;
const UPSTREAM_TIMEOUT_MS = 5000;

function notFound(status = 404): Response {
  return new Response(null, { status, headers: { 'Cache-Control': 'no-store' } });
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ path: string[] }> },
): Promise<Response> {
  const { path: segments } = await params;
  const path = Array.isArray(segments) ? segments.join('/') : '';
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
