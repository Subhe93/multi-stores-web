import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Search, ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { storefront, resolveMediaUrl } from '@/lib/api';
import { buildStoreOrigin, storeLocalePath, buildStoreAlternates } from '@/lib/storeUrl';
import type { MarketRoute } from '@/lib/market';
import { getRequestMarket, getRequestNoindex } from '@/lib/market.server';
import { buildCollectionPage, buildBreadcrumb, ldJsonSafe } from '@/lib/jsonld';
import { findCollectionAncestors } from '@/lib/collectionPath';
import { ProductCard } from '@/components/product/ProductCard';
import { resolveHero, type StoreHero } from '@/lib/hero';
import { resolveTheme } from '@/themes/registry';
import { SectionRenderer } from '@/themes/SectionRenderer';
import type { ListingContext, SectionInstance } from '@/themes/types';
import { toListingProduct } from '@/lib/listing';
import { collectionIsNoindex, collectionMetaDescription, collectionMetaTitle } from '@/lib/collectionSeo';

interface ProductPromotion {
  type?: string;
  value?: unknown;
  translations?: { title?: string }[];
}

interface Product {
  id: string;
  base_price: number;
  /** b2b app only: estimated tax rate for the company net view. */
  tax_rate_bp?: number | null;
  compare_at_price?: number;
  created_at?: string;
  translations: { locale: string; title: string; slug: string }[];
  images: { url: string }[];
  promotions?: ProductPromotion[];
  vendor?: { company_name: string } | null;
}

interface CreatorCategoryTranslation {
  locale: string;
  name: string;
  description?: string | null;
  // M4.4 category SEO (optional; absent on stores that never set them).
  meta_title?: string | null;
  meta_desc?: string | null;
}

interface CreatorCategory {
  id: string;
  slug: string;
  is_active?: boolean;
  thumbnail_url?: string | null;
  noindex_when_empty?: boolean;
  published_product_count?: number;
  translations: CreatorCategoryTranslation[];
  children?: CreatorCategory[];
}

interface CollectionPageProps {
  params: Promise<{ storeSlug: string; handle: string }>;
  searchParams: Promise<{
    search?: string;
    lang?: string;
    sort?: string;
  }>;
}

// Flatten a tree of creator categories into a single list (for lookup by slug).
function flattenCreatorCategories(tree: CreatorCategory[]): CreatorCategory[] {
  const out: CreatorCategory[] = [];
  for (const node of tree) {
    out.push(node);
    if (node.children?.length) out.push(...flattenCreatorCategories(node.children));
  }
  return out;
}

function pickTranslation(
  translations: CreatorCategoryTranslation[] | undefined,
  locale: string,
): CreatorCategoryTranslation | undefined {
  if (!translations?.length) return undefined;
  return (
    translations.find((tr) => tr.locale === locale) ||
    translations.find((tr) => tr.locale === 'en') ||
    translations[0]
  );
}

