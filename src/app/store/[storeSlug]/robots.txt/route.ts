import { buildStoreOrigin } from '@/lib/storeUrl';
import { storefront } from '@/lib/api';
import { requestMarketRef } from '@/lib/market';

interface RouteCtx {
  params: Promise<{ storeSlug: string }>;
}

/**
 * Per-store robots.txt served from the store's subdomain. Disallow paths and
 * the sitemap URL are subdomain-rooted (e.g. `/cart`, not `/store/slug/cart`)
 * — that's the URL form crawlers actually see, because the proxy rewrites
 * `subdomain/*` → `/store/slug/*` internally.
 */
export async function GET(req: Request, ctx: RouteCtx) {
  const { storeSlug } = await ctx.params;
  // Market of the request host (markets app) — forwarded by the proxy. A
  // market-preview host never reaches this handler (the proxy answers a
  // disallow-all robots itself); the flag is read for completeness.
  const marketKey = requestMarketRef(req.headers);

  // Resolve the store's canonical origin (market hostname → custom_domain →
  // subdomain).
  let customDomain: string | null = null;
  let market: { primary_hostname?: string | null } | null = null;
  try {
    const store = (await storefront.getStore(storeSlug, marketKey)) as {
      custom_domain?: string | null;
      market?: { primary_hostname?: string | null } | null;
    };
    customDomain = store?.custom_domain || null;
    market = store?.market ?? null;
  } catch {
    customDomain = null;
  }
  const origin = buildStoreOrigin(storeSlug, customDomain, market);

  // A request the proxy flagged noindex (M6.1 `x-store-noindex`: NEVER, or
  // AUTO on the platform subdomain) keeps `Allow: /` on purpose: crawlers
  // must still be able to fetch the pages to see their `noindex, nofollow`
  // (meta + X-Robots-Tag). A robots Disallow would hide the directive and
  // already-indexed URLs would linger in the index. The flag is therefore
  // deliberately not read here.
  const body = [
    'User-agent: *',
    'Allow: /',
    'Disallow: /cart',
    'Disallow: /checkout',
    'Disallow: /account',
    'Disallow: /auth',
    '',
    `Sitemap: ${origin}/sitemap.xml`,
    '',
  ].join('\n');

  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600',
    },
  });
}
