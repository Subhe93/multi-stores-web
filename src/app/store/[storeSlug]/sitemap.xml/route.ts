import { storefront } from '@/lib/api';
import { buildStoreOrigin, storeLocalePath } from '@/lib/storeUrl';

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
  collections?: SitemapPage[];
  legal_pages?: SitemapPage[];
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

  // Canonical store base = the subdomain origin (custom_domain wins). The
  // internal `/store/{slug}` path is a routing detail and must never appear
  // in the sitemap, otherwise Google crawls the proxy redirect instead.
  let customDomain: string | null = null;
  try {
    const store = (await storefront.getStore(storeSlug)) as { custom_domain?: string | null };
    customDomain = store?.custom_domain || null;
  } catch {
    customDomain = null;
  }
  const base = buildStoreOrigin(storeSlug, customDomain);

  const allLocales = data.locales.length ? data.locales : [data.primaryLocale];
  const primary = data.primaryLocale || allLocales[0];

  // Build one <url> entry. `path` is subdomain-relative ('' for home, `/p/foo`).
  // Primary locale = no prefix; secondary locales use `/{locale}/...` (Google
  // prefers path-prefix over query strings for hreflang).
  function urlEntry(path: string, lastmod: string | Date): string {
    const canonical = storeLocalePath(base, primary, primary, path);

    const alternates = allLocales
      .map(
        (loc) =>
          `    <xhtml:link rel="alternate" hreflang="${xe(loc)}" href="${xe(storeLocalePath(base, loc, primary, path))}" />`,
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
  // Collections and legal pages were both absent, so nothing pointed crawlers
  // at them. The listing page is included too — it is the catalogue entry point.
  for (const c of data.collections ?? []) entries.push(urlEntry(`/collections/${c.slug}`, c.lastmod));
  for (const p of data.legal_pages ?? []) entries.push(urlEntry(`/legal/${p.slug}`, p.lastmod));
  entries.push(urlEntry('/products', data.home?.lastmod ?? new Date()));

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
