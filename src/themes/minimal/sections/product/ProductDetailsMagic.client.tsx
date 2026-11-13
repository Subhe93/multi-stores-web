'use client';

// Component implementation. Definition lives in ProductDetailsMagic.tsx.
//
// Product layout wave 2 (B1): the section used to be a server file calling
// client hooks (useTranslations / useDisplayPrice) and always showed the
// product's base price plus a made-up "(24 reviews)" row. It is now a
// client island on the page's shared product state: the title, the line
// price (variant, bundle, personalization and quantity aware, b2b net via
// useDisplayPrice) and the short description agree with every other block.
// The saved settings keep their names; `show_rating` is no longer rendered
// (there are no real reviews yet).

import { Heart, Share2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { PriceTaxSuffix } from '@/components/product/PriceTaxSuffix';
import { formatPrice } from '@/lib/format';
import type { SectionRenderProps } from '../../../types';
import { B1Placeholder, isBlockPreview, useBlockState } from './blocks/b1Shared';

export function ProductDetailsMagic(props: SectionRenderProps) {
  const { settings, content, locale } = props;
  const t = useTranslations('product');
  const state = useBlockState(props);
  if (!state) {
    return <B1Placeholder preview={isBlockPreview(props)} locale={locale} label={{ en: 'Product details', ar: 'تفاصيل المنتج' }} />;
  }

  const showPrice = settings.show_price !== false;
  const showCompareAt = settings.show_compare_at !== false;
  const showDescription = settings.show_description !== false;
  const showShare = settings.show_share === true;
  const showSaleBadge = settings.show_sale_badge !== false;

  const { product, translation, currency, taxRateBp, display, displayPrice, displayComparePrice } = state;
  const title = translation?.title || (content.fallback_title as string) || 'Product';
  const description = translation?.description;
  const shortDescription = translation?.short_description;
  const money = (n: number) => formatPrice(display(n, taxRateBp, currency).amount, currency, state.locale);

  const hasCompareAt = displayComparePrice !== undefined && displayComparePrice > displayPrice;
  const discount = hasCompareAt
    ? Math.round(((displayComparePrice - displayPrice) / displayComparePrice) * 100)
    : 0;

  return (
    <section className="space-y-5">
      {/* Sale badge */}
      {showSaleBadge && hasCompareAt && (
        <div className="flex flex-wrap gap-2">
          <span
            className="text-[11px] font-bold uppercase tracking-wide px-2 py-0.5"
            style={{
              backgroundColor: 'var(--theme-colors-sale, var(--theme-colors-accent))',
              color: 'var(--theme-colors-saleContrast, var(--theme-colors-accentContrast, #fff))',
              borderRadius: 'var(--theme-radius-sm)',
            }}
          >
            -{discount}%
          </span>
        </div>
      )}

      {/* Title (+ marketplace vendor line when the store exposes it) */}
      <div className="space-y-1">
        <h1
          style={{
            fontFamily: 'var(--theme-font-heading)',
            fontSize: 'var(--theme-scale-h2)',
            lineHeight: 'var(--theme-line-heading)',
            fontWeight: 'var(--theme-weight-heading)',
            color: 'var(--theme-colors-text)',
          }}
        >
          {title}
        </h1>
        {product.vendor?.company_name && (
          <p className="text-sm" style={{ color: 'var(--theme-colors-muted)' }}>
            {t('soldBy', { name: product.vendor.company_name })}
          </p>
        )}
      </div>

      {/* Price: the line price of the shared state (unit × quantity). */}
      {showPrice && (
        <div className="flex items-baseline gap-3">
          <span
            data-product-price=""
            style={{
              fontSize: 'var(--theme-scale-h3)',
              fontWeight: 'var(--theme-weight-bold)',
              color: 'var(--theme-colors-price, var(--theme-colors-primary))',
              textShadow: 'var(--theme-price-shadow, none)', backgroundColor: 'var(--theme-price-bg, transparent)', padding: 'var(--theme-price-pad, 0)', borderRadius: '0.375rem',
            }}
          >
            {money(displayPrice)}
          </span>
          {showCompareAt && hasCompareAt && (
            <span
              className="line-through"
              style={{
                fontSize: 'var(--theme-scale-body)',
                color: 'var(--theme-colors-muted)',
              }}
            >
              {money(displayComparePrice)}
            </span>
          )}
          <PriceTaxSuffix className="text-xs" style={{ color: 'var(--theme-colors-muted)' }} taxRateBp={taxRateBp} />
        </div>
      )}

      {/* Short description: HTML sanitized by the API on every write (sanitizeCreatorHtml), only when set. Same
          block as ProductDetailClient: wraps long words, scales images, and
          scrolls wide tables instead of overflowing the column (RTL-safe). */}
      {shortDescription && (
        <div
          className="prose prose-sm max-w-none leading-relaxed wrap-break-word [&_img]:h-auto [&_img]:max-w-full [&_table]:block [&_table]:overflow-x-auto"
          style={{ color: 'var(--theme-colors-muted)' }}
          dangerouslySetInnerHTML={{ __html: shortDescription }}
        />
      )}

      {/* Description */}
      {showDescription && description && (
        <div
          className="prose prose-sm max-w-none"
          style={{ color: 'var(--theme-colors-text)' }}
          dangerouslySetInnerHTML={{ __html: description }}
        />
      )}

      {/* Share / wishlist row */}
      {showShare && (
        <div
          className="flex items-center gap-2 pt-3"
          style={{ borderTop: '1px solid var(--theme-colors-border)' }}
        >
          <button
            type="button"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs transition hover:bg-zinc-50"
            style={{
              border: '1px solid var(--theme-colors-border)',
              borderRadius: 'var(--theme-radius-sm)',
              color: 'var(--theme-colors-text)',
            }}
          >
            <Heart className="size-3.5" />
            {locale === 'ar' ? 'حفظ' : 'Save'}
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs transition hover:bg-zinc-50"
            style={{
              border: '1px solid var(--theme-colors-border)',
              borderRadius: 'var(--theme-radius-sm)',
              color: 'var(--theme-colors-text)',
            }}
          >
            <Share2 className="size-3.5" />
            {locale === 'ar' ? 'مشاركة' : 'Share'}
          </button>
        </div>
      )}
    </section>
  );
}
