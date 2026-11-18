'use client';

// Enhanced product card. OWNER: builder W1.
// Foundation version: the structure of the contract (article root, one
// stretched link, buttons as siblings of the link) with plain styling, so
// every call site compiles and the demo shows a card. W1 replaces the body.

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { StoreImage } from '@/components/StoreImage';
import { PriceTaxSuffix } from '@/components/product/PriceTaxSuffix';
import { useDisplayPrice } from '@/hooks/useDisplayPrice';
import { isSvgSrc } from '@/lib/storeMedia';
import { hover, item } from '@/themes/creative/recipes';
import { CardSizeLine } from './CardSizeLine';
import { CardSwatchList } from './CardSwatchList';
import { QuickAddButton } from './QuickAddButton.client';
import type { EnhancedCardProps } from './types';

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
  const display = useDisplayPrice();
  const fmt = (n: number) =>
    new Intl.NumberFormat('en', { style: 'currency', currency }).format(display(n, taxRateBp, currency).amount);
  const rootMotion =
    entrance ??
    (!motion ? null : typeof arriving === 'number' ? { ...item('intro', arriving), 'data-cx-more': '' } : item('scroll', 0));

  return (
    <article
      className="pcard group relative"
      data-card-style={settings.style}
      data-corners={settings.corners}
      {...rootMotion}
    >
      <div
        className={`pcard-media relative ${aspectClass} overflow-hidden bg-gray-100 ${settings.corners === 'square' ? '' : 'rounded-2xl'}`}
        {...hover(motion, 'media')}
      >
        {imageUrl ? (
          <StoreImage
            src={imageUrl}
            alt=""
            fill
            sizes={sizes}
            preload={priority}
            fetchPriority={priority ? 'high' : undefined}
            loading={priority ? undefined : eager ? 'eager' : 'lazy'}
            unoptimized={isSvgSrc(imageUrl)}
            className="object-cover"
          />
        ) : null}
        {settings.quick_add && productSlug ? (
          <div className="pcard-actions absolute bottom-2 end-2 z-[2]">
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
      <div className="mt-3 px-0.5">
        <h3 className="text-sm line-clamp-2 leading-snug" style={{ color: 'var(--theme-colors-text)' }}>
          {/* The one link of the card; ::after stretches it over the article. */}
          <Link href={href} prefetch={false} className="pcard-link after:absolute after:inset-0 after:z-[1]">
            {title}
          </Link>
        </h3>
        {vendorName && <p className="mt-0.5 text-xs text-gray-500 truncate">{t('soldBy', { name: vendorName })}</p>}
        <div className="mt-1.5 flex items-center gap-2 flex-wrap text-sm">
          <span>{fmt(price)}</span>
          {comparePrice && comparePrice > price ? (
            <span className="text-xs text-gray-400 line-through">{fmt(comparePrice)}</span>
          ) : null}
          <PriceTaxSuffix className="text-[11px] text-gray-400" taxRateBp={taxRateBp} />
        </div>
        {settings.swatches && card?.swatches ? <CardSwatchList swatches={card.swatches} /> : null}
        {settings.sizes_line && card?.sizes ? <CardSizeLine sizes={card.sizes} /> : null}
      </div>
    </article>
  );
}
