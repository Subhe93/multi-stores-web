import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { storefront, resolveMediaUrl } from '@/lib/api';
import { Search, SlidersHorizontal, ArrowUpDown } from 'lucide-react';
import { ProductCard } from '@/components/product/ProductCard';

interface Product {
  id: string;
  base_price: number;
  compare_at_price?: number;
  translations: { locale: string; title: string; slug: string }[];
  images: { url: string }[];
}

interface Category {
  id: string;
  translations: { locale: string; name: string; slug: string }[];
}

interface StoreProductsProps {
  params: Promise<{ storeSlug: string }>;
  searchParams: Promise<{ search?: string; category?: string; lang?: string; sort?: string }>;
}

export default async function StoreProductsPage({ params, searchParams }: StoreProductsProps) {
  const { storeSlug } = await params;
  const { search, category, lang, sort } = await searchParams;
  const t = await getTranslations();
  const locale = lang || 'en';
  const lp = lang ? `/${lang}` : '';

  const queryParams: Record<string, string> = { locale };
  if (search) queryParams.search = search;
  if (category) queryParams.category = category;

  const [products, categories, storeData] = await Promise.all([
    storefront.getProducts(storeSlug, queryParams) as Promise<Product[]>,
    storefront.getCategories(storeSlug) as Promise<Category[]>,
    storefront.getStore(storeSlug) as Promise<{ currency?: string }>,
  ]);
  const currency = storeData?.currency;

  // Sort products
  if (sort === 'price_asc') {
    products.sort((a, b) => Number(a.base_price) - Number(b.base_price));
  } else if (sort === 'price_desc') {
    products.sort((a, b) => Number(b.base_price) - Number(a.base_price));
  } else if (sort === 'newest') {
    products.sort((a, b) => ((b as any).created_at || '').localeCompare((a as any).created_at || ''));
  }

  const isFiltered = !!(search || category);

  return (
    <div className="min-h-screen" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      {/* Page header banner */}
      <div
        className="relative overflow-hidden py-12 text-white text-center"
        style={{
          background:
            'linear-gradient(135deg, var(--store-primary, #2563eb) 0%, var(--store-secondary, #1e40af) 100%)',
        }}
      >
        <div className="absolute inset-0 bg-black/10 pointer-events-none" />
        <div className="relative container mx-auto px-4">
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
            {t('common.products')}
          </h1>
          {products.length > 0 && (
            <p className="text-white/70 text-sm mt-2">
              {products.length} {products.length === 1 ? t('store.productSingular') : t('store.productsCount')}
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

      <div className="container mx-auto px-4 py-8">
        {/* Search + filter bar */}
        <div className="flex flex-col md:flex-row gap-4 mb-8">
          {/* Search */}
          <form method="GET" className="flex-1 max-w-md">
            {category && <input type="hidden" name="category" value={category} />}
            {lang && <input type="hidden" name="lang" value={lang} />}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <input
                type="text"
                name="search"
                defaultValue={search || ''}
                placeholder={t('product.searchPlaceholder')}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl bg-white text-sm focus:outline-none focus:ring-2 focus:border-transparent shadow-sm"
                style={{ '--tw-ring-color': 'var(--store-primary, #2563eb)' } as React.CSSProperties}
              />
            </div>
          </form>

          {/* Category pills */}
          {categories.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-gray-400 shrink-0" />
              <Link
                href={`${lp}/products${search ? `?search=${search}` : ''}`}
                className={`px-4 py-2 rounded-full text-xs font-semibold transition-all border ${
                  !category
                    ? 'text-white shadow-sm border-transparent'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:shadow-sm'
                }`}
                style={!category ? { backgroundColor: 'var(--store-primary, #2563eb)', borderColor: 'var(--store-primary, #2563eb)' } : {}}
              >
                {t('product.all')}
              </Link>
              {categories.map((cat) => {
                const catTranslation =
                  cat.translations.find((tr) => tr.locale === locale) ||
                  cat.translations.find((tr) => tr.locale === 'en') ||
                  cat.translations[0];
                const isActive = category === catTranslation?.slug;

                return (
                  <Link
                    key={cat.id}
                    href={`${lp}/products?category=${catTranslation?.slug || cat.id}${search ? `&search=${search}` : ''}`}
                    className={`px-4 py-2 rounded-full text-xs font-semibold transition-all border ${
                      isActive
                        ? 'text-white shadow-sm border-transparent'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:shadow-sm'
                    }`}
                    style={isActive ? { backgroundColor: 'var(--store-primary, #2563eb)', borderColor: 'var(--store-primary, #2563eb)' } : {}}
                  >
                    {catTranslation?.name || 'Unnamed'}
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Sort + count bar */}
        {products.length > 0 && (() => {
          const buildSortUrl = (s: string) => {
            const p = new URLSearchParams();
            if (search) p.set('search', search);
            if (category) p.set('category', category);
            if (lang) p.set('lang', lang);
            if (s) p.set('sort', s);
            const qs = p.toString();
            return `${lp}/products${qs ? `?${qs}` : ''}`;
          };
          const sortOptions = [
            { value: '', label: t('product.sortDefault') },
            { value: 'price_asc', label: t('product.sortPriceLow') },
            { value: 'price_desc', label: t('product.sortPriceHigh') },
            { value: 'newest', label: t('product.sortNewest') },
          ];
          return (
            <div className="flex items-center justify-between mb-6">
              <p className="text-sm text-gray-500">
                {products.length} {products.length === 1 ? t('store.productSingular') : t('store.productsCount')}
              </p>
              <div className="flex items-center gap-1.5">
                <ArrowUpDown className="w-3.5 h-3.5 text-gray-400" />
                <div className="flex gap-1">
                  {sortOptions.map((opt) => (
                    <Link
                      key={opt.value}
                      href={buildSortUrl(opt.value)}
                      className={`px-3 py-1 rounded-full text-xs font-medium transition-all border ${
                        (sort || '') === opt.value
                          ? 'text-white border-transparent shadow-sm'
                          : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
                      }`}
                      style={(sort || '') === opt.value ? { backgroundColor: 'var(--store-primary, #2563eb)' } : {}}
                    >
                      {opt.label}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          );
        })()}

        {/* Products grid */}
        {products.length === 0 ? (
          <div className="text-center py-24">
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
              <Search className="w-7 h-7 text-gray-300" />
            </div>
            <p className="text-gray-500 font-medium">{t('common.noProducts')}</p>
            {isFiltered && (
              <Link
                href={`${lp}/products`}
                className="inline-block mt-4 text-sm font-semibold hover:underline"
                style={{ color: 'var(--store-primary, #2563eb)' }}
              >
                {t('product.clearFilters')}
              </Link>
            )}
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
                      ? (product as any).promotions[0].type === 'PERCENTAGE' || (product as any).promotions[0].type === 'FLASH_SALE'
                        ? `${(product as any).promotions[0].value}% off`
                        : (product as any).promotions[0].type === 'FREE_SHIPPING'
                        ? 'Free Shipping'
                        : (product as any).promotions[0].translations?.[0]?.title || 'Offer'
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
