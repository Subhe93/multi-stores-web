import { storefront } from '@/lib/api';

interface SitemapPage {
  slug: string;
  lastmod: string | Date;
}

interface SitemapData {
  locales: string[];
  primaryLocale: string;
  home: { lastmod: string | Date } | null;
  static_pages: SitemapPage[];
  landing_pages: SitemapPage[];
  products: SitemapPage[];
}

interface RouteCtx {
  params: Promise<{ storeSlug: string }>;
}

// XML escape — sitemap URLs can technically contain & in query strings.
function xe(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Format a date for <lastmod>. Accepts both Date objects and ISO strings (the
// API serialises Date → ISO over JSON).
function toIso(d: string | Date): string {
  return (typeof d === 'string' ? new Date(d) : d).toISOString();
}

/**
 * Per-store sitemap. Lists home + static + landing + product URLs, each with
 * xhtml:link alternates for every locale the store supports + an x-default
 * pointing at the primary locale. This is the shape Google uses for hreflang.
 *
 * URL pattern matches the storefront router: ?lang= is the locale switch.
 */
export async function GET(_req: Request, ctx: RouteCtx) {
  const { storeSlug } = await ctx.params;
  let data: SitemapData;
  try {
    data = (await storefront.getSitemapData(storeSlug)) as SitemapData;
  } catch {
    return new Response('Not found', { status: 404 });
  }

  // The storefront origin is the request origin, not the API origin. Reading
  // env keeps this dev-friendly without leaking the api host into XML.
  const origin =
    process.env.NEXT_PUBLIC_WEB_URL ||
    process.env.NEXT_PUBLIC_STOREFRONT_ORIGIN ||
    'http://localhost:3003';
  const base = `${origin.replace(/\/$/, '')}/store/${storeSlug}`;

  const allLocales = data.locales.length ? data.locales : [data.primaryLocale];
  const primary = data.primaryLocale || allLocales[0];

  // Build one <url> entry. `path` is everything after /store/<slug>; '' for home.
  function urlEntry(path: string, lastmod: string | Date): string {
    const localized = (loc: string) =>
      `${base}${path}${path.includes('?') ? '&' : '?'}lang=${loc}`;
    const canonical = `${base}${path}${path.includes('?') ? '&' : '?'}lang=${primary}`;

    const alternates = allLocales
      .map(
        (loc) =>
          `    <xhtml:link rel="alternate" hreflang="${xe(loc)}" href="${xe(localized(loc))}" />`,
      )
      .join('\n');

    return [
      '  <url>',
      `    <loc>${xe(canonical)}</loc>`,
      `    <lastmod>${toIso(lastmod)}</lastmod>`,
      alternates,
      `    <xhtml:link rel="alternate" hreflang="x-default" href="${xe(canonical)}" />`,
      '  </url>',
    ].join('\n');
  }

  const entries: string[] = [];

  if (data.home) entries.push(urlEntry('', data.home.lastmod));
  for (const p of data.static_pages) entries.push(urlEntry(`/${p.slug}`, p.lastmod));
  for (const p of data.landing_pages) entries.push(urlEntry(`/p/${p.slug}`, p.lastmod));
  for (const p of data.products) entries.push(urlEntry(`/products/${p.slug}`, p.lastmod));

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    entries.join('\n'),
    '</urlset>',
  ].join('\n');

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      // 5-minute CDN cache — sitemaps don't need to be real-time fresh and the
      // storefront aggregator query touches several tables.
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600',
    },
  });
}
