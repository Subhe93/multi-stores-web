/**
 * Platform-level robots.txt (served at the root of the marketing domain). The
 * subdomain `/robots.txt` is rewritten to the store-scoped route by the proxy.
 */
export async function GET() {
  const origin = process.env.NEXT_PUBLIC_WEB_URL || 'http://localhost:3003';
  const body = [
    'User-agent: *',
    'Allow: /',
    'Disallow: /auth',
    '',
    `Sitemap: ${origin.replace(/\/$/, '')}/sitemap.xml`,
    '',
  ].join('\n');
  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600',
    },
  });
}
