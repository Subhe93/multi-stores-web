import { NextRequest, NextResponse } from 'next/server';
import { locales, defaultLocale } from '@/i18n/config';
import type { MarketRoute } from '@/lib/market';
import {
  decideStoreRoute,
  detectVisitorCountry,
  isBotUserAgent,
  pickSuggestedMarket,
} from '@/lib/market-routing';

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
  /** Platform host whose market-context call failed open (L11): cached with
   *  the negative TTL so a recovering API is picked up quickly. */
  legacy?: true;
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
// spoof a market); every branch strips them before forwarding.
const MARKET_REQUEST_HEADERS = ['x-market', 'x-market-locale', 'x-market-suggest', 'x-market-geo'];
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
  const legacy: HostRoute = { slug, market: null, markets: [], redirectTo: null, legacy: true };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HOST_LOOKUP_TIMEOUT_MS);
  try {
    const res = await fetch(
      `${API_URL}/stores/${encodeURIComponent(slug)}/market-context`,
      { cache: 'no-store', signal: controller.signal },
    );
    if (!res.ok) return legacy;
    type Ctx = { enabled?: boolean; market?: unknown; markets?: unknown };
    const body = (await res.json()) as Ctx & { data?: Ctx };
    const data = body.data ?? body;
    // App disabled is a definitive answer (positive TTL); only failures are
    // flagged legacy.
    if (data.enabled !== true) return { slug, market: null, markets: [], redirectTo: null };
    if (!isLiveMarket(data.market)) return legacy;
    return { slug, market: data.market, markets: normalizeMarkets(data.markets), redirectTo: null };
  } catch {
    return legacy;
  } finally {
    clearTimeout(timer);
  }
}

async function resolveHost(host: string, platformSlug: string | null): Promise<HostRoute | null> {
  if (!platformSlug && !HOSTNAME_RE.test(host)) return null;

  const now = Date.now();
  const cached = domainCache.get(host);
  if (cached && cached.expiresAt > now) return cached.route;

  const route = platformSlug
    ? await fetchPlatformHostRoute(platformSlug)
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
      return await resolveHost(host, slug);
    }
  }

  // Not a platform host → treat as custom CNAME, resolve via API
  return await resolveHost(host, null);
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hostname = request.headers.get('host') || '';

  // Bypass static files and internal Next.js routes BEFORE resolving the store
  // slug — slug resolution can hit the API for custom domains, and we don't
  // want that latency added to every /logo.png or /_next/* request. Sitemap
  // and robots are excluded from the dot-bypass because they need slug routing.
  const isSitemapOrRobots =
    pathname === '/sitemap.xml' || pathname === '/robots.txt';
  if (
    !isSitemapOrRobots &&
    (pathname.startsWith('/_next') ||
      pathname.startsWith('/api') ||
      pathname.startsWith('/builder-preview') ||
      pathname.includes('.'))
  ) {
    return NextResponse.next();
  }

  const route = await resolveStoreHost(hostname);
  const storeSlug = route?.slug ?? null;

  // A market domain configured as an alias (www → apex) 301s to its target
  // host, keeping path + query.
  if (route?.redirectTo) {
    return NextResponse.redirect(
      `https://${route.redirectTo}${pathname}${request.nextUrl.search}`,
      301,
    );
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

    if (decision.kind === 'notfound') {
      const newUrl = request.nextUrl.clone();
      newUrl.pathname = decision.storePath;
      const response = NextResponse.rewrite(newUrl, {
        request: { headers: requestHeaders },
        status: decision.status,
      });
      response.headers.set('x-store-slug', storeSlug);
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
    // as a weak fallback; never redirects, skipped for bots and once the
    // visitor dismissed the banner.
    const dismissed = request.cookies.get('ms-market-suggest-dismissed')?.value === '1';
    if (!dismissed && !isBotUserAgent(request.headers.get('user-agent'))) {
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
