import { NextRequest, NextResponse } from 'next/server';
import { locales, defaultLocale } from '@/i18n/config';

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
  // eslint-disable-next-line no-console
  console.error(
    '[proxy] NEXT_PUBLIC_API_URL is not set — custom domain lookups will fail',
  );
}

// Module-level cache for custom-domain → slug lookups. A short TTL keeps
// lookups fresh without an explicit invalidation channel: when a creator
// changes their custom domain it propagates within ~60s. Negative results
// use a much shorter TTL so a newly-registered domain isn't shadowed by a
// stale "not found" entry from an earlier scan.
type DomainCacheEntry = { slug: string | null; expiresAt: number };
const POSITIVE_TTL_MS = 60_000;
const NEGATIVE_TTL_MS = 10_000;
const domainCache = new Map<string, DomainCacheEntry>();

// Cheap pre-check before hitting the API: only call the API if the host looks
// like a real domain. Saves API calls for `localhost`, single-label internal
// hostnames, and bogus scanner traffic.
const HOSTNAME_RE = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/i;

async function resolveCustomDomainSlug(host: string): Promise<string | null> {
  if (!HOSTNAME_RE.test(host)) return null;

  const now = Date.now();
  const cached = domainCache.get(host);
  if (cached && cached.expiresAt > now) return cached.slug;

  let slug: string | null = null;
  try {
    const res = await fetch(
      `${API_URL}/stores/by-domain/${encodeURIComponent(host)}`,
      { cache: 'no-store' },
    );
    if (res.ok) {
      // API wraps responses via TransformInterceptor: { success, data, timestamp }.
      // Read `data.slug` first; fall back to a bare `slug` in case the interceptor
      // is ever disabled for this route.
      const body = (await res.json()) as {
        slug?: string;
        data?: { slug?: string };
      };
      slug = body.data?.slug ?? body.slug ?? null;
    }
  } catch {
    // Network error — fall through with slug=null and cache it briefly so we
    // don't stall on every request if the API is momentarily unreachable.
  }

  const ttl = slug ? POSITIVE_TTL_MS : NEGATIVE_TTL_MS;
  domainCache.set(host, { slug, expiresAt: now + ttl });
  return slug;
}

async function resolveStoreSlug(hostname: string): Promise<string | null> {
  const host = hostname.split(':')[0]!.toLowerCase();

  // Main platform — not a store
  if (PLATFORM_HOSTNAMES.includes(host)) return null;

  // Platform subdomain: "my-store.localhost" or "my-store.iwings-digital.com"
  for (const platformHost of PLATFORM_HOSTNAMES) {
    if (host.endsWith('.' + platformHost)) {
      const subdomain = host.slice(0, -(platformHost.length + 1));
      return subdomain.split('.')[0] || null;
    }
  }

  // Not a platform host → treat as custom CNAME, resolve via API
  return await resolveCustomDomainSlug(host);
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

  const storeSlug = await resolveStoreSlug(hostname);

  // /sitemap.xml and /robots.txt: subdomain serves the store-scoped routes;
  // platform domain serves them at the root (passthrough).
  if (isSitemapOrRobots) {
    if (storeSlug) {
      const newUrl = request.nextUrl.clone();
      newUrl.pathname = `/store/${storeSlug}${pathname}`;
      const requestHeaders = new Headers(request.headers);
      requestHeaders.set('x-store-slug', storeSlug);
      return NextResponse.rewrite(newUrl, { request: { headers: requestHeaders } });
    }
    return NextResponse.next();
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
    const requestHeaders = new Headers(request.headers);
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
      const target = `${protocol}://${slug}.${PLATFORM_DOMAIN}${port ? ':' + port : ''}${rest}`;
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

  // /ar/... or /tr/... → pass through as-is
  if (pathnameLocale) {
    const response = NextResponse.next();
    response.headers.set('x-locale', pathnameLocale);
    return response;
  }

  // No locale prefix → rewrite internally to /en/... without changing the URL
  const newUrl = request.nextUrl.clone();
  newUrl.pathname = `/${defaultLocale}${pathname}`;
  const response = NextResponse.rewrite(newUrl);
  response.headers.set('x-locale', defaultLocale);
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
