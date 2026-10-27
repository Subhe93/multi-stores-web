'use client';

// Component implementation. Definition stays in CollectionProducts.tsx so the
// server-side theme registry can read `.Component` as a ClientReference.
// Mirrors FeaturedProducts but pulls from a specific category instead of the
// newest/featured catalogue-wide list.

import { useEffect, useId, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronRight } from 'lucide-react';
import { resolveMediaUrl, storefront } from '@/lib/api';
import { collectionProductsParams } from '@/lib/preloadSections';
import { storeHref } from '@/lib/storeUrl';
import type { SectionRenderProps } from '../../types';
import { colorOr } from '../../elementStyles';
import { PriceTaxSuffix } from '@/components/product/PriceTaxSuffix';
import { useDisplayPrice } from '@/hooks/useDisplayPrice';
import { useMarket } from '@/hooks/useMarket';

interface ProductRow {
  id: string;
  base_price: number;
  compare_at_price?: number;
  /** b2b app only: estimated tax rate for the company net view. */
  tax_rate_bp?: number | null;
  translations: Array<{ locale: string; title?: string; slug?: string }>;
  images: Array<{ url: string }>;
  vendor?: { company_name: string } | null;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

// Card image aspect ratio — same option set as featured-products/product-slider.
const CARD_ASPECT: Record<string, string> = {
  square: 'aspect-square',
  portrait: 'aspect-[4/5]',
  landscape: 'aspect-[4/3]',
};

export function CollectionProducts({ settings, content, locale, primaryLocale, storeSlug, currency, preloaded }: SectionRenderProps) {
  const heading = (content.heading as string) || '';
  const subheading = (content.subheading as string) || '';
  // `settings.category` is a collection id (uuid, picked since M6.4 — may be
  // an INTERNAL label) or a legacy collection slug. The request params map
  // it to `creator_category_id` / `creator_category`; shared with the
  // server-side preload so both fetch exactly the same list.
  const categoryRef = (settings.category as string) || '';
  const limit = clamp((settings.limit as number) ?? 8, 1, 24);
  const aspectClass = CARD_ASPECT[(settings.aspect as string) || 'square'] || CARD_ASPECT.square;
  const columns = clamp((settings.columns as number) ?? 4, 1, 6);
  const columnsTablet = clamp((settings.columns_tablet as number) ?? Math.min(columns, 3), 1, 6);
  const columnsMobile = clamp((settings.columns_mobile as number) ?? Math.min(columnsTablet, 2), 1, 4);
  const linkLabel = (content.link_label as string) || (locale === 'ar' ? 'عرض الكل' : 'View all');
  const localePrefix = locale && locale !== primaryLocale ? `/${locale}` : '';
  const linkUrl = storeHref((settings.link_url as string) || `${localePrefix}/products`);
  const scopeClass = `cp-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;

  const t = useTranslations('product');

  // Markets app: prices come back in the market currency (and a draft
  // market on its preview host needs the preview flag). Undefined without
  // the app, so the request URL is unchanged for other stores.
  const market = useMarket();
  const marketKey = market?.key;
  const marketPreview = market?.preview === true;

  // The list is keyed by the request it answers. `loading` is derived from
  // "requested key !== loaded key", so the effect never sets state
  // synchronously (react-hooks rule) and a re-run with the same key (strict
  // mode) is a no-op. Server-preloaded products (M6.4) seed the state under
  // the mount key, so the server HTML and the client's first render are
  // identical and the mount fetch is skipped; any later change of the deps
  // yields a new key and re-fetches as before.
  const requestKey = [storeSlug, locale, limit, categoryRef, marketKey ?? '', marketPreview ? '1' : ''].join('|');
  const [loaded, setLoaded] = useState<{ key: string; products: ProductRow[] } | null>(() =>
    Array.isArray(preloaded) ? { key: requestKey, products: preloaded as ProductRow[] } : null,
  );
  const loading = loaded?.key !== requestKey;
  const products = loaded?.key === requestKey ? loaded.products : [];
  const loadedKeyRef = useRef<string | null>(loaded?.key ?? null);

  // Fetch on mount (unless preloaded) + whenever the category/locale/limit/
  // market change. Public storefront API so this also works inside the
  // builder iframe (no token).
  useEffect(() => {
    if (loadedKeyRef.current === requestKey) return;
    let cancelled = false;
    const marketRef = marketKey ? (marketPreview ? { key: marketKey, preview: true as const } : { key: marketKey }) : undefined;
    const params = collectionProductsParams({ locale, limit, category: categoryRef });
    const settle = (list: ProductRow[]) => {
      if (cancelled) return;
      loadedKeyRef.current = requestKey;
      setLoaded({ key: requestKey, products: list });
    };
    storefront
      .getProducts(storeSlug, params, marketRef)
      .then((list) => settle((list as ProductRow[]).slice(0, limit)))
      .catch(() => settle([]));
    return () => {
      cancelled = true;
    };
  }, [requestKey, storeSlug, locale, limit, categoryRef, marketKey, marketPreview]);

  const c = currency || 'EUR';
  // b2b app: company view shows net amounts.
  const display = useDisplayPrice();
  const fmt = (n: number) =>
    new Intl.NumberFormat(locale === 'ar' ? 'ar' : locale, {
      style: 'currency',
      currency: c,
      maximumFractionDigits: 2,
    }).format(n);

  return (
    <section className="py-12">
      <div className="flex items-end justify-between mb-8 gap-4">
        <div>
          {heading && (
            <h2
              style={{
                fontFamily: 'var(--theme-font-heading)',
                fontSize: 'var(--theme-scale-h2)',
                fontWeight: 'var(--theme-weight-heading)',
                lineHeight: 'var(--theme-line-heading)',
                color: colorOr(settings.heading_color, 'var(--theme-colors-text)'),
              }}
            >
              {heading}
            </h2>
          )}
          {subheading && (
            <p className="text-sm mt-1" style={{ color: colorOr(settings.subheading_color, 'var(--theme-colors-muted)') }}>
              {subheading}
            </p>
          )}
        </div>
        {linkLabel && (
          <a
            href={linkUrl}
            className="inline-flex items-center gap-1 text-sm font-semibold shrink-0 hover:opacity-70 transition-opacity"
            style={{ color: colorOr(settings.link_color, 'var(--theme-colors-primary)') }}
          >
            {linkLabel}
            <ChevronRight className="size-3.5" />
          </a>
        )}
      </div>

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

      {loading ? (
        <div className={`grid gap-4 ${scopeClass}`}>
          {Array.from({ length: limit }).map((_, i) => (
            <div
              key={i}
              className={`${aspectClass} animate-pulse`}
              style={{ backgroundColor: 'var(--theme-colors-surface)', borderRadius: 'var(--theme-radius-md)' }}
            />
          ))}
        </div>
      ) : products.length === 0 ? (
        <div
          className="text-center py-10 px-4"
          style={{
            border: '1px dashed var(--theme-colors-border)',
            borderRadius: 'var(--theme-radius-md)',
            color: 'var(--theme-colors-muted)',
          }}
        >
          <p className="text-sm">
            {locale === 'ar'
              ? categoryRef
                ? 'لا توجد منتجات في هذه المجموعة بعد.'
                : 'اختر مجموعة من البيلدر لعرض منتجاتها.'
              : categoryRef
                ? 'No products in this collection yet.'
                : 'Pick a collection from the builder to show its products.'}
          </p>
        </div>
      ) : (
        <div className={`grid gap-4 ${scopeClass}`}>
          {products.map((p) => {
            const tr =
              p.translations.find((t) => t.locale === locale) ||
              p.translations.find((t) => t.locale === primaryLocale) ||
              p.translations[0];
            const slugTr =
              p.translations.find((t) => t.locale === primaryLocale) ||
              p.translations.find((t) => t.locale === locale) ||
              p.translations[0];
            const productPath = slugTr?.slug || p.id;
            const url = `${localePrefix}/products/${productPath}`;
            // Discount badge — shown only when there's a genuine markdown.
            const discount =
              p.compare_at_price && p.compare_at_price > p.base_price
                ? Math.round((1 - Number(p.base_price) / Number(p.compare_at_price)) * 100)
                : 0;
            return (
              <a key={p.id} href={url} className="group block">
                <div
                  className={`card-media-lift relative ${aspectClass} overflow-hidden`}
                  style={{ backgroundColor: 'var(--theme-colors-surface)', borderRadius: 'var(--theme-radius-md)' }}
                >
                  {discount > 0 && (
                    <span
                      className="absolute top-2 inset-s-2 z-10 rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums"
                      style={{ backgroundColor: 'var(--theme-colors-accent)', color: '#fff' }}
                    >
                      -{discount}%
                    </span>
                  )}
                  {p.images?.[0]?.url ? (
                    <img
                      src={resolveMediaUrl(p.images[0].url)}
                      alt={tr?.title || ''}
                      loading="lazy"
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : null}
                </div>
                <div className="mt-3 space-y-1">
                  <p className="text-sm font-medium line-clamp-2" style={{ color: 'var(--theme-colors-text)' }}>
                    {tr?.title || ''}
                  </p>
                  {p.vendor?.company_name && (
                    <p className="text-xs truncate" style={{ color: 'var(--theme-colors-muted)' }}>
                      {t('soldBy', { name: p.vendor.company_name })}
                    </p>
                  )}
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm font-semibold" style={{ color: 'var(--theme-colors-primary)' }}>
                      {fmt(display(Number(p.base_price), p.tax_rate_bp, c).amount)}
                    </span>
                    {p.compare_at_price && p.compare_at_price > p.base_price && (
                      <span className="text-xs line-through" style={{ color: 'var(--theme-colors-muted)' }}>
                        {fmt(display(Number(p.compare_at_price), p.tax_rate_bp, c).amount)}
                      </span>
                    )}
                    <PriceTaxSuffix className="text-[11px]" style={{ color: 'var(--theme-colors-muted)' }} taxRateBp={p.tax_rate_bp} />
                  </div>
                </div>
              </a>
            );
          })}
        </div>
      )}
    </section>
  );
}
