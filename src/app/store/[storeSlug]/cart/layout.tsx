import type { Metadata } from 'next';
import { cookies, headers } from 'next/headers';
import { getTranslations } from 'next-intl/server';
import { storefront } from '@/lib/api';
import { getRequestMarketKey } from '@/lib/market.server';

// The cart page itself is a client component and so cannot export metadata.
// This layout exists only to mark the route noindex: a cart is per-visitor and
// has no standalone search value, and robots.txt alone cannot suppress a URL a
// crawler reaches from an external link.
const robots: Metadata['robots'] = { index: false, follow: true };

// Without a title of its own the route inherited the store SEO meta title
// (English). The locale is resolved as the store layout does: the `?lang`
// the proxy forwards (cookie / x-locale header), else the store primary.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ storeSlug: string }>;
}): Promise<Metadata> {
  const { storeSlug } = await params;
  try {
    const cookieStore = await cookies();
    const requestHeaders = await headers();
    const urlLocale = cookieStore.get('x-store-locale')?.value || requestHeaders.get('x-locale');
    const store = (await storefront.getStore(storeSlug, await getRequestMarketKey())) as {
      name?: string;
      language_config?: { primary_locale?: string } | null;
      theme?: { translations?: Record<string, { name?: string }> };
    };
    const primaryLocale = store?.language_config?.primary_locale || 'en';
    const locale = urlLocale || primaryLocale;
    const t = await getTranslations({ locale });
    const storeName = store?.theme?.translations?.[locale]?.name || store?.name || storeSlug;
    return { title: `${t('cart.title')} | ${storeName}`, robots };
  } catch {
    return { robots };
  }
}

export default function CartLayout({ children }: { children: React.ReactNode }) {
  return children;
}
