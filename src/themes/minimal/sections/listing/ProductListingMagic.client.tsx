'use client';

// Component implementation. Definition lives in ProductListingMagic.tsx.
//
// Full-fidelity listing body for CATALOG_TEMPLATE (/products) and
// COLLECTION_TEMPLATE (/collections/[handle]). The markup is the standalone
// routes' listing markup moved here 1:1 so a published template matches the
// non-builder design; the creator's show/hide toggles simply gate each part.
// All data (filtering, sorting, hero config) is computed by the route and
// arrives through `listing` — this component only renders it, exactly like
// `product-page` renders from `product`.

import { useId } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Search, ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { resolveMediaUrl } from '@/lib/api';
import { resolveHero, type HeroHeight, type HeroPageConfig } from '@/lib/hero';
import { ProductCard } from '@/components/product/ProductCard';
import type { ListingCollection, ListingProduct, SectionRenderProps } from '../../../types';

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

// Card image aspect ratio — same option set as featured-products.
const CARD_ASPECT: Record<string, string> = {
  square: 'aspect-square',
  portrait: 'aspect-[4/5]',
  landscape: 'aspect-[4/3]',
};

const HERO_HEIGHTS: readonly HeroHeight[] = ['sm', 'md', 'lg'];

// A translation with a *usable* slug for the URL. Secondary-locale
// translations sometimes have a degenerate slug (empty, or a stray "-" when
// slugifying a non-Latin title strips everything) — those would resolve to a
// 404. We require at least one alphanumeric char.
const usable = (s?: string) => !!s && /[a-z0-9]/i.test(s);

function pickCollectionTranslation(translations: ListingCollection['translations'] | undefined, locale: string) {
  if (!translations?.length) return undefined;
  return (
    translations.find((tr) => tr.locale === locale) ||
    translations.find((tr) => tr.locale === 'en') ||
    translations[0]
  );
}

// Promotion badge text — mirrors the standalone routes' inline expression.
function promotionLabelFor(product: ListingProduct): string | undefined {
  const promo = (
    product.promotions as Array<{ type?: string; value?: unknown; translations?: Array<{ title?: string }> }> | undefined
  )?.[0];
  if (!promo) return undefined;
  if (promo.type === 'PERCENTAGE' || promo.type === 'FLASH_SALE') return `${promo.value}% off`;
  if (promo.type === 'FREE_SHIPPING') return 'Free Shipping';
  return promo.translations?.[0]?.title || 'Offer';
}

const SORT_KEYS = [
  { value: '', key: 'product.sortDefault' },
  { value: 'price_asc', key: 'product.sortPriceLow' },
  { value: 'price_desc', key: 'product.sortPriceHigh' },
  { value: 'newest', key: 'product.sortNewest' },
] as const;

