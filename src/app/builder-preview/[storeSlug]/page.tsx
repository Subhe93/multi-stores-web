import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { NextIntlClientProvider } from 'next-intl';
import { storefront } from '@/lib/api';
import { toListingProduct } from '@/lib/listing';
import { BuilderPreviewClient } from '@/themes/BuilderPreviewClient';
import { StoreProviders } from '@/components/providers/StoreProviders';
import { locales, defaultLocale } from '@/i18n/config';
import type { StoreHero } from '@/lib/hero';
import type {
  ListingCollection,
  ListingContext,
  ProductContext,
  StoreContext,
  ThemeCustomizations,
} from '@/themes/types';

interface StoreLite {
  name?: string;
  description?: string;
  logo_url?: string;
  theme_key?: string;
  theme_customizations?: ThemeCustomizations;
  theme?: { hero?: StoreHero };
  currency?: string;
  pages?: Array<{ slug: string; translations: { locale: string; title: string }[] }>;
  language_config?: {
    primary_locale?: string;
    secondary_locales?: string[];
  } | null;
}

interface BuilderPreviewProps {
  params: Promise<{ storeSlug: string }>;
  searchParams: Promise<{ locale?: string; type?: string }>;
}

// Builder preview route. Lives outside /store/[storeSlug] so it does not
// inherit the production header/footer chrome — the iframe is a clean canvas
// the dashboard drives via postMessage. When previewing a PRODUCT_TEMPLATE,
// the route grabs a real published product so magic sections render with live
// data; CATALOG_TEMPLATE / COLLECTION_TEMPLATE get a sample listing built from
// the store's live products and collections. StoreProviders wraps the tree so client sections (AddToCart) can use
// the cart hook even though no item is actually addable here.
export default async function BuilderPreviewPage({
  params,
  searchParams,
}: BuilderPreviewProps) {
  const { storeSlug } = await params;
  const { locale, type } = await searchParams;

  let store: StoreLite;
  try {
    store = (await storefront.getStore(storeSlug)) as StoreLite;
  } catch {
    notFound();
  }

  const primaryLocale = store.language_config?.primary_locale || 'en';
  const secondaryLocales = store.language_config?.secondary_locales || [];
  const themeKey = store.theme_key || 'minimal';
  const customizations = store.theme_customizations || {};
  const currency = store.currency || 'EUR';

  let sampleProduct: ProductContext | undefined;
  if (type === 'PRODUCT_TEMPLATE') {
    try {
      const p = (await storefront.getSampleProduct(storeSlug)) as ProductContext | null;
      if (p) sampleProduct = p;
    } catch {
      // Soft-fail — the magic section placeholders show a helpful empty state.
    }
  }

  // Sample listing for the listing templates. Mirrors what the /products and
  // /collections/[handle] routes inject, minus filters: the first 12 products
  // (the API ignores `limit` today, so we also slice) and the creator
  // category tree. COLLECTION_TEMPLATE stands in the first active collection
  // for the real handle. Soft-fails to undefined so the section shows its
  // placeholder instead of the preview crashing.
  let listing: ListingContext | undefined;
  if (type === 'CATALOG_TEMPLATE' || type === 'COLLECTION_TEMPLATE') {
    try {
      const isCollection = type === 'COLLECTION_TEMPLATE';
      const previewLocale = locale || primaryLocale;
      const tree = ((await storefront.getCreatorCategories(storeSlug)) as ListingCollection[] | null) || [];
      const flatten = (nodes: ListingCollection[]): ListingCollection[] =>
        nodes.flatMap((n) => [n, ...flatten(n.children || [])]);
      const collection = isCollection ? flatten(tree).find((c) => c.is_active !== false) : undefined;
      if (!isCollection || collection) {
        const params: Record<string, string> = { locale: previewLocale, limit: '12' };
        if (collection) params.creator_category = collection.slug;
        const products = (((await storefront.getProducts(storeSlug, params)) as Record<string, any>[] | null) || [])
          .slice(0, 12)
          .map(toListingProduct);
        listing = {
          kind: isCollection ? 'collection' : 'catalog',
          products,
          collections: tree,
          collection,
          query: {},
          hero: isCollection ? store.theme?.hero?.collections : store.theme?.hero?.products,
          basePath: collection ? `/collections/${collection.slug}` : '/products',
          isFiltered: false,
        };
      }
    } catch {
      listing = undefined;
    }
  }

  // Navigation menus so chrome sections (Header/Footer) resolve a selected
  // menu key in the preview exactly as they do on the live storefront.
  let menus: StoreContext['menus'] = [];
  try {
    menus = (await storefront.getMenus(storeSlug)) as StoreContext['menus'];
  } catch {
    menus = [];
  }

  const storeContext: StoreContext = {
    storeName: store.name || '',
    storeDescription: store.description,
    logoUrl: store.logo_url,
    primaryLocale,
    secondaryLocales,
    pages: (store.pages || []) as StoreContext['pages'],
    menus,
  };

  // This route lives outside the locale middleware, so load messages directly
  // for the preview locale and provide them. Needed by sections that reuse
  // storefront components built on next-intl (e.g. the product-page section,
  // which renders ProductDetailClient → useTranslations).
  const activeLocale = locale && (locales as readonly string[]).includes(locale) ? locale : (
    (locales as readonly string[]).includes(primaryLocale) ? primaryLocale : defaultLocale
  );
  const messages = (await import(`@/i18n/messages/${activeLocale}.json`)).default;

  return (
    <StoreProviders locale={activeLocale}>
      <NextIntlClientProvider locale={activeLocale} messages={messages}>
        <BuilderPreviewClient
          storeSlug={storeSlug}
          initial={{
            themeKey,
            customizations,
            sections: [],
            locale: locale || primaryLocale,
            primaryLocale,
            product: sampleProduct,
            listing,
            currency,
            storeContext,
          }}
        />
      </NextIntlClientProvider>
    </StoreProviders>
  );
}

export const dynamic = 'force-dynamic';

// An editing surface that renders a store's unpublished draft — it must never
// be indexed, and it duplicates real storefront content if it were.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};
