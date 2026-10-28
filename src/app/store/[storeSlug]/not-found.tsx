import { headers } from 'next/headers';
import { StoreNotFoundView } from '@/components/layout/StoreNotFoundView';

// Store 404: rendered inside the store layout (header/footer chrome stays)
// whenever a storefront route calls `notFound()` — unknown product,
// collection, static page or slug. Next sends it with a 404 status.
export default async function StoreNotFound() {
  // The proxy forwards `x-locale` only when the URL carries a locale prefix
  // (secondary locales); the primary locale has clean paths, same as the
  // server pages that build links from `?lang`.
  const urlLocale = (await headers()).get('x-locale');
  const lp = urlLocale ? `/${urlLocale}` : '';
  return <StoreNotFoundView lp={lp} />;
}