export function ProductListingMagic({ settings, content, locale, primaryLocale, listing, currency }: SectionRenderProps) {
  const t = useTranslations();
  // Scoped class so the per-breakpoint grid-template-columns rules in the
  // injected <style> below don't leak to other instances on the same page.
  // Hooks run before the early return to keep call order stable.
  const scopeClass = `pl-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;

  // No listing in context (e.g. builder preview before data loads, or a
  // collection preview on a store with no collections) — show a recognisable
  // placeholder rather than crashing.
  if (!listing || (listing.kind === 'collection' && !listing.collection)) {
    return (
      <div
        className="text-center py-16 px-4"
        style={{
          backgroundColor: 'var(--theme-colors-surface)',
          border: '1px dashed var(--theme-colors-border)',
          borderRadius: 'var(--theme-radius-md)',
          color: 'var(--theme-colors-muted)',
        }}
      >
        <div className="text-xs uppercase tracking-wide">
          {locale === 'ar' ? 'قائمة المنتجات' : 'Product listing'}
        </div>
        <p className="text-sm mt-2">
          {locale === 'ar'
            ? 'تظهر هنا قائمة المنتجات (البانر، البحث، التصنيفات، الفرز وشبكة المنتجات).'
            : 'The product listing renders here (banner, search, collections, sorting and the product grid).'}
        </p>
      </div>
    );
  }

  const isCollection = listing.kind === 'collection';
  const { products, query, basePath, isFiltered } = listing;
  const { search, sort, category, creator_category } = query;

  // Secondary locales get a path prefix AND a `lang` query param (the proxy
  // rewrites `/{locale}/…` to `?lang=`); the primary locale stays canonical.
  // Mirrors how the standalone routes build `lp` and `p.set('lang', lang)`.
  const lang = locale !== primaryLocale ? locale : undefined;
  const lp = lang ? `/${lang}` : '';
  const base = `${lp}${basePath}`;

  // ── Settings ──
  const showHero = settings.show_hero !== false;
  const showSearch = settings.show_search !== false;
  const showCollections = settings.show_collections !== false;
  const showSort = settings.show_sort !== false;
  const showDescription = settings.show_description !== false;
  const showBackLink = settings.show_back_link !== false;
  const columns = clamp((settings.columns as number) ?? 4, 1, 6);
  const columnsTablet = clamp((settings.columns_tablet as number) ?? Math.min(columns, 3), 1, 6);
  const columnsMobile = clamp((settings.columns_mobile as number) ?? Math.min(columnsTablet, 2), 1, 4);
  const aspectClass = CARD_ASPECT[(settings.aspect as string) || 'square'] || CARD_ASPECT.square;

  // Hero: `auto` keeps the store setting (falling back to today's per-page
  // default — md for the catalog, lg for a collection); an explicit size
  // overrides the store setting.
  const explicitHeight = HERO_HEIGHTS.find((h) => h === settings.hero_height);
  const heroCfg: HeroPageConfig | undefined = explicitHeight ? { ...listing.hero, height: explicitHeight } : listing.hero;
  const hero = resolveHero(heroCfg, { height: isCollection ? 'lg' : 'md' });
  // The sort-bar count only follows the section toggle; the hero count also
  // honours the store's banner "show count" flag — same split as the routes.
  const showCount = settings.show_count !== false;
  const showHeroCount = showCount && hero.showCount;
  // The collection's own thumbnail takes priority as the background; the
  // store-level hero image is the fallback when a collection has no thumbnail.
  const collectionThumb = isCollection ? listing.collection?.thumbnail_url : undefined;
  const heroImage = collectionThumb
    ? resolveMediaUrl(collectionThumb)
    : hero.imageUrl
    ? resolveMediaUrl(hero.imageUrl)
    : undefined;
  const heroStyle: React.CSSProperties = heroImage
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
      };

  // ── Catalog-only data ──
  const heading = (content.heading as string) || t('common.products');
  const subheading = (content.subheading as string) || '';
  // Flatten creator categories one level deep so children can render indented inline.
  type FlatCollection = ListingCollection & { depth: number };
  const flatCollections: FlatCollection[] = [];
  if (!isCollection) {
    for (const parent of listing.collections || []) {
      if (parent.is_active === false) continue;
      flatCollections.push({ ...parent, depth: 0 });
      for (const child of parent.children || []) {
        if (child.is_active === false) continue;
        flatCollections.push({ ...child, depth: 1 });
      }
    }
  }

  // ── Collection-only data ──
  const collection = listing.collection;
  const collectionTranslation = pickCollectionTranslation(collection?.translations, locale);
  const collectionName = collectionTranslation?.name || collection?.slug || '';
  const collectionDescription = collectionTranslation?.description || undefined;
  const isRTL = locale === 'ar';
  const BackChevron = isRTL ? ChevronRight : ChevronLeft;
  const subCollections = (collection?.children || []).filter((c) => c.is_active !== false);

  // ── URL builders (preserve the other active filters and the locale) ──
  const buildFilterUrl = (overrides: { category?: string | null; creator_category?: string | null }) => {
    const p = new URLSearchParams();
    if (search) p.set('search', search);
    const nextCategory =
      overrides.category === null ? undefined : overrides.category !== undefined ? overrides.category : category;
    const nextCreatorCategory =
      overrides.creator_category === null
        ? undefined
        : overrides.creator_category !== undefined
        ? overrides.creator_category
        : creator_category;
    if (nextCategory) p.set('category', nextCategory);
    if (nextCreatorCategory) p.set('creator_category', nextCreatorCategory);
    if (lang) p.set('lang', lang);
    if (sort) p.set('sort', sort);
    const qs = p.toString();
    return `${base}${qs ? `?${qs}` : ''}`;
  };
  const buildSortUrl = (s: string) => {
    const p = new URLSearchParams();
    if (search) p.set('search', search);
    if (!isCollection) {
      if (category) p.set('category', category);
      if (creator_category) p.set('creator_category', creator_category);
    }
    if (lang) p.set('lang', lang);
    if (s) p.set('sort', s);
    const qs = p.toString();
    return `${base}${qs ? `?${qs}` : ''}`;
  };
  const sortOptions = SORT_KEYS.map((o) => ({ value: o.value, label: t(o.key) }));
  const activePill = { backgroundColor: 'var(--store-primary, #2563eb)', borderColor: 'var(--store-primary, #2563eb)' };

  const countLine = (
    <>
      {products.length} {products.length === 1 ? t('store.productSingular') : t('store.productsCount')}
    </>
  );

  const sortPills = (
    <div className="flex flex-wrap gap-1">
      {sortOptions.map((opt) => (
        <Link
          key={opt.value}
          href={buildSortUrl(opt.value)}
          className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-all border ${
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
  );

  const searchForm = (
    <form method="GET" className="flex-1 max-w-md">
      {!isCollection && category && <input type="hidden" name="category" value={category} />}
      {!isCollection && creator_category && <input type="hidden" name="creator_category" value={creator_category} />}
      {lang && <input type="hidden" name="lang" value={lang} />}
      {isCollection && sort && <input type="hidden" name="sort" value={sort} />}
      <div className="relative">
        <Search className="absolute inset-s-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        <input
          type="text"
          name="search"
          defaultValue={search || ''}
          placeholder={t('product.searchPlaceholder')}
          className="w-full ps-10 pe-4 py-2.5 border border-gray-200 rounded-xl bg-white text-sm focus:outline-none focus:ring-2 focus:border-transparent shadow-sm"
          style={{ '--tw-ring-color': 'var(--store-primary, #2563eb)' } as React.CSSProperties}
        />
      </div>
    </form>
  );

  const wave = (
    <div className="absolute bottom-0 inset-x-0 h-6 overflow-hidden">
      <svg viewBox="0 0 1440 24" preserveAspectRatio="none" className="w-full h-6">
        <path d="M0,12 C480,24 960,0 1440,12 L1440,24 L0,24 Z" fill="white" />
      </svg>
    </div>
  );

  const emptyState = (
    <div className="text-center py-24">
      <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
        <Search className="w-7 h-7 text-gray-300" />
      </div>
      <p className="text-gray-500 font-medium">{t('common.noProducts')}</p>
      {isCollection ? (
        <Link
          href={`${lp}/products`}
          className="inline-block mt-4 text-sm font-semibold hover:underline"
          style={{ color: 'var(--store-primary, #2563eb)' }}
        >
          {t('common.viewAll')}
        </Link>
      ) : (
        isFiltered && (
          <Link
            href={`${lp}/products`}
            className="inline-block mt-4 text-sm font-semibold hover:underline"
            style={{ color: 'var(--store-primary, #2563eb)' }}
          >
            {t('product.clearFilters')}
          </Link>
        )
      )}
    </div>
  );

  const grid = (
    <div className={`grid gap-4 md:gap-6 ${scopeClass}`}>
      {products.map((product) => {
        const translation =
          product.translations.find((tr) => tr.locale === locale) ||
          product.translations.find((tr) => tr.locale === 'en') ||
          product.translations[0];
        const slugTr =
          product.translations.find((tr) => tr.locale === locale && usable(tr.slug)) ||
          product.translations.find((tr) => usable(tr.slug));
        return (
          <ProductCard
            key={product.id}
            href={`${lp}/products/${slugTr?.slug || product.id}`}
            title={translation?.title || 'Untitled'}
            price={Number(product.base_price)}
            comparePrice={product.compare_at_price ? Number(product.compare_at_price) : undefined}
            imageUrl={product.images[0]?.url ? resolveMediaUrl(product.images[0].url) : undefined}
            currency={currency}
            promotionLabel={promotionLabelFor(product)}
            aspectClass={aspectClass}
          />
        );
      })}
    </div>
  );

  // Map the theme tokens onto the legacy --store-* variables the moved markup
  // reads (pills, links, banner gradient). The live storefront layout sets
  // them from the same tokens, but the builder preview has no such layout
  // and would otherwise fall back to the hardcoded blue.
  const scopeStyle = {
    ['--store-primary' as string]: 'var(--theme-colors-primary)',
    ['--store-secondary' as string]: 'var(--theme-colors-secondary)',
  } as React.CSSProperties;

  return (
    <section style={scopeStyle}>
      {/* Per-breakpoint grid columns — inline styles can't carry media queries
          so we inject a scoped style block keyed off the section's useId. */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
.${scopeClass} { grid-template-columns: repeat(${columns}, minmax(0, 1fr)); }
@media (max-width: 1023px) {
  .${scopeClass} { grid-template-columns: repeat(${columnsTablet}, minmax(0, 1fr)); }
}
@media (max-width: 767px) {
  .${scopeClass} { grid-template-columns: repeat(${columnsMobile}, minmax(0, 1fr)); }
}
          `.trim(),
        }}
      />

      {/* Page header banner — toggled and styled from store settings */}
      {showHero && hero.enabled && !isCollection && (
        <div className={`relative overflow-hidden text-center ${hero.heightClass}`} style={heroStyle}>
          {!heroImage && (
            <div className="absolute inset-0 pointer-events-none" style={{ backgroundColor: `rgba(0,0,0,${hero.overlayAlpha})` }} />
          )}
          <div className="relative container mx-auto px-4">
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight" style={{ color: hero.textColor }}>
              {heading}
            </h1>
            {subheading && (
              <p className="mt-2 max-w-2xl mx-auto text-sm md:text-base opacity-85" style={{ color: hero.textColor }}>
                {subheading}
              </p>
            )}
            {showHeroCount && products.length > 0 && (
              <p className="text-sm mt-2 opacity-70" style={{ color: hero.textColor }}>
                {countLine}
              </p>
            )}
          </div>
          {wave}
        </div>
      )}

      {/* Collection hero — uses the collection thumbnail (or store hero image)
          as background when present */}
      {showHero && hero.enabled && isCollection && (
        <div className="relative overflow-hidden" style={heroStyle}>
          {!heroImage && (
            <div className="absolute inset-0 pointer-events-none" style={{ backgroundColor: `rgba(0,0,0,${hero.overlayAlpha})` }} />
          )}
          <div className={`relative container mx-auto px-4 ${hero.heightClass}`}>
            {/* Breadcrumb / back link */}
            {showBackLink && (
              <Link
                href={`${lp}/products`}
                className="inline-flex items-center gap-1 text-xs font-semibold opacity-85 hover:opacity-100 transition mb-4"
                style={{ color: hero.textColor }}
              >
                <BackChevron className="w-4 h-4" />
                {t('store.all_collections')}
              </Link>
            )}

            <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight drop-shadow-sm" style={{ color: hero.textColor }}>
              {collectionName}
            </h1>

            {showDescription && collectionDescription && (
              <div
                className="mt-3 max-w-2xl text-sm md:text-base opacity-85 leading-relaxed prose prose-invert [&_p]:my-1.5 [&_*]:!text-[color:inherit]"
                style={{ color: hero.textColor }}
                dangerouslySetInnerHTML={{ __html: collectionDescription }}
              />
            )}

            {showHeroCount && products.length > 0 && (
              <p className="mt-4 text-xs font-semibold opacity-70" style={{ color: hero.textColor }}>
                {countLine}
              </p>
            )}
          </div>
          {wave}
        </div>
      )}

      {/* Banner hidden — keep the page heading (and, on a collection, its name,
          description and back link) so the page still has an h1 that matches
          its JSON-LD instead of losing its title with the banner. */}
      {!(showHero && hero.enabled) && (
        <div className="container mx-auto px-4 pt-8">
          {isCollection && showBackLink && (
            <Link
              href={`${lp}/products`}
              className="inline-flex items-center gap-1 text-xs font-semibold text-gray-500 hover:text-gray-800 transition mb-3"
            >
              <BackChevron className="w-4 h-4" />
              {t('store.all_collections')}
            </Link>
          )}
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-gray-900">
            {isCollection ? collectionName : heading}
          </h1>
          {!isCollection && subheading && (
            <p className="mt-2 max-w-2xl text-sm md:text-base text-gray-500">{subheading}</p>
          )}
          {isCollection && showDescription && collectionDescription && (
            <div
              className="mt-3 max-w-2xl text-sm md:text-base text-gray-600 leading-relaxed prose [&_p]:my-1.5"
              dangerouslySetInnerHTML={{ __html: collectionDescription }}
            />
          )}
        </div>
      )}

      <div className="container mx-auto px-4 py-8">
        {!isCollection ? (
          <>
            {/* Search + filter bar */}
            {(showSearch || (showCollections && flatCollections.length > 0)) && (
              <div className="flex flex-col md:flex-row gap-4 mb-8">
                {showSearch && searchForm}

                {/* Store Collections — the creator's own categories. Admin/provider
                    taxonomy is intentionally hidden on the storefront. */}
                {showCollections && flatCollections.length > 0 && (
                  <div className="flex flex-col gap-3 md:flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-bold uppercase tracking-wide text-gray-500 shrink-0 me-1">
                        {t('store.store_collections')}
                      </span>
                      <Link
                        href={buildFilterUrl({ creator_category: null })}
                        className={`px-4 py-2 rounded-full text-xs font-semibold transition-all border ${
                          !creator_category
                            ? 'text-white shadow-sm border-transparent'
                            : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:shadow-sm'
                        }`}
                        style={!creator_category ? activePill : {}}
                      >
                        {t('product.all')}
                      </Link>
                      {flatCollections.map((cc) => {
                        const ccTranslation = pickCollectionTranslation(cc.translations, locale);
                        const isActive = creator_category === cc.slug;
                        return (
                          <Link
                            key={cc.id}
                            href={buildFilterUrl({ creator_category: cc.slug })}
                            className={`px-4 py-2 rounded-full text-xs font-semibold transition-all border ${
                              isActive
                                ? 'text-white shadow-sm border-transparent'
                                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:shadow-sm'
                            } ${cc.depth > 0 ? 'ms-4' : ''}`}
                            style={isActive ? activePill : {}}
                          >
                            {cc.depth > 0 ? '— ' : ''}
                            {ccTranslation?.name || 'Unnamed'}
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Sort + count bar. Stacks on mobile: the four sort pills don't fit
                beside the count on narrow screens, and an unwrapped row would
                overflow the page. */}
            {products.length > 0 && (showSort || showCount) && (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
                {showCount && <p className="text-sm text-gray-500 shrink-0">{countLine}</p>}
                {showSort && (
                  <div className="flex items-center gap-1.5 min-w-0">
                    <ArrowUpDown className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                    {sortPills}
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <>
            {/* Search form scoped to this collection + sort */}
            {(showSearch || (showSort && products.length > 0)) && (
              <div className="flex flex-col md:flex-row gap-4 mb-8 items-start md:items-center justify-between">
                {showSearch && searchForm}

                {/* Sort */}
                {showSort && products.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    <ArrowUpDown className="w-3.5 h-3.5 text-gray-400" />
                    {sortPills}
                  </div>
                )}
              </div>
            )}

            {/* Sub-collections strip — if this collection has children, render them as quick links */}
            {showCollections && subCollections.length > 0 && (
              <div className="mb-8 flex flex-wrap gap-2">
                {subCollections.map((child) => {
                  const tr = pickCollectionTranslation(child.translations, locale);
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
          </>
        )}

        {/* Products grid */}
        {products.length === 0 ? emptyState : grid}
      </div>
    </section>
  );
}
