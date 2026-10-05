import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { ChevronRight } from 'lucide-react';
import { storefront, resolveMediaUrl } from '@/lib/api';
import { buildStoreOrigin, buildStoreAlternates } from '@/lib/storeUrl';
import { buildBreadcrumb, ldJsonSafe } from '@/lib/jsonld';
import { resolveHero, type StoreHero } from '@/lib/hero';

// /collections — index of the store's collections. The header's "Store
// collections" menu, the collection page's "All collections" link and
// creator-authored nav items point here; until now it answered 404 and only
// /collections/[handle] existed.

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

interface StoreRecord {
  name?: string;
  custom_domain?: string | null;
  language_config?: { primary_locale?: string; secondary_locales?: string[] } | null;
  theme?: { hero?: StoreHero };
}

interface CollectionsIndexProps {
  params: Promise<{ storeSlug: string }>;
  searchParams: Promise<{ lang?: string }>;
}

function pickTranslation(
  translations: CreatorCategoryTranslation[] | undefined,
  locale: string,
  primaryLocale: string,
): CreatorCategoryTranslation | undefined {
  if (!translations?.length) return undefined;
  return (
    translations.find((tr) => tr.locale === locale) ||
    translations.find((tr) => tr.locale === primaryLocale) ||
    translations.find((tr) => tr.locale === 'en') ||
    translations[0]
  );
}

function stripTags(html: string | null | undefined): string {
  return (html || '').replace(/<[^>]+>/g, '').trim();
}

export async function generateMetadata({ params, searchParams }: CollectionsIndexProps) {
  const { storeSlug } = await params;
  const { lang } = await searchParams;
  try {
    const store = (await storefront.getStore(storeSlug)) as StoreRecord | null;
    const primaryLocale = store?.language_config?.primary_locale || 'en';
    const locale = lang || primaryLocale;
    const t = await getTranslations({ locale });
    const secondary = store?.language_config?.secondary_locales || [];
    const alternates = buildStoreAlternates({
      origin: buildStoreOrigin(storeSlug, store?.custom_domain || null),
      locale,
      primaryLocale,
      secondaryLocales: secondary,
      path: '/collections',
    });
    return {
      title: `${t('store.store_collections')} | ${store?.name || storeSlug}`,
      alternates,
    };
  } catch {
    return {};
  }
}

export default async function CollectionsIndexPage({ params, searchParams }: CollectionsIndexProps) {
  const { storeSlug } = await params;
  const { lang } = await searchParams;
  const t = await getTranslations();
  const lp = lang ? `/${lang}` : '';

  // The store is read first (cached): without a locale prefix in the URL the
  // page is rendered in the store's primary locale.
  const store = (await storefront.getStore(storeSlug)) as StoreRecord | null;
  const primaryLocale = store?.language_config?.primary_locale || 'en';
  const locale = lang || primaryLocale;
  const isRTL = locale === 'ar';

  const tree = ((await storefront.getCreatorCategories(storeSlug).catch(() => [])) || []) as CreatorCategory[];
  // Top-level collections only; sub-collections are reachable from their parent.
  const collections = tree.filter((c) => c.is_active !== false);

  const hero = resolveHero(store?.theme?.hero?.collections, { height: 'md' });
  const heroImage = hero.imageUrl ? resolveMediaUrl(hero.imageUrl) : undefined;
  const storeBase = buildStoreOrigin(storeSlug, store?.custom_domain || null);
  const breadcrumbLd = buildBreadcrumb([
    { name: t('common.home'), url: storeBase },
    { name: t('store.store_collections'), url: `${storeBase}/collections` },
  ]);

  return (
    <div className="min-h-screen" dir={isRTL ? 'rtl' : 'ltr'}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJsonSafe(breadcrumbLd) }} />

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
            <div className="absolute inset-0 pointer-events-none" style={{ backgroundColor: `rgba(0,0,0,${hero.overlayAlpha})` }} />
          )}
          <div className={`relative container mx-auto px-4 ${hero.heightClass}`}>
            <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight drop-shadow-sm" style={{ color: hero.textColor }}>
              {t('store.store_collections')}
            </h1>
            {hero.showCount && collections.length > 0 && (
              <p className="mt-4 text-xs font-semibold opacity-70" style={{ color: hero.textColor }}>
                {collections.length}{' '}
                {collections.length === 1 ? t('store.collectionSingular') : t('store.collectionsCount')}
              </p>
            )}
          </div>
        </div>
      )}

      <div className="container mx-auto px-4 py-10">
        {collections.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-200 py-16 text-center text-sm text-gray-500">
            {t('store.noCollections')}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {collections.map((c) => {
              const tr = pickTranslation(c.translations, locale, primaryLocale);
              const name = tr?.name || c.slug;
              const description = stripTags(tr?.description);
              const image = c.thumbnail_url ? resolveMediaUrl(c.thumbnail_url) : undefined;
              return (
                <Link
                  key={c.id}
                  href={`${lp}/collections/${c.slug}`}
                  className="group relative overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition hover:shadow-md"
                >
                  <div
                    className="aspect-[4/3] w-full bg-gray-100"
                    style={
                      image
                        ? { backgroundImage: `url(${image})`, backgroundSize: 'cover', backgroundPosition: 'center' }
                        : {
                            background:
                              'linear-gradient(135deg, var(--store-primary, #2563eb) 0%, var(--store-secondary, #1e40af) 100%)',
                          }
                    }
                  />
                  <div className="p-5">
                    <h2 className="text-lg font-semibold text-gray-900 group-hover:underline">{name}</h2>
                    {description && <p className="mt-1 line-clamp-2 text-sm text-gray-500">{description}</p>}
                    <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold" style={{ color: 'var(--store-primary, #2563eb)' }}>
                      {t('store.viewCollection')}
                      <ChevronRight className="h-3.5 w-3.5 rtl:rotate-180" />
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
