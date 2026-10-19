import { NextRequest, NextResponse } from 'next/server';
import { locales, defaultLocale } from '@/i18n/config';
import type { MarketRoute } from '@/lib/market';
import {
  decideStoreRoute,
  detectVisitorCountry,
  isBotUserAgent,
  pickSuggestedMarket,
} from '@/lib/market-routing';
import { buildRedirectLocation, matchStoreRedirect } from '@/lib/redirects';

// Main platform hostnames — everything else is treated as a store subdomain
// or a custom CNAME. Configurable via NEXT_PUBLIC_PLATFORM_HOSTS.
const PLATFORM_HOSTNAMES = (
  process.env.NEXT_PUBLIC_PLATFORM_HOSTS ||
  'localhost,iwings-digital.com,www.iwings-digital.com'
)
  .split(',')
  .map((h) => h.trim().toLowerCase())
  .filter(Boolean);

const PLATFORM_DOMAIN =
  process.env.NEXT_PUBLIC_PLATFORM_DOMAIN || 'localhost';

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

// Fail loudly in prod if the API URL wasn't configured — silent localhost
// fallback would otherwise make every custom-domain lookup miss invisibly.
if (
  process.env.NODE_ENV === 'production' &&
  !process.env.NEXT_PUBLIC_API_URL
) {
  console.error(
    '[proxy] NEXT_PUBLIC_API_URL is not set — custom domain lookups will fail',
  );
}

// Module-level cache for host → store route lookups. A short TTL keeps
// lookups fresh without an explicit invalidation channel: when a creator
// changes their custom domain it propagates within ~60s. Negative results
// use a much shorter TTL so a newly-registered domain isn't shadowed by a
// stale "not found" entry from an earlier scan.
//
// Markets app (M1-DESIGN §4.1): the same entry carries the market resolved
// for the host (null = legacy store without the app) plus the store's other
// LIVE markets (for the country switcher / suggestion) and an optional
// `redirectTo` host (www → apex).
export type HostRoute = {
  slug: string;
  market: MarketRoute | null;
  markets: MarketRoute[];
  redirectTo: string | null;
  /** Store redirects version (M4.4 §6.4); null = no active redirects, and
   *  then the proxy makes no redirect lookup at all. */
  redirectsVersion: string | null;
  /** Platform host whose market-context call failed open (L11): cached with
   *  the negative TTL so a recovering API is picked up quickly. */
  legacy?: true;
  /** Market-preview host (`<slug>--<key>.<platform host>`): `market` may be
   *  DRAFT, the pages are noindex and the checkout is view-only. */
  preview?: true;
};
type DomainCacheEntry = { route: HostRoute | null; expiresAt: number };
const POSITIVE_TTL_MS = 60_000;
const NEGATIVE_TTL_MS = 10_000;
const domainCache = new Map<string, DomainCacheEntry>();
// Neither lookup may stall a request: the custom-host lookup times out to a
// miss (cached briefly), the market-context call to the legacy route (L11).
const HOST_LOOKUP_TIMEOUT_MS = 2_000;

// Cheap pre-check before hitting the API: only call the API if the host looks
// like a real domain. Saves API calls for `localhost`, single-label internal
// hostnames, and bogus scanner traffic.
const HOSTNAME_RE = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/i;

// Inbound copies of the headers we set must never be trusted (a client could
// spoof a market, or a preview of a DRAFT one); every branch strips them
// before forwarding.
const MARKET_REQUEST_HEADERS = ['x-market', 'x-market-locale', 'x-market-suggest', 'x-market-geo', 'x-market-preview'];
function stripMarketHeaders(h: Headers): Headers {
  for (const name of MARKET_REQUEST_HEADERS) h.delete(name);
  return h;
}

