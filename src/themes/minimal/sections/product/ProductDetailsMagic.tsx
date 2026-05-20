import { Heart, Share2, Star } from 'lucide-react';
import type { SectionDefinition, SectionRenderProps } from '../../../types';

function ProductDetailsMagic({ settings, content, locale, product, currency }: SectionRenderProps) {
  if (!product) {
    return (
      <div
        className="text-center py-12 px-4"
        style={{
          backgroundColor: 'var(--theme-colors-surface)',
          border: '1px dashed var(--theme-colors-border)',
          borderRadius: 'var(--theme-radius-md)',
        }}
      >
        <div className="text-xs uppercase tracking-wide text-[var(--theme-colors-muted)] mb-1">
          Product details
        </div>
        <p className="text-xs text-[var(--theme-colors-muted)]">
          Pick a sample product to preview.
        </p>
      </div>
    );
  }

  const showPrice = settings.show_price !== false;
  const showCompareAt = settings.show_compare_at !== false;
  const showDescription = settings.show_description !== false;
  const showRating = settings.show_rating === true;
  const showShare = settings.show_share === true;
  const showSaleBadge = settings.show_sale_badge !== false;

  const tr =
    product.translations.find((t) => t.locale === locale) ||
    product.translations.find((t) => t.locale === 'en') ||
    product.translations[0];
  const title = tr?.title || (content.fallback_title as string) || 'Product';
  const description = tr?.description;

  const c = currency || 'EUR';
  const formatPrice = (n: number) =>
    new Intl.NumberFormat(locale === 'ar' ? 'ar' : locale, {
      style: 'currency',
      currency: c,
      maximumFractionDigits: 2,
    }).format(n);

  const hasCompareAt = !!product.compare_at_price && product.compare_at_price > product.base_price;
  const discount = hasCompareAt
    ? Math.round(((product.compare_at_price! - product.base_price) / product.compare_at_price!) * 100)
    : 0;

  return (
    <section className="space-y-5">
      {/* Sale badge */}
      {showSaleBadge && hasCompareAt && (
        <div className="flex flex-wrap gap-2">
          <span
            className="text-[11px] font-bold uppercase tracking-wide px-2 py-0.5"
            style={{
              backgroundColor: 'var(--theme-colors-accent)',
              color: 'var(--theme-colors-primaryContrast, #fff)',
              borderRadius: 'var(--theme-radius-sm)',
            }}
          >
            {locale === 'ar' ? `خصم ${discount}%` : `Save ${discount}%`}
          </span>
        </div>
      )}

      {/* Title */}
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

      {/* Rating row */}
      {showRating && (
        <div className="flex items-center gap-2">
          <div className="flex">
            {[1, 2, 3, 4, 5].map((s) => (
              <Star
                key={s}
                className="size-3.5"
                fill="var(--theme-colors-accent)"
                stroke="none"
              />
            ))}
          </div>
          <span className="text-xs" style={{ color: 'var(--theme-colors-muted)' }}>
            {locale === 'ar' ? '(٢٤ تقييم)' : '(24 reviews)'}
          </span>
        </div>
      )}

      {/* Price */}
      {showPrice && (
        <div className="flex items-baseline gap-3">
          <span
            style={{
              fontSize: 'var(--theme-scale-h3)',
              fontWeight: 'var(--theme-weight-bold)',
              color: 'var(--theme-colors-primary)',
            }}
          >
            {formatPrice(Number(product.base_price))}
          </span>
          {showCompareAt && hasCompareAt && (
            <span
              className="line-through"
              style={{
                fontSize: 'var(--theme-scale-body)',
                color: 'var(--theme-colors-muted)',
              }}
            >
              {formatPrice(Number(product.compare_at_price))}
            </span>
          )}
        </div>
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

export const productDetailsMagicSection: SectionDefinition = {
  schema: {
    id: 'product-details',
    label: { en: 'Product Details', ar: 'تفاصيل المنتج' },
    icon: 'info',
    category: 'commerce',
    description: {
      en: 'Magic section. Title, price, description, with optional sale badge, rating row, and share buttons.',
      ar: 'قسم سحري. عنوان وسعر ووصف، مع شارة خصم، تقييم، وأزرار مشاركة.',
    },
    translatable: [],
    schema: [
      { key: 'show_sale_badge', type: 'boolean', label: { en: 'Show sale badge', ar: 'شارة الخصم' }, defaultValue: true },
      { key: 'show_rating', type: 'boolean', label: { en: 'Show rating row', ar: 'صف التقييم' }, defaultValue: false },
      { key: 'show_price', type: 'boolean', label: { en: 'Show price', ar: 'إظهار السعر' }, defaultValue: true },
      { key: 'show_compare_at', type: 'boolean', label: { en: 'Show compare-at price', ar: 'السعر قبل الخصم' }, defaultValue: true },
      { key: 'show_description', type: 'boolean', label: { en: 'Show description', ar: 'إظهار الوصف' }, defaultValue: true },
      { key: 'show_share', type: 'boolean', label: { en: 'Show share/wishlist', ar: 'مشاركة/قائمة الأمنيات' }, defaultValue: false },
    ],
  },
  Component: ProductDetailsMagic,
  defaultSettings: {
    show_sale_badge: true,
    show_rating: false,
    show_price: true,
    show_compare_at: true,
    show_description: true,
    show_share: false,
  },
};
