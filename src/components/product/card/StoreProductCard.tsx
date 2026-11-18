'use client';

// The one entry point of every product card call site. Without card
// settings on the store it renders the classic ProductCard with exactly the
// classic props (same markup, byte for byte); with them, the enhanced card.

import { ProductCard } from '@/components/product/ProductCard';
import { useProductCardSettings } from '@/hooks/useProductCard';
import { cardAspectClass } from '@/lib/productCard/settings';
import { ProductCardEnhanced } from './ProductCardEnhanced';
import type { StoreProductCardProps } from './types';

export function StoreProductCard({ card, productId, productSlug, entrance, ...classic }: StoreProductCardProps) {
  const settings = useProductCardSettings();
  if (!settings) return <ProductCard {...classic} />;
  return (
    <ProductCardEnhanced
      {...classic}
      // A caller with its own aspect setting (sections) keeps it; the
      // built-in grids take the card aspect of the store.
      aspectClass={classic.aspectClass ?? cardAspectClass(settings.aspect)}
      settings={settings}
      card={card}
      productId={productId}
      productSlug={productSlug}
      entrance={entrance}
    />
  );
}