function isLiveMarket(value: unknown): value is MarketRoute {
  if (!value || typeof value !== 'object') return false;
  const m = value as Partial<MarketRoute>;
  return (
    typeof m.key === 'string' &&
    typeof m.default_locale === 'string' &&
    Array.isArray(m.locales) &&
    Array.isArray(m.countries) &&
    (m.status === undefined || m.status === 'LIVE')
  );
}

function normalizeMarkets(raw: unknown): MarketRoute[] {
  return Array.isArray(raw) ? raw.filter(isLiveMarket) : [];
}

/** A market the API resolved in preview mode (any status, `preview: true`). */
function isPreviewMarket(value: unknown): value is MarketRoute {
  if (!value || typeof value !== 'object') return false;
  const m = value as Partial<MarketRoute>;
  return (
    m.preview === true &&
    typeof m.key === 'string' &&
    typeof m.default_locale === 'string' &&
    Array.isArray(m.locales) &&
    Array.isArray(m.countries)
  );
}

// Market-preview host: `<slug>--<key>` as ONE label under a platform host,
// so the wildcard DNS record + certificate of `<slug>.<platform host>` cover
// it. Store slugs and market keys are both `[a-z0-9-]` with no leading /
// trailing hyphen; market keys never contain `--` (API validation), so the
// label splits on its only `--`. A label with no `--`, more than one, or an
// invalid half is not a preview (null) and keeps today's behaviour.
const PREVIEW_PART_RE = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;
export function parsePreviewLabel(label: string): { slug: string; key: string } | null {
  const parts = label.split('--');
  if (parts.length !== 2) return null;
  const [slug, key] = parts as [string, string];
  if (!PREVIEW_PART_RE.test(slug) || !PREVIEW_PART_RE.test(key)) return null;
  return { slug, key };
}

function readRedirectsVersion(raw: unknown): string | null {
  return typeof raw === 'string' && raw ? raw : null;
}

