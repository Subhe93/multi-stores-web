'use client';

// Sibling of FeaturedProducts: same data fetch, different presentation.
// Renders products as a horizontal slider instead of a grid.

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronRight } from 'lucide-react';
import { resolveMediaUrl, storefront } from '@/lib/api';
import { productSliderLimit, productSliderParams } from '@/lib/preloadSections';
import { isSvgSrc } from '@/lib/storeMedia';
import { StoreImage } from '@/components/StoreImage';
import type { SectionRenderProps } from '../../types';
import { colorOr } from '../../elementStyles';
import { Slider } from './_shared/Slider.client';
import { PriceTaxSuffix } from '@/components/product/PriceTaxSuffix';
import { useDisplayPrice } from '@/hooks/useDisplayPrice';
import { useMarket } from '@/hooks/useMarket';
import { headingTag, textTag } from './_shared/headingLevel';
import { Heading } from './_shared/Heading';

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

// Card image aspect ratio — same option set as featured-products/collection-products.
const CARD_ASPECT: Record<string, string> = {
  square: 'aspect-square',
  portrait: 'aspect-[4/5]',
  landscape: 'aspect-[4/3]',
};

export function ProductSlider({ settings, content, locale, primaryLocale, storeSlug, currency, preloaded }: SectionRenderProps) {
  const tCommon = useTranslations('common');
  const headingLevel = headingTag(settings.heading_level, 'h2');
  const subheadingTag = textTag(settings.subheading_tag, 'p');
  const heading = (content.heading as string) || '';
  const subheading = (content.subheading as string) || '';
  const filter = (settings.filter as 'newest' | 'featured') || 'newest';
  const aspectClass = CARD_ASPECT[(settings.aspect as string) || 'square'] || CARD_ASPECT.square;
  const limit = productSliderLimit(settings);
  const spvDesktop = clamp((settings.slides_per_view as number) ?? 4, 1, 6);
  const spvTablet = clamp((settings.slides_per_view_tablet as number) ?? 3, 1, 6);
  const spvMobile = clamp((settings.slides_per_view_mobile as number) ?? 1.5, 1, 4);
  const gapPx = clamp((settings.gap_px as number) ?? 16, 0, 64);
  const autoplayMs = (settings.autoplay_ms as number) || 0;
  const showArrows = settings.show_arrows !== false;
  const showDots = settings.show_dots !== false;
  const loop = settings.loop === true;
  const linkLabel = ((content.link_label as string) || '').trim() || tCommon('viewAll');
  // Storefront routes are exposed under the store's subdomain (see proxy.ts);
  // the secondary-locale prefix is the only thing we add to the public path.
  const localePrefix = locale && locale !== primaryLocale ? `/${locale}` : '';
  const linkUrl = (settings.link_url as string) || `${localePrefix}/products`;
  const dir: 'ltr' | 'rtl' = locale === 'ar' ? 'rtl' : 'ltr';
  // Card image `sizes` from slides-per-view (Slider breakpoints: 768 / 1024).
  const imageSizes = `(max-width: 767px) ${Math.ceil(100 / spvMobile)}vw, (max-width: 1023px) ${Math.ceil(100 / spvTablet)}vw, ${Math.ceil(100 / spvDesktop)}vw`;

  const t = useTranslations('product');

  // Markets app: prices come back in the market currency (and a draft
  // market on its preview host needs the preview flag). Undefined without
  // the app, so the request URL is unchanged for other stores.
  const market = useMarket();
  const marketKey = market?.key;
  const marketPreview = market?.preview === true;

  // Keyed by the request it answers, like FeaturedProducts: server-preloaded
  // products (lib/preloadSections.ts) seed the state under the mount key, so
  // the server HTML has the slides and the mount fetch is skipped; a change
  // of any dep yields a new key and re-fetches.
  const requestKey = [storeSlug, locale, limit, filter, marketKey ?? '', marketPreview ? '1' : ''].join('|');
  const [loaded, setLoaded] = useState<{ key: string; products: ProductRow[] } | null>(() =>
    Array.isArray(preloaded) ? { key: requestKey, products: preloaded as ProductRow[] } : null,
  );
  const loading = loaded?.key !== requestKey;
  const products = loaded?.key === requestKey ? loaded.products : [];
  const loadedKeyRef = useRef<string | null>(loaded?.key ?? null);

  useEffect(() => {
    if (loadedKeyRef.current === requestKey) return;
    let cancelled = false;
    const marketRef = marketKey ? (marketPreview ? { key: marketKey, preview: true as const } : { key: marketKey }) : undefined;
    const params = productSliderParams({ locale, limit, filter });
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
  }, [requestKey, storeSlug, locale, limit, filter, marketKey, marketPreview]);

  const c = currency || 'EUR';
  // b2b app: company view shows net amounts.
  const display = useDisplayPrice();
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
    const imageSrc = p.images?.[0]?.url ? resolveMediaUrl(p.images[0].url) : '';
    return (
      <a key={p.id} href={url} className="group block h-full">
        <div
          className={`relative ${aspectClass} overflow-hidden`}
          style={{
            backgroundColor: 'var(--theme-colors-surface)',
            borderRadius: 'var(--theme-radius-md)',
          }}
        >
          {imageSrc ? (
            <StoreImage
              src={imageSrc}
              alt={tr?.title || ''}
              fill
              sizes={imageSizes}
              unoptimized={isSvgSrc(imageSrc)}
              className="object-cover transition-transform duration-500 group-hover:scale-105"
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
          {p.vendor?.company_name && (
            <p className="text-xs truncate" style={{ color: 'var(--theme-colors-muted)' }}>
              {t('soldBy', { name: p.vendor.company_name })}
            </p>
          )}
          <div className="flex items-baseline gap-2">
            <span
              className="text-sm font-semibold"
              style={{ color: 'var(--theme-colors-price, var(--theme-colors-primary))', textShadow: 'var(--theme-price-shadow, none)', backgroundColor: 'var(--theme-price-bg, transparent)', padding: 'var(--theme-price-pad, 0)', borderRadius: '0.375rem' }}
            >
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
  });

  return (
    <section className="py-12">
      <div className="flex items-end justify-between mb-8 gap-4">
        <div>
          {heading && (
            <Heading level={headingLevel}
              style={{
                fontFamily: 'var(--theme-font-heading)',
                fontSize: 'var(--theme-scale-h2)',
                fontWeight: 'var(--theme-weight-heading)',
                lineHeight: 'var(--theme-line-heading)',
                color: colorOr(settings.heading_color, 'var(--theme-colors-text)'),
              }}
            >
              {heading}
            </Heading>
          )}
          {subheading && (
            <Heading level={subheadingTag} look="body" className="text-sm mt-1" style={{ color: colorOr(settings.subheading_color, 'var(--theme-colors-muted)') }}>
              {subheading}
            </Heading>
          )}
        </div>
        {linkLabel && (
          <a
            href={linkUrl}
            className="inline-flex items-center gap-1 text-sm font-semibold shrink-0 hover:opacity-70 transition-opacity"
            style={{ color: colorOr(settings.link_color, 'var(--theme-colors-link, var(--theme-colors-price, var(--theme-colors-primary)))') }}
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
              className={`${aspectClass} animate-pulse flex-1`}
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
