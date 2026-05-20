import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Search, ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { storefront, resolveMediaUrl } from '@/lib/api';
import { ProductCard } from '@/components/product/ProductCard';
import { resolveHero, type StoreHero } from '@/lib/hero';

interface Product {
  id: string;
  base_price: number;
  compare_at_price?: number;
  translations: { locale: string; title: string; slug: string }[];
  images: { url: string }[];
}

interface CreatorCategoryTranslation {
  locale: string;
  name: string;
  description?: string | null;
}

interface CreatorCategory {
  id: string;
  slug: string;
  is_active?: boolean;
  thumbnail_url?: string | null;
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
  const locale = lang || 'en';
  const lp = lang ? `/${lang}` : '';

  // Fetch the tree first so we can render the hero with the matching collection.
  // We also need the store currency for product prices.
  const [storeData, creatorCategoriesTree] = await Promise.all([
    storefront.getStore(storeSlug) as Promise<{ currency?: string; theme?: { hero?: StoreHero } }>,
    storefront.getCreatorCategories(storeSlug) as Promise<CreatorCategory[]>,
  ]);

  const flat = flattenCreatorCategories(creatorCategoriesTree || []);
  const collection = flat.find((c) => c.slug === handle && c.is_active !== false);
  if (!collection) notFound();

  const collectionTranslation = pickTranslation(collection.translations, locale);
  const collectionName = collectionTranslation?.name || handle;
  const collectionDescription = collectionTranslation?.description || undefined;
  const currency = storeData?.currency;

  // Pull products filtered by this collection (backend resolves MANUAL vs TAGS).
  const queryParams: Record<string, string> = { locale, creator_category: handle };
  if (search) queryParams.search = search;
  const products = (await storefront.getProducts(
    storeSlug,
    queryParams,
  )) as Product[];

  // Sort client-side (cheap, mirrors /products page behavior)
  if (sort === 'price_asc') {
    products.sort((a, b) => Number(a.base_price) - Number(b.base_price));
  } else if (sort === 'price_desc') {
    products.sort((a, b) => Number(b.base_price) - Number(a.base_price));
  } else if (sort === 'newest') {
    products.sort((a, b) =>
      ((b as any).created_at || '').localeCompare((a as any).created_at || ''),
    );
  }

  const isRTL = locale === 'ar';
  const BackChevron = isRTL ? ChevronRight : ChevronLeft;

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

  return (
    <div className="min-h-screen" dir={isRTL ? 'rtl' : 'ltr'}>
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
            {/* Breadcrumb / back link */}
            <Link
              href={`${lp}/products`}
              className="inline-flex items-center gap-1 text-xs font-semibold opacity-85 hover:opacity-100 transition mb-4"
            >
              <BackChevron className="w-4 h-4" />
              {t('store.all_collections')}
            </Link>

            <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight drop-shadow-sm">
              {collectionName}
            </h1>

            {collectionDescription && (
              <div
                className="mt-3 max-w-2xl text-sm md:text-base opacity-85 leading-relaxed prose prose-invert [&_p]:my-1.5"
                dangerouslySetInnerHTML={{ __html: collectionDescription }}
              />
            )}

            {hero.showCount && products.length > 0 && (
              <p className="mt-4 text-xs font-semibold opacity-70">
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

              return (
                <ProductCard
                  key={product.id}
                  href={`${lp}/products/${translation?.slug || product.id}`}
                  title={translation?.title || 'Untitled'}
                  price={Number(product.base_price)}
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
                    (product as any).promotions?.[0]
                      ? (product as any).promotions[0].type === 'PERCENTAGE' ||
                        (product as any).promotions[0].type === 'FLASH_SALE'
                        ? `${(product as any).promotions[0].value}% off`
                        : (product as any).promotions[0].type === 'FREE_SHIPPING'
                        ? 'Free Shipping'
                        : (product as any).promotions[0].translations?.[0]?.title ||
                          'Offer'
                      : undefined
                  }
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
  const locale = lang || 'en';

  try {
    const tree = (await storefront.getCreatorCategories(
      storeSlug,
    )) as CreatorCategory[];
    const flat = flattenCreatorCategories(tree || []);
    const collection = flat.find((c) => c.slug === handle && c.is_active !== false);
    if (!collection) return {};
    const tr = pickTranslation(collection.translations, locale);
    return {
      title: tr?.name || handle,
      description:
        tr?.description?.replace(/<[^>]*>/g, '').slice(0, 160) || undefined,
    };
  } catch {
    return {};
  }
}