/** Custom host → `GET /stores/by-domain/:host` (slug + market + redirect). */
async function fetchCustomHostRoute(host: string): Promise<HostRoute | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HOST_LOOKUP_TIMEOUT_MS);
  try {
    const res = await fetch(
      `${API_URL}/stores/by-domain/${encodeURIComponent(host)}`,
      { cache: 'no-store', signal: controller.signal },
    );
    if (!res.ok) return null;
    // API wraps responses via TransformInterceptor: { success, data, timestamp }.
    // Read `data.*` first; fall back to bare fields in case the interceptor
    // is ever disabled for this route.
    type ByDomain = {
      slug?: string;
      redirect_to?: string | null;
      market?: unknown;
      markets?: unknown;
      redirects_version?: unknown;
    };
    const body = (await res.json()) as ByDomain & { data?: ByDomain };
    const data = body.data ?? body;
    const slug = data.slug ?? null;
    if (!slug) return null;
    const market = isLiveMarket(data.market) ? data.market : null;
    return {
      slug,
      market,
      markets: market ? normalizeMarkets(data.markets) : [],
      redirectTo: typeof data.redirect_to === 'string' && data.redirect_to ? data.redirect_to.toLowerCase() : null,
      redirectsVersion: readRedirectsVersion(data.redirects_version),
    };
  } catch {
    // Network error — the caller caches the miss briefly so we don't stall
    // on every request if the API is momentarily unreachable.
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Platform subdomain → `GET /stores/:slug/market-context`. Fails OPEN: any
 * error, non-2xx or timeout yields the legacy route (no market) so a store
 * without the app — or an API hiccup — never changes today's behaviour.
 */
async function fetchPlatformHostRoute(slug: string): Promise<HostRoute> {
  const legacy: HostRoute = {
    slug,
    market: null,
    markets: [],
    redirectTo: null,
    redirectsVersion: null,
    legacy: true,
  };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HOST_LOOKUP_TIMEOUT_MS);
  try {
    const res = await fetch(
      `${API_URL}/stores/${encodeURIComponent(slug)}/market-context`,
      { cache: 'no-store', signal: controller.signal },
    );
    if (!res.ok) return legacy;
    type Ctx = {
      enabled?: boolean;
      market?: unknown;
      markets?: unknown;
      redirects_version?: unknown;
    };
    const body = (await res.json()) as Ctx & { data?: Ctx };
    const data = body.data ?? body;
    const redirectsVersion = readRedirectsVersion(data.redirects_version);
    // App disabled is a definitive answer (positive TTL); only failures are
    // flagged legacy.
    if (data.enabled !== true) {
      return { slug, market: null, markets: [], redirectTo: null, redirectsVersion };
    }
    if (!isLiveMarket(data.market)) return { ...legacy, redirectsVersion };
    return {
      slug,
      market: data.market,
      markets: normalizeMarkets(data.markets),
      redirectTo: null,
      redirectsVersion,
    };
  } catch {
    return legacy;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Market-preview host → `GET /stores/:slug/market-context?market=<key>&preview=1`.
 * Definitive (store or market unknown, app off, non-2xx) and failed lookups
 * both yield null: the caller then falls back to the plain platform-subdomain
 * resolution of the whole label, i.e. the usual store-not-found (or a store
 * whose slug genuinely contains `--`).
 */
async function fetchPreviewHostRoute(slug: string, key: string): Promise<HostRoute | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HOST_LOOKUP_TIMEOUT_MS);
  try {
    const res = await fetch(
      `${API_URL}/stores/${encodeURIComponent(slug)}/market-context?market=${encodeURIComponent(key)}&preview=1`,
      { cache: 'no-store', signal: controller.signal },
    );
    if (!res.ok) return null;
    type Ctx = {
      enabled?: boolean;
      preview?: boolean;
      market?: unknown;
      markets?: unknown;
      redirects_version?: unknown;
    };
    const body = (await res.json()) as Ctx & { data?: Ctx };
    const data = body.data ?? body;
    if (data.enabled !== true || data.preview !== true) return null;
    if (!isPreviewMarket(data.market) || data.market.key !== key) return null;
    return {
      slug,
      market: data.market,
      markets: normalizeMarkets(data.markets),
      redirectTo: null,
      redirectsVersion: readRedirectsVersion(data.redirects_version),
      preview: true,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function resolveHost(
  host: string,
  platformSlug: string | null,
  preview: { slug: string; key: string } | null = null,
): Promise<HostRoute | null> {
  if (!platformSlug && !HOSTNAME_RE.test(host)) return null;

  const now = Date.now();
  const cached = domainCache.get(host);
  if (cached && cached.expiresAt > now) return cached.route;

  // A preview label that does not resolve is treated as the plain label.
  const route = platformSlug
    ? (preview ? await fetchPreviewHostRoute(preview.slug, preview.key) : null) ??
      (await fetchPlatformHostRoute(platformSlug))
    : await fetchCustomHostRoute(host);

  const ttl = route && !route.legacy ? POSITIVE_TTL_MS : NEGATIVE_TTL_MS;
  domainCache.set(host, { route, expiresAt: now + ttl });
  return route;
}

async function resolveStoreHost(hostname: string): Promise<HostRoute | null> {
  const host = hostname.split(':')[0]!.toLowerCase();

  // Main platform — not a store
  if (PLATFORM_HOSTNAMES.includes(host)) return null;

  // Platform subdomain: "my-store.localhost" or "my-store.iwings-digital.com".
  // The slug is derived locally; the market context is an extra (fail-open)
  // API call cached per host.
  for (const platformHost of PLATFORM_HOSTNAMES) {
    if (host.endsWith('.' + platformHost)) {
      const subdomain = host.slice(0, -(platformHost.length + 1));
      const slug = subdomain.split('.')[0] || null;
      if (!slug) return null;
      // `<slug>--<key>`: market preview (checked before anything else).
      return await resolveHost(host, slug, parsePreviewLabel(slug));
    }
  }

  // Not a platform host → treat as custom CNAME, resolve via API
  return await resolveHost(host, null);
}

/**
 * Next's default trailing-slash redirect (`/:path+/` → `/:path+`, 308, query
 * kept), re-implemented because `skipTrailingSlashRedirect` is on so the
 * store redirects get to see `/produkt/x/` first. Null when nothing to do.
 */
function stripTrailingSlash(request: NextRequest): NextResponse | null {
  const { pathname } = request.nextUrl;
  if (pathname.length < 2 || !pathname.endsWith('/')) return null;
  // A plain URL, not `nextUrl.clone()`: NextURL remembers the trailing slash
  // of the original request and puts it back when `pathname` is assigned.
  const target = new URL(request.url);
  target.pathname = pathname.replace(/\/+$/, '') || '/';
  return NextResponse.redirect(target, 308);
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hostname = request.headers.get('host') || '';

  // Internal Next.js routes bypass everything BEFORE resolving the store
  // slug (slug resolution can hit the API for custom domains). Sitemap and
  // robots need slug routing and are never bypassed.
  const isSitemapOrRobots =
    pathname === '/sitemap.xml' || pathname === '/robots.txt';
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/builder-preview')
  ) {
    return stripTrailingSlash(request) ?? NextResponse.next();
  }
  // Paths with a dot are static files (/logo.png) and are bypassed too, but
  // only AFTER the store redirects are checked: imported WordPress URLs such
  // as /produkt/x.html or /feed.xml must still 301. The host lookup this
  // costs is cached per host (domainCache), so static requests stay cheap.
  const isStaticLike = !isSitemapOrRobots && pathname.includes('.');

  const route = await resolveStoreHost(hostname);
  const storeSlug = route?.slug ?? null;

  // Store redirects (M4.4 §6.4): only when the host lookup reported a
  // `redirects_version`, so stores without redirects make no extra fetch.
  // Matching ignores the query; the Location keeps it. Fails open.
  if (storeSlug && route?.redirectsVersion && !isSitemapOrRobots) {
    const hit = await matchStoreRedirect(storeSlug, route.redirectsVersion, pathname);
    if (hit) {
      return NextResponse.redirect(
        new URL(buildRedirectLocation(hit.to, request.nextUrl.search), request.url),
        hit.status,
      );
    }
  }

  // Trailing slash (Next's own 308, moved here — `skipTrailingSlashRedirect`):
  // it runs AFTER the store redirects so an imported WordPress URL such as
  // `/produkt/x/` 301s to its target in one hop instead of 308 → 301.
  const slashRedirect = stripTrailingSlash(request);
  if (slashRedirect) return slashRedirect;

  if (isStaticLike) return NextResponse.next();

  // A market domain configured as an alias (www → apex) 301s to its target
  // host, keeping path + query.
  if (route?.redirectTo) {
    return NextResponse.redirect(
      `https://${route.redirectTo}${pathname}${request.nextUrl.search}`,
      301,
    );
  }

  // Market preview host: never crawlable. robots.txt disallows everything
  // and sitemap.xml is empty, answered here so no crawler ever sees the
  // draft market's URLs; every page below also gets X-Robots-Tag.
  if (isSitemapOrRobots && route?.preview) {
    const body =
      pathname === '/robots.txt'
        ? 'User-agent: *\nDisallow: /\n'
        : '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>\n';
    return new NextResponse(body, {
      status: 200,
      headers: {
        'content-type': pathname === '/robots.txt' ? 'text/plain; charset=utf-8' : 'application/xml; charset=utf-8',
        'cache-control': 'no-store',
        'x-robots-tag': 'noindex, nofollow',
      },
    });
  }

  // /sitemap.xml and /robots.txt: subdomain serves the store-scoped routes;
  // platform domain serves them at the root (passthrough).
  if (isSitemapOrRobots) {
    if (storeSlug) {
      const newUrl = request.nextUrl.clone();
      newUrl.pathname = `/store/${storeSlug}${pathname}`;
      const requestHeaders = stripMarketHeaders(new Headers(request.headers));
      requestHeaders.set('x-store-slug', storeSlug);
      if (route?.market) requestHeaders.set('x-market', route.market.key);
      return NextResponse.rewrite(newUrl, { request: { headers: requestHeaders } });
    }
    return NextResponse.next();
  }

  // ── Market store (markets app enabled for this host) ──────────────────────
  // Locale decision is the pure `decideStoreRoute` (unit-tested): the prefix
  // is matched against the market's locales, the default locale is never
  // prefixed (301), and a global locale this market does not serve is a 404.
  // Stores without a market skip this block entirely and fall through to the
  // legacy branch below, which is unchanged.
  if (storeSlug && route?.market) {
    const market = route.market;
    const decision = decideStoreRoute({
      storeSlug,
      pathname,
      search: request.nextUrl.search,
      market,
    });

    if (decision.kind === 'redirect') {
      const target = request.nextUrl.clone();
      const q = decision.location.indexOf('?');
      target.pathname = (q >= 0 ? decision.location.slice(0, q) : decision.location) || '/';
      target.search = q >= 0 ? decision.location.slice(q) : '';
      return NextResponse.redirect(target, decision.status);
    }

    const requestHeaders = stripMarketHeaders(new Headers(request.headers));
    requestHeaders.set('x-store-slug', storeSlug);
    requestHeaders.set('x-market', market.key);
    // Preview host: the server components forward `preview=1` to the API
    // (so a DRAFT market renders) and the pages are noindex.
    const preview = route.preview === true;
    if (preview) requestHeaders.set('x-market-preview', '1');

    if (decision.kind === 'notfound') {
      const newUrl = request.nextUrl.clone();
      newUrl.pathname = decision.storePath;
      const response = NextResponse.rewrite(newUrl, {
        request: { headers: requestHeaders },
        status: decision.status,
      });
      response.headers.set('x-store-slug', storeSlug);
      if (preview) response.headers.set('x-robots-tag', 'noindex, nofollow');
      response.cookies.set('x-store-locale', market.default_locale, { path: '/' });
      return response;
    }

    const newUrl = request.nextUrl.clone();
    newUrl.pathname = decision.storePath;
    if (decision.urlLocale) {
      newUrl.searchParams.set('lang', decision.urlLocale);
      requestHeaders.set('x-locale', decision.urlLocale);
    }

    // Geo suggestion (L7): CDN country header first, Accept-Language region
    // as a weak fallback; never redirects, skipped for bots, once the
    // visitor dismissed the banner, and on a preview host (the merchant is
    // looking at one specific market on purpose).
    const dismissed = request.cookies.get('ms-market-suggest-dismissed')?.value === '1';
    if (!preview && !dismissed && !isBotUserAgent(request.headers.get('user-agent'))) {
      const country = detectVisitorCountry({
        cfCountry: request.headers.get('cf-ipcountry'),
        vercelCountry: request.headers.get('x-vercel-ip-country'),
        acceptLanguage: request.headers.get('accept-language'),
      });
      const suggest = pickSuggestedMarket(country, market, route.markets);
      if (suggest && country) {
        requestHeaders.set('x-market-suggest', suggest);
        requestHeaders.set('x-market-geo', country);
      }
    }

    const response = NextResponse.rewrite(newUrl, {
      request: { headers: requestHeaders },
    });
    response.headers.set('x-store-slug', storeSlug);
    response.headers.set('x-market', market.key);
    if (preview) {
      response.headers.set('x-market-preview', '1');
      response.headers.set('x-robots-tag', 'noindex, nofollow');
    }
    // The cookie carries the effective locale (market default when the URL
    // is unprefixed) so request.ts / app/layout.tsx resolve it without a
    // store fetch. Legacy stores keep writing '' below.
    response.cookies.set('x-store-locale', decision.cookieLocale, { path: '/' });
    return response;
  }

  // ── Store subdomain or custom domain ──────────────────────────────────────
  if (storeSlug) {
    // Detect locale prefix in the URL (e.g. /ar/products → locale='ar', rest='/products')
    // The primary locale has no prefix; secondary locales use /[locale]/... prefix
    const urlLocale = locales.find(
      (l) => pathname.startsWith(`/${l}/`) || pathname === `/${l}`
    );

    // Strip locale prefix so the internal store path is always locale-free
    const storePath = urlLocale
      ? `/store/${storeSlug}${pathname.slice(`/${urlLocale}`.length) || '/'}`
      : `/store/${storeSlug}${pathname === '/' ? '' : pathname}`;

    const newUrl = request.nextUrl.clone();
    newUrl.pathname = storePath;

    // Propagate locale as a query param so pages can read it from searchParams
    if (urlLocale) {
      newUrl.searchParams.set('lang', urlLocale);
    }

    // Forward detected locale as a request header so the store layout can read it
    const requestHeaders = stripMarketHeaders(new Headers(request.headers));
    requestHeaders.set('x-store-slug', storeSlug);
    if (urlLocale) {
      requestHeaders.set('x-locale', urlLocale);
    }

    const response = NextResponse.rewrite(newUrl, {
      request: { headers: requestHeaders },
    });
    response.headers.set('x-store-slug', storeSlug);
    // Set locale cookie so the layout can read it reliably (headers can be lost in rewrites)
    response.cookies.set('x-store-locale', urlLocale || '', { path: '/' });
    return response;
  }

  // ── Main platform — locale routing ────────────────────────────────────────

  // Redirect direct /store/ access to subdomain (canonical URL)
  if (pathname.startsWith('/store/')) {
    const match = pathname.match(/^\/store\/([^/]+)(\/.*)?$/);
    if (match) {
      const slug = match[1];
      const rest = match[2] || '/';
      const port = hostname.split(':')[1];
      const protocol = PLATFORM_DOMAIN === 'localhost' ? 'http' : 'https';
      // Keep the query string: external redirects built from STOREFRONT_URL
      // (e.g. Kustom's checkout/confirmation URLs) carry `?orderId=…`.
      const target = `${protocol}://${slug}.${PLATFORM_DOMAIN}${port ? ':' + port : ''}${rest}${request.nextUrl.search}`;
      return NextResponse.redirect(target);
    }
  }

  // Detect locale prefix in URL
  const pathnameLocale = locales.find(
    (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`
  );

  // /en/... → redirect to /... (strip default locale from URL)
  if (pathnameLocale === defaultLocale) {
    const cleanPath = pathname.replace(`/${defaultLocale}`, '') || '/';
    const newUrl = request.nextUrl.clone();
    newUrl.pathname = cleanPath;
    return NextResponse.redirect(newUrl);
  }

  // /ar/... or /tr/... → pass through as-is. The locale goes on the REQUEST
  // headers as well, because only those are readable from a server component —
  // the root layout needs it to set <html lang>/<dir>.
  if (pathnameLocale) {
    const localeHeaders = new Headers(request.headers);
    localeHeaders.set('x-locale', pathnameLocale);
    const response = NextResponse.next({ request: { headers: localeHeaders } });
    response.headers.set('x-locale', pathnameLocale);
    return response;
  }

  // No locale prefix → rewrite internally to /en/... without changing the URL
  const newUrl = request.nextUrl.clone();
  newUrl.pathname = `/${defaultLocale}${pathname}`;
  const defaultHeaders = new Headers(request.headers);
  defaultHeaders.set('x-locale', defaultLocale);
  const response = NextResponse.rewrite(newUrl, {
    request: { headers: defaultHeaders },
  });
  response.headers.set('x-locale', defaultLocale);
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
