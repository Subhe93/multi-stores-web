'use client';

// Enhanced product card. OWNER: builder W1.
//
// Rendered by StoreProductCard only for a store that opted in
// (theme_customizations.product.card); the classic ProductCard is untouched.
//
// Structure, the same in every mode: an <article> with ONE link (the title,
// stretched over the whole card by ::after) and the buttons as siblings of
// that link, above it. A button inside a link is invalid markup, and this is
// what lets quick add (and later the wishlist heart) sit on the image.
// Styling lives in pcard.css.

import Link from 'next/link';
import { Eye } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { StoreImage } from '@/components/StoreImage';
import { PriceTaxSuffix } from '@/components/product/PriceTaxSuffix';
import { useDisplayPrice } from '@/hooks/useDisplayPrice';
import { resolveMediaUrl } from '@/lib/api';
import { isSvgSrc } from '@/lib/storeMedia';
import { hover, item } from '@/themes/creative/recipes';
import { CardSizeLine } from './CardSizeLine';
import { CardSwatchList } from './CardSwatchList';
import { QuickAddButton } from './QuickAddButton.client';
import type { EnhancedCardProps } from './types';
import './pcard.css';

export function ProductCardEnhanced({
  settings,
  card,
  productId,
  productSlug,
  entrance,
  title,
  href,
  price,
  comparePrice,
  imageUrl,
  currency = 'EUR',
  badge,
  promotionLabel,
  aspectClass = 'aspect-square',
  vendorName,
  taxRateBp,
  priority = false,
  eager = false,
  sizes = '(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw',
  motion,
  arriving,
}: EnhancedCardProps) {
  const t = useTranslations('product');
  // The same price path as the classic card: company buyers see net amounts
  // and the tax suffix follows the store's settings.
  const display = useDisplayPrice();
  const fmt = (n: number) =>
    new Intl.NumberFormat('en', { style: 'currency', currency }).format(display(n, taxRateBp, currency).amount);

  const onSale = typeof comparePrice === 'number' && comparePrice > price;
  const discount = onSale ? Math.round(((comparePrice - price) / comparePrice) * 100) : 0;
  // The discount badge in the store's mode; a product on sale with a rounded
  // discount of 0 % still reads "Sale" in that mode.
  const saleBadge =
    settings.badge === 'percent' ? discount > 0 : settings.badge === 'sale' ? onSale : false;
  // As the classic card: the custom badge yields to a discount.
  const customBadge = badge && !discount ? badge : null;

  const editorial = settings.style === 'editorial';
  const secondImage =
    settings.hover_image && card?.second_image ? resolveMediaUrl(card.second_image) : null;
  // Callers pass the first image resolved or raw: compare both resolved.
  const altUrl = secondImage && secondImage !== resolveMediaUrl(imageUrl) ? secondImage : null;

  const stock = settings.availability === 'off' ? null : (card?.stock ?? null);
  const soldOut = stock?.soldOut === true;
  const lowCount =
    !soldOut &&
    settings.availability === 'sold_out_and_low' &&
    typeof stock?.count === 'number' &&
    stock.count <= settings.low_stock_threshold
      ? stock.count
      : null;

  // Card root motion: the caller's own attributes, else derived exactly as
  // the classic card does (scroll stagger item; appended cards rise once).
  const rootMotion =
    entrance ??
    (!motion ? null : typeof arriving === 'number' ? { ...item('intro', arriving), 'data-cx-more': '' } : item('scroll', 0));

  return (
    <article
      className="pcard group"
      data-card-style={settings.style}
      data-corners={settings.corners}
      data-sold-out={soldOut ? '' : undefined}
      {...rootMotion}
    >
      <div className={`pcard-media ${aspectClass}`} {...hover(motion, 'media')}>
        {imageUrl ? (
          // Decorative: the card is named by its title link.
          <StoreImage
            src={imageUrl}
            alt=""
            fill
            sizes={sizes}
            preload={priority}
            fetchPriority={priority ? 'high' : undefined}
            loading={priority ? undefined : eager ? 'eager' : 'lazy'}
            unoptimized={isSvgSrc(imageUrl)}
            className="pcard-img"
          />
        ) : (
          <div className="pcard-placeholder" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1}>
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <path d="M3 9l4-4 4 4 4-4 4 4" />
              <circle cx="8.5" cy="8.5" r="1.5" />
            </svg>
          </div>
        )}

        {/* Second image: desktop pointer only (pcard.css), always lazy. */}
        {altUrl ? (
          <StoreImage
            src={altUrl}
            alt=""
            aria-hidden="true"
            fill
            sizes={sizes}
            loading="lazy"
            unoptimized={isSvgSrc(altUrl)}
            className="pcard-alt"
          />
        ) : null}

        {/* Classic look keeps its veil, unless a second image answers the hover. */}
        {!editorial && !altUrl ? (
          <div className="pcard-overlay" aria-hidden="true">
            <span>
              <Eye />
              {t('view')}
            </span>
          </div>
        ) : null}

        {saleBadge ? (
          <span className="pcard-badge" data-at="start" data-kind="sale">
            {settings.badge === 'sale' ? (
              t('sale')
            ) : (
              <>
                <span aria-hidden="true">-{discount}%</span>
                <span className="pcard-sr">{t('percentOff', { percent: discount })}</span>
              </>
            )}
          </span>
        ) : customBadge ? (
          <span className="pcard-badge" data-at="start" data-kind="custom">
            {customBadge}
          </span>
        ) : null}

        {promotionLabel ? (
          <span className="pcard-badge" data-at="end" data-kind="promo">
            {promotionLabel}
          </span>
        ) : null}

        {settings.quick_add && productSlug ? (
          <div className="pcard-actions">
            <QuickAddButton
              productSlug={productSlug}
              productId={productId}
              title={title}
              href={href}
              card={card}
              currency={currency}
            />
          </div>
        ) : null}
      </div>

      <div className="pcard-body">
        <h3 className="pcard-title">
          {/* No viewport prefetch: a grid of cards would fire one dynamic RSC
              render per product on every listing view. */}
          <Link href={href} prefetch={false} className="pcard-link">
            {title}
          </Link>
        </h3>
        {vendorName ? <p className="pcard-vendor">{t('soldBy', { name: vendorName })}</p> : null}
        <div className="pcard-price" data-sale={onSale ? '' : undefined}>
          <span className="pcard-price-now">{fmt(price)}</span>
          {onSale ? <span className="pcard-price-was">{fmt(comparePrice)}</span> : null}
          <PriceTaxSuffix className="pcard-tax" taxRateBp={taxRateBp} />
        </div>
        {settings.swatches && card?.swatches ? <CardSwatchList swatches={card.swatches} /> : null}
        {settings.sizes_line && card?.sizes ? <CardSizeLine sizes={card.sizes} /> : null}
        {soldOut ? (
          <p className="pcard-stock" data-state="sold_out">
            {t('outOfStock')}
          </p>
        ) : lowCount !== null ? (
          <p className="pcard-stock" data-state="low">
            {t('onlyNLeft', { count: lowCount })}
          </p>
        ) : null}
      </div>
    </article>
  );
}
