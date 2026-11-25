import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { storefront } from '@/lib/api';
import { isDefinitiveNotFound, StoreUnavailableError } from '@/lib/apiAvailability';
import { getRequestMarket } from '@/lib/market.server';
import { isAppEnabled, type StorefrontApps } from '@/lib/storeApps';
import { ReviewWriteClient } from '@/components/product/reviews/ReviewWriteClient';

// Write / edit a product review (M171, store app `reviews`). Reached from
// the product page and the account order page (`?product=<id>`, signed-in
// customer) or from a review link (`#token=…`, no login). The link token is
// a credential: the page is never indexable and sends no Referer, so a
// request made before the client strips the fragment cannot leak the URL.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface ReviewWritePageProps {
  params: Promise<{ storeSlug: string }>;
  searchParams: Promise<{ product?: string | string[]; [key: string]: string | string[] | undefined }>;
}

export default async function ReviewWritePage({ params, searchParams }: ReviewWritePageProps) {
  const { storeSlug } = await params;
  const { product } = await searchParams;

  let store: { apps?: StorefrontApps | null } | null;
  try {
    store = (await storefront.getStore(storeSlug, await getRequestMarket())) as { apps?: StorefrontApps | null } | null;
  } catch (err) {
    if (isDefinitiveNotFound(err)) notFound();
    throw new StoreUnavailableError();
  }
  // App off: the page does not exist (and the API refuses every review call).
  if (!isAppEnabled(store, 'reviews')) notFound();

  // Only a well-formed product id reaches the client; anything else is the
  // same as no parameter.
  const productId = typeof product === 'string' && UUID.test(product.trim()) ? product.trim().toLowerCase() : null;

  return <ReviewWriteClient storeSlug={storeSlug} productId={productId} />;
}
