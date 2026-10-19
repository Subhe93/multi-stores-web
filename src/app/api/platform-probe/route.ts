import { NextRequest, NextResponse } from 'next/server';

// Custom-domain ownership probe (markets app). The API's domain "Verify"
// step fetches GET https://<hostname>/api/platform-probe through the
// shopper's DNS. A JSON answer carrying the platform marker and the host the
// request arrived with proves the hostname already routes to this
// storefront, which is the only thing DNS records can't show behind a
// proxy such as Cloudflare (the public records then point at the proxy,
// never at the platform). No store data, no cache, no secrets.
export const dynamic = 'force-dynamic';

export const PLATFORM_PROBE_MARKER = 'multi-stores';

export function GET(req: NextRequest) {
  const host = (req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? '')
    .split(',')[0]
    .trim()
    .toLowerCase();
  return NextResponse.json(
    { platform: PLATFORM_PROBE_MARKER, host },
    { headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } },
  );
}
