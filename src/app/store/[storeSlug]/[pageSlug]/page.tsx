import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { routeSlug } from '@/lib/slugRoute';
import { buildStorePageMetadata, fetchStorePage, StorePageView } from '@/components/store/StorePageView';

// Static / landing store pages served at the store root. Rendering (v2
// builder sections or the legacy StaticPage html) lives in StorePageView,
// shared with `/legal/{slug}` which shows a store's own legal page. A
// legal-kind page keeps its own URL but is canonical at `/legal/{slug}`.

interface PageProps {
  params: Promise<{ storeSlug: string; pageSlug: string }>;
  searchParams: Promise<{ lang?: string }>;
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
  const { lang } = await searchParams;

  if (RESERVED_SLUGS.has(pageSlug)) notFound();

  const data = await fetchStorePage(storeSlug, pageSlug);
  return <StorePageView storeSlug={storeSlug} pageSlug={pageSlug} lang={lang} data={data} />;
}

// Storefront reads are tagged with the store (see lib/api.ts) and refreshed
// on-demand via /api/revalidate when the creator publishes, so cached data
// stays fresh without forcing a dynamic render on every request.
