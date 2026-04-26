import { NextRequest, NextResponse } from 'next/server';
import { locales, defaultLocale } from '@/i18n/config';

// Main platform hostnames — everything else is treated as a store subdomain.
// Configurable via NEXT_PUBLIC_PLATFORM_HOSTS (comma-separated list).
const PLATFORM_HOSTNAMES = (
  process.env.NEXT_PUBLIC_PLATFORM_HOSTS ||
  'localhost,iwings-digital.com,www.iwings-digital.com'
)
  .split(',')
  .map((h) => h.trim().toLowerCase())
  .filter(Boolean);

const PLATFORM_DOMAIN =
  process.env.NEXT_PUBLIC_PLATFORM_DOMAIN || 'localhost';

function getStoreSlug(hostname: string): string | null {
  // Remove port if present (e.g. "my-store.localhost:3003" → "my-store.localhost")
  const host = hostname.split(':')[0]!.toLowerCase();

  // Main platform — not a store
  if (PLATFORM_HOSTNAMES.includes(host)) return null;

  // Subdomain: "my-store.localhost" or "my-store.iwings-digital.com"
  const parts = host.split('.');
  if (parts.length >= 2) return parts[0]!;

  return null;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hostname = request.headers.get('host') || '';

  // Always pass through static files and internal Next.js routes
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  const storeSlug = getStoreSlug(hostname);

  // ── Store subdomain (or custom domain in the future) ──────────────────────
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
