import { headers } from 'next/headers';
import { StoreNotFoundView } from '@/components/layout/StoreNotFoundView';
import { requestPathPrefix } from '@/lib/market';
import { pageLinkPrefix } from '@/lib/localePaths';
import { ProductPreviewUnlock } from '@/components/layout/ProductPreview';
import { focusedBackToSite } from '@/lib/focusedStorefront.server';

// Store 404: rendered inside the store layout (header/footer chrome stays)
// whenever a storefront route calls `notFound()` — unknown product,
// collection, static page or slug. Next sends it with a 404 status.
export default async function StoreNotFound() {
  // The proxy forwards `x-locale` only when the URL carries a locale prefix
  // (secondary locales); the primary locale has clean paths, same as the
  // server pages that build links from `?lang`.
  const h = await headers();
  const urlLocale = h.get('x-locale');
  // M156: the proxy's path prefix on a locale-path market (`/de-at`).
  const lp = pageLinkPrefix(requestPathPrefix(h), urlLocale);
  // The proxy forwards the store slug of the host; the owner's draft-product
  // preview unlock needs it (nothing happens for other visitors).
  const storeSlug = h.get('x-store-slug');
  // Focused storefront: one "back to site" link instead of home / products
  // (both redirect there). Null for every other store.
  const backToSite = storeSlug ? await focusedBackToSite(storeSlug, urlLocale) : null;
  return (
    <>
      {storeSlug && <ProductPreviewUnlock storeSlug={storeSlug} />}
      <StoreNotFoundView lp={lp} backToSite={backToSite} />
    </>
  );
}
