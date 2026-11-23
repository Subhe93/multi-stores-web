import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { canonicalRedirectHref, isNonCanonicalSlugForm, routeSlug } from '@/lib/slugRoute';
import { getRequestPathPrefix } from '@/lib/market.server';
import { redirectFocusedBrowsing } from '@/lib/focusedStorefront.server';
import { buildStorePageMetadata, fetchStorePage, StorePageView } from '@/components/store/StorePageView';

// Static / landing store pages served at the store root. Rendering (v2
// builder sections or the legacy StaticPage html) lives in StorePageView,
// shared with `/legal/{slug}` which shows a store's own legal page. A
// legal-kind page keeps its own URL but is canonical at `/legal/{slug}`.

interface PageProps {
  params: Promise<{ storeSlug: string; pageSlug: string }>;
  searchParams: Promise<{ lang?: string; [key: string]: string | string[] | undefined }>;
}

// Avoid colliding with sibling routes that share the [pageSlug] segment.
// Compared against the normalized slug, so `/Cart` is reserved like `/cart`.
const RESERVED_SLUGS = new Set(['products', 'cart', 'checkout', 'auth', 'account', 'collections', 'legal', 'p', 'market-not-found']);

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const { storeSlug, pageSlug: rawSlug } = await params;
  // Next hands the param percent-encoded; lookups use the decoded,
  // NFC, lowercase form (the API encodes it once).
  const pageSlug = routeSlug(rawSlug);
  if (RESERVED_SLUGS.has(pageSlug)) return {};
  const { lang } = await searchParams;

  const data = await fetchStorePage(storeSlug, pageSlug);
  return buildStorePageMetadata({ storeSlug, pageSlug, lang, data });
}

export default async function StoreStaticPage({ params, searchParams }: PageProps) {
  const { storeSlug, pageSlug: rawSlug } = await params;
  // Next hands the param percent-encoded; lookups use the decoded,
  // NFC, lowercase form (the API encodes it once).
  const pageSlug = routeSlug(rawSlug);
  const query = await searchParams;
  const { lang } = query;

  if (RESERVED_SLUGS.has(pageSlug)) notFound();

  const data = await fetchStorePage(storeSlug, pageSlug);

  // M166 D2: the same page requested in another letter case or Unicode form
  // (`/Kontakta-Oss`, NFD) gets one 308 to the stored slug, like products and
  // collections; query and locale/market prefix are kept. The stored slug is
  // the fixed point (and a `%`-holding one is refused), so it cannot loop.
  // Runs before the focused-storefront 307 (canonical form first).
  const storedSlug = data.v2?.slug ?? data.legacy?.slug;
  if ((data.v2 || data.legacy) && storedSlug && isNonCanonicalSlugForm(rawSlug, storedSlug)) {
    permanentRedirect(canonicalRedirectHref(`/${storedSlug}`, query, await getRequestPathPrefix()));
  }

  // Focused storefront: an existing content page leads to the external site
  // (307); legal and cookie pages are kept (decided from the store payload).
  // An unknown slug still answers the 404 below.
  if (data.v2 || data.legacy?.status === 'PUBLISHED') {
    await redirectFocusedBrowsing(storeSlug, `/${encodeURIComponent(pageSlug)}`);
  }

  return <StorePageView storeSlug={storeSlug} pageSlug={pageSlug} lang={lang} data={data} />;
}

// Storefront reads are tagged with the store (see lib/api.ts) and refreshed
// on-demand via /api/revalidate when the creator publishes, so cached data
// stays fresh without forcing a dynamic render on every request.
