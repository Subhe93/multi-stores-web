import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { storefront, resolveMediaUrl } from '@/lib/api';
import { Truck, RefreshCw, ShieldCheck, Star, ArrowRight, ChevronRight } from 'lucide-react';
import { ProductCard } from '@/components/product/ProductCard';

interface Product {
  id: string;
  base_price: number;
  compare_at_price?: number;
  translations: { locale: string; title: string; slug: string }[];
  images: { url: string }[];
}

interface StoreTranslation {
  name?: string;
  description?: string;
}

interface Store {
  name: string;
  description?: string;
  currency?: string;
  theme?: {
    translations?: Record<string, StoreTranslation>;
  };
}

interface StoreHomeProps {
  params: Promise<{ storeSlug: string }>;
  searchParams: Promise<{ lang?: string }>;
}

export default async function StoreHomePage({ params, searchParams }: StoreHomeProps) {
  const { storeSlug } = await params;
  const { lang } = await searchParams;
  const t = await getTranslations();

  const locale = lang || 'en';
  const lp = lang ? `/${lang}` : '';

  const [store, products] = await Promise.all([
    storefront.getStore(storeSlug) as Promise<Store>,
    storefront.getProducts(storeSlug, { featured: 'true', locale }) as Promise<Product[]>,
  ]);

  const trans = store.theme?.translations?.[locale];
  const storeName = trans?.name || store.name;
  const storeDescription = trans?.description || store.description;

  const trustItems = [
    { Icon: Truck, label: t('store.freeShipping') },
    { Icon: RefreshCw, label: t('store.freeReturns') },
    { Icon: ShieldCheck, label: t('store.securePayment') },
    { Icon: Star, label: t('store.topQuality') },
  ];

  return (
    <div>
      {/* Hero section */}
      <section
        className="relative overflow-hidden text-white"
        style={{
          background:
            'linear-gradient(135deg, var(--store-primary, #2563eb) 0%, var(--store-secondary, #1e40af) 100%)',
        }}
      >
        {/* Subtle dark overlay for depth */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/5 to-black/25 pointer-events-none" />

        {/* Decorative circles */}
        <div className="absolute -top-20 -right-20 w-80 h-80 rounded-full bg-white/5 pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-60 h-60 rounded-full bg-white/5 pointer-events-none" />

        <div className="relative container mx-auto max-w-4xl px-4 py-28 text-center">
          <h1 className="text-5xl md:text-6xl font-extrabold mb-5 tracking-tight drop-shadow-sm leading-tight">
            {storeName}
          </h1>

          {storeDescription && (
            <div className="max-w-2xl mx-auto mb-10">
              <div
                className="text-lg md:text-xl text-white/80 leading-relaxed prose prose-invert max-w-none [&_p]:my-2"
                dangerouslySetInnerHTML={{ __html: storeDescription }}
              />
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
            <Link
              href={`${lp}/products`}
              className="inline-flex items-center gap-2 px-8 py-3.5 bg-white rounded-full text-sm font-bold shadow-xl transition-all duration-200 hover:shadow-2xl hover:-translate-y-0.5 active:scale-95"
              style={{ color: 'var(--store-primary, #2563eb)' }}
            >
              {t('store.browseProducts')}
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

        {/* Wave divider */}
        <div className="relative h-14 overflow-hidden -mb-px">
          <svg
            viewBox="0 0 1440 56"
            preserveAspectRatio="none"
            className="absolute bottom-0 w-full h-14 block"
          >
            <path
              d="M0,28 C360,56 1080,0 1440,28 L1440,56 L0,56 Z"
              fill="white"
            />
          </svg>
        </div>
      </section>

      {/* Trust strip */}
      <section className="container mx-auto px-4 py-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          {trustItems.map(({ Icon, label }) => (
            <div
              key={label}
              className="flex items-center gap-3 p-4 rounded-2xl border border-gray-100 bg-white shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center shrink-0">
                <Icon
                  className="w-5 h-5"
                  style={{ color: 'var(--store-primary, #2563eb)' }}
                />
              </div>
              <span className="text-xs font-semibold text-gray-700 leading-tight">{label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Featured products */}
      <section className="container mx-auto px-4 pb-24">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{t('store.featuredProducts')}</h2>
            <p className="text-sm text-gray-500 mt-1">{t('store.featuredSubtitle')}</p>
          </div>
          <Link
            href={`${lp}/products`}
            className="inline-flex items-center gap-1 text-sm font-semibold transition-opacity hover:opacity-70 shrink-0"
            style={{ color: 'var(--store-primary, #2563eb)' }}
          >
            {t('common.viewAll')}
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        {products.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
              <Star className="w-7 h-7 text-gray-300" />
            </div>
            <p className="text-sm">{t('common.noProducts')}</p>
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
                  currency={store.currency}
                />
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
