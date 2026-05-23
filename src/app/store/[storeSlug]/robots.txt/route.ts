import { buildStoreOrigin } from '@/lib/storeUrl';
import { storefront } from '@/lib/api';

interface RouteCtx {
  params: Promise<{ storeSlug: string }>;
}

/**
 * Per-store robots.txt served from the store's subdomain. Disallow paths and
 * the sitemap URL are subdomain-rooted (e.g. `/cart`, not `/store/slug/cart`)
 * — that's the URL form crawlers actually see, because the proxy rewrites
 * `subdomain/*` → `/store/slug/*` internally.
 */
export async function GET(_req: Request, ctx: RouteCtx) {
  const { storeSlug } = await ctx.params;

  // Resolve the store's canonical origin (custom_domain wins, else subdomain).
  let customDomain: string | null = null;
  try {
    const store = (await storefront.getStore(storeSlug)) as { custom_domain?: string | null };
    customDomain = store?.custom_domain || null;
  } catch {
    customDomain = null;
  }
  const origin = buildStoreOrigin(storeSlug, customDomain);

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
