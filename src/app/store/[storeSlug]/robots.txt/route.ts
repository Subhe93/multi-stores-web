interface RouteCtx {
  params: Promise<{ storeSlug: string }>;
}

/**
 * Per-store robots.txt. Allows everything by default, blocks the carts/checkout
 * /account/auth paths from indexing, and points crawlers at the store's sitemap.
 * Each store's robots is independent so stores can later opt out.
 */
export async function GET(_req: Request, ctx: RouteCtx) {
  const { storeSlug } = await ctx.params;

  const origin =
    process.env.NEXT_PUBLIC_WEB_URL ||
    process.env.NEXT_PUBLIC_STOREFRONT_ORIGIN ||
    'http://localhost:3003';
  const sitemap = `${origin.replace(/\/$/, '')}/store/${storeSlug}/sitemap.xml`;

  const body = [
    'User-agent: *',
    'Allow: /',
    `Disallow: /store/${storeSlug}/cart`,
    `Disallow: /store/${storeSlug}/checkout`,
    `Disallow: /store/${storeSlug}/account`,
    `Disallow: /store/${storeSlug}/auth`,
    '',
    `Sitemap: ${sitemap}`,
    '',
  ].join('\n');

  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600',
    },
  });
}
