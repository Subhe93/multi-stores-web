'use client';

// Component implementation. Definition stays in CollectionProducts.tsx so the
// server-side theme registry can read `.Component` as a ClientReference.
// Mirrors FeaturedProducts but pulls from a specific category instead of the
// newest/featured catalogue-wide list.

import { useEffect, useId, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { resolveMediaUrl, storefront } from '@/lib/api';
import type { SectionRenderProps } from '../../types';
import { colorOr } from '../../elementStyles';

interface ProductRow {
  id: string;
  base_price: number;
  compare_at_price?: number;
  translations: Array<{ locale: string; title?: string; slug?: string }>;
  images: Array<{ url: string }>;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export function CollectionProducts({ settings, content, locale, primaryLocale, storeSlug, currency }: SectionRenderProps) {
  const heading = (content.heading as string) || '';
  const subheading = (content.subheading as string) || '';
  // Stores a creator-category SLUG (picked from the builder dropdown). The
  // storefront resolves it via the `creator_category` filter.
  const categorySlug = (settings.category as string) || '';
  const limit = clamp((settings.limit as number) ?? 8, 1, 24);
  const columns = clamp((settings.columns as number) ?? 4, 1, 6);
  const columnsTablet = clamp((settings.columns_tablet as number) ?? Math.min(columns, 3), 1, 6);
  const columnsMobile = clamp((settings.columns_mobile as number) ?? Math.min(columnsTablet, 2), 1, 4);
  const linkLabel = (content.link_label as string) || (locale === 'ar' ? 'عرض الكل' : 'View all');
  const localePrefix = locale && locale !== primaryLocale ? `/${locale}` : '';
  const linkUrl = (settings.link_url as string) || `${localePrefix}/products`;
  const scopeClass = `cp-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;

  const [products, setProducts] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch on mount + whenever the category/locale/limit change. Public
  // storefront API so this also works inside the builder iframe (no token).
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params: Record<string, string> = { locale, limit: String(limit) };
    if (categorySlug) params.creator_category = categorySlug;
    storefront
      .getProducts(storeSlug, params)
      .then((list) => {
        if (!cancelled) setProducts((list as ProductRow[]).slice(0, limit));
      })
      .catch(() => {
        if (!cancelled) setProducts([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [storeSlug, locale, limit, categorySlug]);

  const c = currency || 'EUR';
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
              className="aspect-square animate-pulse"
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
              ? categorySlug
                ? 'لا توجد منتجات في هذه الفئة بعد.'
                : 'اختر فئة من البيلدر لعرض منتجاتها.'
              : categorySlug
                ? 'No products in this category yet.'
                : 'Pick a category from the builder to show its products.'}
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
                  className="card-media-lift relative aspect-square overflow-hidden"
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
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm font-semibold" style={{ color: 'var(--theme-colors-primary)' }}>
                      {fmt(Number(p.base_price))}
                    </span>
                    {p.compare_at_price && p.compare_at_price > p.base_price && (
                      <span className="text-xs line-through" style={{ color: 'var(--theme-colors-muted)' }}>
                        {fmt(Number(p.compare_at_price))}
                      </span>
                    )}
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
