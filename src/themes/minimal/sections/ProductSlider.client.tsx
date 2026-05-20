'use client';

// Sibling of FeaturedProducts: same data fetch, different presentation.
// Renders products as a horizontal slider instead of a grid.

import { useEffect, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { resolveMediaUrl, storefront } from '@/lib/api';
import type { SectionRenderProps } from '../../types';
import { colorOr } from '../../elementStyles';
import { Slider } from './_shared/Slider.client';

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

export function ProductSlider({ settings, content, locale, primaryLocale, storeSlug, currency }: SectionRenderProps) {
  const heading = (content.heading as string) || '';
  const subheading = (content.subheading as string) || '';
  const filter = (settings.filter as 'newest' | 'featured') || 'newest';
  const limit = clamp((settings.limit as number) ?? 8, 1, 24);
  const spvDesktop = clamp((settings.slides_per_view as number) ?? 4, 1, 6);
  const spvTablet = clamp((settings.slides_per_view_tablet as number) ?? 3, 1, 6);
  const spvMobile = clamp((settings.slides_per_view_mobile as number) ?? 1.5, 1, 4);
  const gapPx = clamp((settings.gap_px as number) ?? 16, 0, 64);
  const autoplayMs = (settings.autoplay_ms as number) || 0;
  const showArrows = settings.show_arrows !== false;
  const showDots = settings.show_dots !== false;
  const loop = settings.loop === true;
  const linkLabel = (content.link_label as string) || (locale === 'ar' ? 'عرض الكل' : 'View all');
  // Storefront routes are exposed under the store's subdomain (see proxy.ts);
  // the secondary-locale prefix is the only thing we add to the public path.
  const localePrefix = locale && locale !== primaryLocale ? `/${locale}` : '';
  const linkUrl = (settings.link_url as string) || `${localePrefix}/products`;
  const dir: 'ltr' | 'rtl' = locale === 'ar' ? 'rtl' : 'ltr';

  const [products, setProducts] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params: Record<string, string> = { locale, limit: String(limit) };
    if (filter === 'featured') params.featured = 'true';
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
  }, [storeSlug, locale, limit, filter]);

  const c = currency || 'EUR';
  const fmt = (n: number) =>
    new Intl.NumberFormat(locale === 'ar' ? 'ar' : locale, {
      style: 'currency',
      currency: c,
      maximumFractionDigits: 2,
    }).format(n);

  const slideNodes = products.map((p) => {
    // Title comes from the active locale (with primary as fallback).
    const tr =
      p.translations.find((t) => t.locale === locale) ||
      p.translations.find((t) => t.locale === primaryLocale) ||
      p.translations[0];
    // Slug uses the primary locale so the URL stays canonical.
    const slugTr =
      p.translations.find((t) => t.locale === primaryLocale) ||
      p.translations.find((t) => t.locale === locale) ||
      p.translations[0];
    const productPath = slugTr?.slug || p.id;
    const url = `${localePrefix}/products/${productPath}`;
    return (
      <a key={p.id} href={url} className="group block h-full">
        <div
          className="aspect-square overflow-hidden"
          style={{
            backgroundColor: 'var(--theme-colors-surface)',
            borderRadius: 'var(--theme-radius-md)',
          }}
        >
          {p.images?.[0]?.url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={resolveMediaUrl(p.images[0].url)}
              alt={tr?.title || ''}
              loading="lazy"
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : null}
        </div>
        <div className="mt-3 space-y-1">
          <p
            className="text-sm font-medium line-clamp-2"
            style={{ color: 'var(--theme-colors-text)' }}
          >
            {tr?.title || ''}
          </p>
          <div className="flex items-baseline gap-2">
            <span
              className="text-sm font-semibold"
              style={{ color: 'var(--theme-colors-primary)' }}
            >
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
  });

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
            <ChevronRight className="size-3.5 rtl:rotate-180" />
          </a>
        )}
      </div>

      {loading ? (
        <div className="flex gap-4">
          {Array.from({ length: spvDesktop }).map((_, i) => (
            <div
              key={i}
              className="aspect-square animate-pulse flex-1"
              style={{
                backgroundColor: 'var(--theme-colors-surface)',
                borderRadius: 'var(--theme-radius-md)',
              }}
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
            {locale === 'ar' ? 'لا توجد منتجات لعرضها بعد' : 'No products to show yet.'}
          </p>
        </div>
      ) : (
        <Slider
          slides={slideNodes}
          slidesPerView={spvDesktop}
          slidesPerViewTablet={spvTablet}
          slidesPerViewMobile={spvMobile}
          gapPx={gapPx}
          autoplayMs={autoplayMs > 0 ? autoplayMs : undefined}
          showArrows={showArrows}
          showDots={showDots}
          loop={loop}
          dir={dir}
          ariaLabel={locale === 'ar' ? 'سلايدر المنتجات' : 'Product slider'}
        />
      )}
    </section>
  );
}