export default async function CollectionPage({
  params,
  searchParams,
}: CollectionPageProps) {
  const { storeSlug, handle } = await params;
  const { search, lang, sort } = await searchParams;
  const t = await getTranslations();
  const lp = lang ? `/${lang}` : '';

  // Fetch the tree first so we can render the hero with the matching collection.
  // We also need the store currency for product prices.
  // The store is read first (cached): without a locale prefix in the URL the
  // collection is rendered in the store's primary locale, not in English.
  // Preview-aware market reference (a draft market on its preview host
  // needs `preview=1` on every read, not just the store payload).
  const marketRef = await getRequestMarket();
  const storeData = (await storefront.getStore(storeSlug, marketRef)) as {
      currency?: string;
      custom_domain?: string | null;
      market?: MarketRoute | null;
      markets?: MarketRoute[];
      language_config?: { primary_locale?: string } | null;
      theme?: { hero?: StoreHero };
      theme_key?: string;
    };
  const locale = lang || storeData?.language_config?.primary_locale || 'en';

  const [creatorCategoriesTree, template] = await Promise.all([
    storefront.getCreatorCategories(storeSlug) as Promise<CreatorCategory[]>,
    // Published COLLECTION_TEMPLATE snapshot; null when the creator hasn't
    // published one (or the endpoint is unavailable) — the built-in markup
    // below is the fallback in that case.
    storefront.getPublishedCollectionTemplate(storeSlug).catch(() => null) as Promise<{
      snapshot?: { sections?: SectionInstance[] };
    } | null>,
  ]);

  const flat = flattenCreatorCategories(creatorCategoriesTree || []);
  const collection = flat.find((c) => c.slug === handle && c.is_active !== false);
  if (!collection) notFound();

  const collectionTranslation = pickTranslation(collection.translations, locale);
  const collectionName = collectionTranslation?.name || handle;
  // Ancestors root → parent (M6 §3): the breadcrumb is Home › Collections ›
  // ancestors… › this. Inactive ancestors are skipped (their pages 404).
  const ancestors = findCollectionAncestors(creatorCategoriesTree || [], collection.id)
    .filter((a) => a.is_active !== false);
  const collectionDescription = collectionTranslation?.description || undefined;
  const currency = storeData?.currency;

  // Pull products filtered by this collection (backend resolves MANUAL vs TAGS).
  const queryParams: Record<string, string> = { locale, creator_category: handle };
  if (search) queryParams.search = search;
  const products = (await storefront.getProducts(
    storeSlug,
    queryParams,
    marketRef,
  )) as Product[];

  // Sort client-side (cheap, mirrors /products page behavior)
  if (sort === 'price_asc') {
    products.sort((a, b) => Number(a.base_price) - Number(b.base_price));
  } else if (sort === 'price_desc') {
    products.sort((a, b) => Number(b.base_price) - Number(a.base_price));
  } else if (sort === 'newest') {
    products.sort((a, b) =>
      (b.created_at || '').localeCompare(a.created_at || ''),
    );
  }

  const isRTL = locale === 'ar';
  const Crumb = isRTL ? ChevronLeft : ChevronRight;

  // Hero/banner settings (configurable from store settings → Page Banners).
  // The collection's own thumbnail takes priority as the background; the
  // store-level hero image is the fallback when a collection has no thumbnail.
  const hero = resolveHero(storeData?.theme?.hero?.collections, { height: 'lg' });
  const heroImage = collection.thumbnail_url
    ? resolveMediaUrl(collection.thumbnail_url)
    : hero.imageUrl
    ? resolveMediaUrl(hero.imageUrl)
    : undefined;

  // Helper to build sort URLs that preserve the active search.
  const buildSortUrl = (s: string) => {
    const p = new URLSearchParams();
    if (search) p.set('search', search);
    if (lang) p.set('lang', lang);
    if (s) p.set('sort', s);
    const qs = p.toString();
    return `${lp}/collections/${handle}${qs ? `?${qs}` : ''}`;
  };

  // JSON-LD: this page is a product listing and a step in the site hierarchy.
  // Neither was expressed before, so crawlers saw an ordinary page. Built from
  // data already in scope, so it costs nothing extra to render.
  const ldOrigin = buildStoreOrigin(storeSlug, storeData?.custom_domain || null, storeData?.market);
  const ldPrimary = storeData?.language_config?.primary_locale || 'en';
  const collectionUrl = storeLocalePath(
    ldOrigin,
    locale,
    ldPrimary,
    `/collections/${handle}`,
  );
  const collectionLd = buildCollectionPage({
    name: collectionName,
    description: collectionDescription?.replace(/<[^>]*>/g, '') || undefined,
    url: collectionUrl,
    // Only what this page actually renders — a list that disagrees with the
    // visible products would be a structured-data violation.
    items: products.map((p) => {
      const tr =
        p.translations?.find((t) => t.locale === locale) ||
        p.translations?.find((t) => t.locale === ldPrimary) ||
        p.translations?.[0];
      return {
        name: tr?.title || '',
        url: storeLocalePath(ldOrigin, locale, ldPrimary, `/products/${tr?.slug || ''}`),
        image: p.images?.[0]?.url ? resolveMediaUrl(p.images[0].url) : undefined,
      };
    }),
  });
  const collectionBreadcrumbLd = buildBreadcrumb([
    { name: t('common.home'), url: storeLocalePath(ldOrigin, locale, ldPrimary, '') },
    { name: t('common.collections'), url: storeLocalePath(ldOrigin, locale, ldPrimary, '/collections') },
    ...ancestors.map((a) => ({
      name: pickTranslation(a.translations, locale)?.name || a.slug,
      url: storeLocalePath(ldOrigin, locale, ldPrimary, `/collections/${a.slug}`),
    })),
    { name: collectionName, url: collectionUrl },
  ]);

  // If the creator has published a COLLECTION_TEMPLATE, render the page
  // through the active theme using its sections + this listing as the magic
  // context. The default layout below stays as the fallback for stores
  // without one. SEO output (JSON-LD) is identical in both branches.
  const templateSections = template?.snapshot?.sections;
  if (templateSections && templateSections.length > 0) {
    const tplLocale = lang || ldPrimary;
    const listing: ListingContext = {
      kind: 'collection',
      // Card-level projection only — see lib/listing.ts.
      products: products.map(toListingProduct),
      collections: creatorCategoriesTree || [],
      collection,
      collectionPath: ancestors,
      query: { search, sort },
      hero: storeData?.theme?.hero?.collections,
      basePath: `/collections/${handle}`,
      isFiltered: !!search,
    };
    return (
      <div className="min-h-screen" dir={tplLocale === 'ar' ? 'rtl' : 'ltr'}>
        {collectionLd && (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: ldJsonSafe(collectionLd) }}
          />
        )}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: ldJsonSafe(collectionBreadcrumbLd) }}
        />
        <SectionRenderer
          theme={resolveTheme(storeData?.theme_key)}
          sections={templateSections}
          locale={tplLocale}
          primaryLocale={ldPrimary}
          storeSlug={storeSlug}
          currency={currency}
          listing={listing}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen" dir={isRTL ? 'rtl' : 'ltr'}>
      {collectionLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: ldJsonSafe(collectionLd) }}
        />
      )}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: ldJsonSafe(collectionBreadcrumbLd) }}
      />
      {/* Hero banner — toggled and styled from store settings; uses the
          collection thumbnail (or store hero image) as background when present */}
      {hero.enabled && (
        <div
          className="relative overflow-hidden"
          style={
            heroImage
              ? {
                  backgroundImage: `linear-gradient(rgba(0,0,0,${hero.overlayAlpha}), rgba(0,0,0,${hero.overlayAlpha})), url(${heroImage})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  color: hero.textColor,
                }
              : {
                  background:
                    'linear-gradient(135deg, var(--store-primary, #2563eb) 0%, var(--store-secondary, #1e40af) 100%)',
                  color: hero.textColor,
                }
          }
        >
          {!heroImage && (
            <div
              className="absolute inset-0 pointer-events-none"
              style={{ backgroundColor: `rgba(0,0,0,${hero.overlayAlpha})` }}
            />
          )}
          <div className={`relative container mx-auto px-4 ${hero.heightClass}`}>
            {/* Breadcrumb: Home › Collections › ancestors… › this (M6 §3) */}
            <nav
              className="flex items-center flex-wrap gap-1 text-xs font-semibold opacity-85 mb-4"
              aria-label="Breadcrumb"
              style={{ color: hero.textColor }}
            >
              <Link href={`${lp}/`} className="hover:opacity-100 hover:underline transition">
                {t('common.home')}
              </Link>
              <Crumb className="w-3.5 h-3.5 opacity-60 shrink-0" />
              <Link href={`${lp}/collections`} className="hover:opacity-100 hover:underline transition">
                {t('common.collections')}
              </Link>
              {ancestors.map((a) => (
                <span key={a.id} className="contents">
                  <Crumb className="w-3.5 h-3.5 opacity-60 shrink-0" />
                  <Link href={`${lp}/collections/${a.slug}`} className="hover:opacity-100 hover:underline transition">
                    {pickTranslation(a.translations, locale)?.name || a.slug}
                  </Link>
                </span>
              ))}
              <Crumb className="w-3.5 h-3.5 opacity-60 shrink-0" />
              <span aria-current="page">{collectionName}</span>
            </nav>

            <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight drop-shadow-sm" style={{ color: hero.textColor }}>
              {collectionName}
            </h1>

            {collectionDescription && (
              <div
                className="mt-3 max-w-2xl text-sm md:text-base opacity-85 leading-relaxed prose prose-invert [&_p]:my-1.5 [&_*]:!text-[color:inherit]"
                style={{ color: hero.textColor }}
                dangerouslySetInnerHTML={{ __html: collectionDescription }}
              />
            )}

            {hero.showCount && products.length > 0 && (
              <p className="mt-4 text-xs font-semibold opacity-70" style={{ color: hero.textColor }}>
                {products.length}{' '}
                {products.length === 1
                  ? t('store.productSingular')
                  : t('store.productsCount')}
              </p>
            )}
          </div>

          {/* Small wave */}
          <div className="absolute bottom-0 left-0 right-0 h-6 overflow-hidden">
            <svg viewBox="0 0 1440 24" preserveAspectRatio="none" className="w-full h-6">
              <path d="M0,12 C480,24 960,0 1440,12 L1440,24 L0,24 Z" fill="white" />
            </svg>
          </div>
        </div>
      )}

      <div className="container mx-auto px-4 py-8">
        {/* Search form scoped to this collection */}
        <div className="flex flex-col md:flex-row gap-4 mb-8 items-start md:items-center justify-between">
          <form method="GET" className="flex-1 max-w-md">
            {lang && <input type="hidden" name="lang" value={lang} />}
            {sort && <input type="hidden" name="sort" value={sort} />}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <input
                type="text"
                name="search"
                defaultValue={search || ''}
                placeholder={t('product.searchPlaceholder')}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl bg-white text-sm focus:outline-none focus:ring-2 focus:border-transparent shadow-sm"
                style={
                  {
                    '--tw-ring-color': 'var(--store-primary, #2563eb)',
                  } as React.CSSProperties
                }
              />
            </div>
          </form>

          {/* Sort */}
          {products.length > 0 && (
            <div className="flex items-center gap-1.5">
              <ArrowUpDown className="w-3.5 h-3.5 text-gray-400" />
              <div className="flex gap-1 flex-wrap">
                {[
                  { value: '', label: t('product.sortDefault') },
                  { value: 'price_asc', label: t('product.sortPriceLow') },
                  { value: 'price_desc', label: t('product.sortPriceHigh') },
                  { value: 'newest', label: t('product.sortNewest') },
                ].map((opt) => (
                  <Link
                    key={opt.value}
                    href={buildSortUrl(opt.value)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-all border ${
                      (sort || '') === opt.value
                        ? 'text-white border-transparent shadow-sm'
                        : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
                    }`}
                    style={
                      (sort || '') === opt.value
                        ? { backgroundColor: 'var(--store-primary, #2563eb)' }
                        : {}
                    }
                  >
                    {opt.label}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sub-collections strip — if this collection has children, render them as quick links */}
        {collection.children && collection.children.length > 0 && (
          <div className="mb-8 flex flex-wrap gap-2">
            {collection.children
              .filter((c) => c.is_active !== false)
              .map((child) => {
                const tr = pickTranslation(child.translations, locale);
                return (
                  <Link
                    key={child.id}
                    href={`${lp}/collections/${child.slug}`}
                    className="px-4 py-2 rounded-full text-xs font-semibold bg-white text-gray-600 border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all"
                  >
                    {tr?.name || child.slug}
                  </Link>
                );
              })}
          </div>
        )}

        {/* Products grid */}
        {products.length === 0 ? (
          <div className="text-center py-24">
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
              <Search className="w-7 h-7 text-gray-300" />
            </div>
            <p className="text-gray-500 font-medium">{t('common.noProducts')}</p>
            <Link
              href={`${lp}/products`}
              className="inline-block mt-4 text-sm font-semibold hover:underline"
              style={{ color: 'var(--store-primary, #2563eb)' }}
            >
              {t('common.viewAll')}
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
            {products.map((product) => {
              const translation =
                product.translations.find((tr) => tr.locale === locale) ||
                product.translations.find((tr) => tr.locale === 'en') ||
                product.translations[0];
              // Use any translation with a *usable* slug for the URL. Secondary-locale
              // translations sometimes have a degenerate slug (empty, or a stray "-"
              // when slugifying a non-Latin title strips everything) — those would
              // resolve to a 404. We require at least one alphanumeric char.
              const usable = (s?: string) => !!s && /[a-z0-9]/i.test(s);
              const slugTr =
                product.translations.find((tr) => tr.locale === locale && usable(tr.slug)) ||
                product.translations.find((tr) => usable(tr.slug));

              return (
                <ProductCard
                  key={product.id}
                  href={`${lp}/products/${slugTr?.slug || product.id}`}
                  title={translation?.title || 'Untitled'}
                  price={Number(product.base_price)}
                  taxRateBp={product.tax_rate_bp}
                  comparePrice={
                    product.compare_at_price ? Number(product.compare_at_price) : undefined
                  }
                  imageUrl={
                    product.images[0]?.url
                      ? resolveMediaUrl(product.images[0].url)
                      : undefined
                  }
                  currency={currency}
                  promotionLabel={
                    product.promotions?.[0]
                      ? product.promotions[0].type === 'PERCENTAGE' ||
                        product.promotions[0].type === 'FLASH_SALE'
                        ? `${product.promotions[0].value}% off`
                        : product.promotions[0].type === 'FREE_SHIPPING'
                        ? 'Free Shipping'
                        : product.promotions[0].translations?.[0]?.title ||
                          'Offer'
                      : undefined
                  }
                  vendorName={product.vendor?.company_name}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export async function generateMetadata({
  params,
  searchParams,
}: CollectionPageProps) {
  const { storeSlug, handle } = await params;
  const { lang } = await searchParams;

  try {
    const [tree, store] = await Promise.all([
      storefront.getCreatorCategories(storeSlug) as Promise<CreatorCategory[]>,
      storefront.getStore(storeSlug, await getRequestMarket()) as Promise<{
        custom_domain?: string | null;
        market?: MarketRoute | null;
        markets?: MarketRoute[];
        language_config?: { primary_locale?: string; secondary_locales?: string[] } | null;
      } | null>,
    ]);
    const primaryLocale = store?.language_config?.primary_locale || 'en';
    const secondary: string[] = store?.language_config?.secondary_locales || [];
    const locale = lang || primaryLocale;

    const flat = flattenCreatorCategories(tree || []);
    const collection = flat.find((c) => c.slug === handle && c.is_active !== false);
    if (!collection) return {};
    const tr = pickTranslation(collection.translations, locale);

    // Previously title + description only, so a collection inherited the
    // layout's canonical and declared itself a duplicate of the homepage.
    const alternates = buildStoreAlternates({
      origin: buildStoreOrigin(storeSlug, store?.custom_domain || null, store?.market),
      locale,
      primaryLocale,
      secondaryLocales: secondary,
      path: `/collections/${handle}`,
      markets: store?.markets,
      market: store?.market,
      noindex: await getRequestNoindex(),
      storeCustomDomain: store?.custom_domain ?? null,
      storeSlug,
    });

    const title = collectionMetaTitle(tr, handle);
    const description = collectionMetaDescription(tr);
    const image = collection.thumbnail_url
      ? resolveMediaUrl(collection.thumbnail_url)
      : undefined;

    return {
      title,
      description,
      alternates,
      openGraph: {
        title,
        description,
        images: image ? [image] : undefined,
        type: 'website',
        url: alternates.canonical,
      },
      // M4.4: a flagged collection with no published product stays out of
      // the index (and out of the sitemap, filtered by the API).
      ...(collectionIsNoindex(collection) ? { robots: { index: false, follow: true } } : {}),
    };
  } catch {
    return {};
  }
}
