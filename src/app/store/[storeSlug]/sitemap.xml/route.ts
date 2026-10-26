import { storefront } from '@/lib/api';
import { buildStoreOrigin, buildStoreAlternates, storeLocalePath } from '@/lib/storeUrl';
import { requestMarketRef, requestNoindex, type MarketRoute } from '@/lib/market';

interface SitemapPage {
  slug: string;
  lastmod: string | Date;
  /** Markets app only: translated slug per locale (products). */
  slugs?: Record<string, string>;
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
  /** Markets app only (M1-DESIGN §4.3): present when `?market=` was sent. */
  market?: MarketRoute | null;
  markets?: MarketRoute[];
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
export async function GET(req: Request, ctx: RouteCtx) {
  const { storeSlug } = await ctx.params;
  // Market of the request host (markets app) — forwarded by the proxy. A
  // market-preview host never reaches this handler (the proxy answers an
  // empty sitemap itself); the flag is read for completeness.
  const marketKey = requestMarketRef(req.headers);
  let data: SitemapData;
  try {
    data = (await storefront.getSitemapData(storeSlug, marketKey)) as SitemapData;
  } catch {
    return new Response('Not found', { status: 404 });
  }

  // Canonical store base = the subdomain origin (custom_domain wins). The
  // internal `/store/{slug}` path is a routing detail and must never appear
  // in the sitemap, otherwise Google crawls the proxy redirect instead.
  let customDomain: string | null = null;
  try {
    const store = (await storefront.getStore(storeSlug, marketKey)) as { custom_domain?: string | null };
    customDomain = store?.custom_domain || null;
  } catch {
    customDomain = null;
  }

  // Request the proxy flagged noindex (M6.1 `x-store-noindex`: NEVER, or
  // AUTO on the platform subdomain): nothing to advertise. robots.txt still
  // allows crawling so the pages' noindex can be read.
  const xml = requestNoindex(req.headers)
    ? wrapUrlset([])
    : marketKey && data.market
      ? buildMarketSitemap(storeSlug, data, data.market, customDomain)
      : buildLegacySitemap(storeSlug, data, customDomain);

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      // 5-minute CDN cache — sitemaps don't need to be real-time fresh and the
      // storefront aggregator query touches several tables.
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600',
    },
  });
}

function wrapUrlset(entries: string[]): string {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    entries.join('\n'),
    '</urlset>',
  ].join('\n');
}

// Stores without the markets app: one <url> per page (primary slug), one
// origin, language-only alternates — exactly the previous output.
function buildLegacySitemap(storeSlug: string, data: SitemapData, customDomain: string | null): string {
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

  return wrapUrlset(entries);
}

// Markets app (M1-DESIGN §4.3): one <url> per page × locale of THIS market,
// each with alternates across every LIVE market (same helper as the pages'
// metadata, so hreflang codes match). Products use their translated slug per
// locale when the API provides one.
function buildMarketSitemap(
  storeSlug: string,
  data: SitemapData,
  market: MarketRoute,
  customDomain: string | null,
): string {
  const base = buildStoreOrigin(storeSlug, customDomain, market);
  const primary = market.default_locale;
  const marketLocales = Array.from(new Set([primary, ...market.locales]));
  const markets = data.markets?.length ? data.markets : [market];

  function urlEntries(path: string, lastmod: string | Date, pathByLocale?: Record<string, string>): string[] {
    return marketLocales.map((loc) => {
      const { canonical, languages } = buildStoreAlternates({
        origin: base,
        locale: loc,
        primaryLocale: primary,
        secondaryLocales: market.locales,
        path,
        markets,
        storeSlug,
        storeCustomDomain: customDomain,
        pathByLocale,
      });
      const alternates = Object.entries(languages)
        .map(([code, href]) => `    <xhtml:link rel="alternate" hreflang="${xe(code)}" href="${xe(href)}" />`)
        .join('\n');
      return [
        '  <url>',
        `    <loc>${xe(canonical)}</loc>`,
        `    <lastmod>${toIso(lastmod)}</lastmod>`,
        alternates,
        '  </url>',
      ].join('\n');
    });
  }

  const entries: string[] = [];
  if (data.home) entries.push(...urlEntries('', data.home.lastmod));
  for (const p of data.static_pages) entries.push(...urlEntries(`/${p.slug}`, p.lastmod));
  for (const p of data.landing_pages) entries.push(...urlEntries(`/p/${p.slug}`, p.lastmod));
  for (const p of data.products) {
    const pathByLocale: Record<string, string> = {};
    for (const [loc, slug] of Object.entries(p.slugs ?? {})) {
      if (slug) pathByLocale[loc] = `/products/${slug}`;
    }
    entries.push(...urlEntries(`/products/${p.slug}`, p.lastmod, pathByLocale));
  }
  for (const c of data.collections ?? []) entries.push(...urlEntries(`/collections/${c.slug}`, c.lastmod));
  for (const p of data.legal_pages ?? []) entries.push(...urlEntries(`/legal/${p.slug}`, p.lastmod));
  entries.push(...urlEntries('/products', data.home?.lastmod ?? new Date()));

  return wrapUrlset(entries);
}
