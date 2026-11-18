'use client';

// Product grid of the built-in /products and collection routes in server
// mode (catalogue above LISTING_SERVER_THRESHOLD): the server-rendered first
// page plus the pages appended by "load more". Each card gets the same
// ProductCard props as the route's legacy grid.

import { useRef } from 'react';
import { ProductCard } from '@/components/product/ProductCard';
import { ListingLoadMore } from '@/components/listing/ListingLoadMore';
import { useListingPages } from '@/hooks/useListingPages';
import { resolveMediaUrl } from '@/lib/api';
import type { ListingPagination } from '@/lib/listingPaging';
import { isUsableSlug } from '@/lib/slugRoute';
import type { ListingProduct } from '@/themes/types';

// Promotion badge text, same expression as the routes' legacy cards. The
// card projection already holds only the first applicable promotion.
function promotionLabelFor(product: ListingProduct): string | undefined {
  const promo = (
    product.promotions as Array<{ type?: string; value?: unknown; translations?: Array<{ title?: string }> }> | undefined
  )?.[0];
  if (!promo) return undefined;
  if (promo.type === 'PERCENTAGE' || promo.type === 'FLASH_SALE') return `${promo.value}% off`;
  if (promo.type === 'FREE_SHIPPING') return 'Free Shipping';
  return promo.translations?.[0]?.title || 'Offer';
}

export function ListingPagedGrid({
  storeSlug,
  initial,
  pagination,
  locale,
  lp,
  currency,
  gridClassName,
  variant,
  priorityFirst = false,
}: {
  storeSlug: string;
  /** First page, as card projections (`toListingCard`). */
  initial: ListingProduct[];
  pagination: ListingPagination;
  locale: string;
  /** Secondary-locale path prefix ('' for the primary locale). */
  lp: string;
  currency?: string;
  gridClassName: string;
  variant: 'catalog' | 'collection';
  /** Collection variant: the first cards are the LCP (no banner image). */
  priorityFirst?: boolean;
}) {
  const gridRef = useRef<HTMLDivElement>(null);
  const pages = useListingPages({ storeSlug, initial, pagination });

  return (
    <>
      <div ref={gridRef} className={gridClassName}>
        {pages.products.map((product, index) => {
          const translation =
            product.translations.find((tr) => tr.locale === locale) ||
            product.translations.find((tr) => tr.locale === 'en') ||
            product.translations[0];
          const slugTr =
            product.translations.find((tr) => tr.locale === locale && isUsableSlug(tr.slug)) ||
            product.translations.find((tr) => isUsableSlug(tr.slug));
          return (
            <ProductCard
              key={product.id}
              href={`${lp}/products/${slugTr?.slug || product.id}`}
              title={translation?.title || 'Untitled'}
              price={Number(product.base_price)}
              taxRateBp={product.tax_rate_bp}
              comparePrice={product.compare_at_price ? Number(product.compare_at_price) : undefined}
              imageUrl={product.images[0]?.url ? resolveMediaUrl(product.images[0].url) : undefined}
              currency={currency}
              promotionLabel={promotionLabelFor(product)}
              vendorName={product.vendor?.company_name}
              {...(variant === 'collection'
                ? {
                    sizes: '(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw',
                    priority: priorityFirst && index < 2,
                    eager: index < 4,
                  }
                : {})}
            />
          );
        })}
      </div>
      <ListingLoadMore
        shown={pages.products.length}
        total={pages.total}
        hasMore={pages.hasMore}
        loading={pages.loading}
        error={pages.error}
        onLoadMore={pages.loadMore}
        gridRef={gridRef}
      />
    </>
  );
}
