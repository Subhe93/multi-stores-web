import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { storefront, resolveMediaUrl } from '@/lib/api';
import { Truck, RefreshCw, ShieldCheck, Star, ArrowRight, ChevronRight, FolderTree } from 'lucide-react';
import { ProductCard } from '@/components/product/ProductCard';
import { resolveTheme } from '@/themes/registry';
import { SectionRenderer } from '@/themes/SectionRenderer';
import type { SectionInstance, ThemeCustomizations } from '@/themes/types';
import { buildStoreOrigin, storeLocalePath } from '@/lib/storeUrl';

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
  theme_key?: string;
  theme_customizations?: ThemeCustomizations;
  language_config?: {
    primary_locale?: string;
    secondary_locales?: string[];
  } | null;
  theme?: {
    translations?: Record<string, StoreTranslation>;
  };
}

interface PublishedHomeSnapshot {
  page: {
    type: string;
    seo?: Record<string, unknown>;
    translations: Array<{
      locale: string;
      title?: string;
      meta_title?: string;
      meta_description?: string;
    }>;
  };
  sections: SectionInstance[];
}

interface PublishedHome {
  id: string;
  type: string;
  seo: { og_image?: string; canonical?: string; robots?: string; twitter_card?: string };
  snapshot: PublishedHomeSnapshot;
}

interface HomeProps {
  params: Promise<{ storeSlug: string }>;
  searchParams: Promise<{ lang?: string }>;
}

// Home page metadata. Takes precedence over the layout's defaults when the
// creator has published a v2 home with their own meta_title/description/SEO.
// Falls through to whatever layout sets when there is no v2 page yet.
export async function generateMetadata({
  params,
  searchParams,
}: HomeProps): Promise<Metadata> {
  const { storeSlug } = await params;
  const { lang } = await searchParams;
  try {
    const [store, published] = await Promise.all([
      storefront.getStore(storeSlug) as Promise<{
        language_config?: { primary_locale?: string; secondary_locales?: string[] } | null;
        custom_domain?: string | null;
      }>,
      storefront.getPublishedHome(storeSlug).catch(() => null) as Promise<PublishedHome | null>,
    ]);
    const primaryLocale = store.language_config?.primary_locale || 'en';
    const secondary = store.language_config?.secondary_locales || [];
    const locale = lang || primaryLocale;

    if (!published) return {};

    const tr =
      published.snapshot.page.translations.find((t) => t.locale === locale) ||
      published.snapshot.page.translations.find((t) => t.locale === primaryLocale) ||
      published.snapshot.page.translations[0];

    // Canonical = subdomain root with primary locale (no prefix). Alternates
    // use path-prefix form `/{locale}` (no query strings).
    const origin = buildStoreOrigin(storeSlug, store.custom_domain || null);
    const canonical = storeLocalePath(origin, primaryLocale, primaryLocale, '');
    const allLocales = Array.from(new Set([primaryLocale, ...secondary]));
    const languages: Record<string, string> = {};
    for (const l of allLocales) {
      languages[l] = storeLocalePath(origin, l, primaryLocale, '');
    }

    return {
      title: tr?.meta_title || tr?.title,
      description: tr?.meta_description,
      alternates: { canonical: published.seo?.canonical || canonical, languages },
      openGraph: {
        title: tr?.meta_title || tr?.title || undefined,
        description: tr?.meta_description,
        // Absolutize: API stores og_image as a relative `/uploads/...` path. Without
        // this, external crawlers resolve the URL against the storefront origin
        // (where the file doesn't exist) and the OG image breaks.
        images: published.seo?.og_image ? [resolveMediaUrl(published.seo.og_image)] : undefined,
        type: 'website',
      },
      robots: published.seo?.robots,
    };
  } catch {
    return {};
  }
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

export default async function StoreHomePage({ params, searchParams }: HomeProps) {
  const { storeSlug } = await params;
  const { lang } = await searchParams;
  const t = await getTranslations();

  const locale = lang || 'en';
  const lp = lang ? `/${lang}` : '';

  // Pull collections in parallel. Soft-fail to keep the home page rendering if the
  // endpoint hiccups — collections are decorative on this page, not load-bearing.
  // publishedHome may be null when the creator hasn't built a v2 home yet — in
  // that case we fall through to the hardcoded default below.
  const [store, products, creatorCategoriesResult, publishedHome] = await Promise.all([
    storefront.getStore(storeSlug) as Promise<Store>,
    storefront.getProducts(storeSlug, { featured: 'true', locale }) as Promise<Product[]>,
    storefront.getCreatorCategories(storeSlug).catch(() => [] as CreatorCategory[]) as Promise<CreatorCategory[]>,
    storefront.getPublishedHome(storeSlug).catch(() => null) as Promise<PublishedHome | null>,
  ]);

  // Currency from the store, used by sections that render prices (FeaturedProducts).
  const storeCurrency = (store as unknown as { currency?: string }).currency || 'EUR';

  // If the creator has published a v2 home, render it through the active theme.
  // CSS variables for the theme are already injected by the parent layout.
  if (publishedHome?.snapshot?.sections?.length) {
    const theme = resolveTheme(store.theme_key);
    const primaryLocale = store.language_config?.primary_locale || 'en';
    return (
      <SectionRenderer
        theme={theme}
        sections={publishedHome.snapshot.sections}
        locale={locale}
        primaryLocale={primaryLocale}
        storeSlug={storeSlug}
        currency={storeCurrency}
      />
    );
  }

  // Pick the resolved translation for a collection in the active locale.
  const pickCollectionName = (c: CreatorCategory): string => {
    const trs = c.translations;
    if (!trs?.length) return c.slug;
    return (
      trs.find((t) => t.locale === locale)?.name ||
      trs.find((t) => t.locale === 'en')?.name ||
      trs[0]?.name ||
      c.slug
    );
  };

  // Only active root collections, capped at 6 so the homepage row stays tidy.
  const featuredCollections = (creatorCategoriesResult || [])
    .filter((c) => c.is_active !== false)
    .slice(0, 6);

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

      {/* Featured collections — only renders when the creator has any active collections */}
      {featuredCollections.length > 0 && (
        <section className="container mx-auto px-4 pb-4">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                {t('store.store_collections')}
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                {t('store.explore_collections')}
              </p>
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

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {featuredCollections.map((c) => {
              const title = pickCollectionName(c);
              const thumb = c.thumbnail_url ? resolveMediaUrl(c.thumbnail_url) : undefined;
              return (
                <Link
                  key={c.id}
                  href={`${lp}/collections/${c.slug}`}
                  className="group relative aspect-square overflow-hidden rounded-2xl bg-gray-100 shadow-sm hover:shadow-md transition-shadow"
                >
                  {thumb ? (
                    <img
                      src={thumb}
                      alt={title}
                      loading="lazy"
                      className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                    />
                  ) : (
                    <div
                      className="absolute inset-0 flex items-center justify-center"
                      style={{
                        background:
                          'linear-gradient(135deg, var(--store-primary, #2563eb) 0%, var(--store-secondary, #1e40af) 100%)',
                      }}
                    >
                      <FolderTree className="w-10 h-10 text-white/70" />
                    </div>
                  )}
                  {/* Gradient + title overlay */}
                  <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/70 via-black/40 to-transparent">
                    <span className="block text-white font-semibold text-sm leading-tight line-clamp-2">
                      {title}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

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

// Storefront reads are tagged with the store (see lib/api.ts) and refreshed
// on-demand via /api/revalidate when the creator publishes, so the cached home
// reflects a new publish within seconds without rebuilding on every request.
