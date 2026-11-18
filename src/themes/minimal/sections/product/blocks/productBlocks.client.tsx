'use client';

// One client module for every product block of a PRODUCT_TEMPLATE and the
// split magic sections placed beside them. The lazy wrappers (./lazyB1.tsx,
// ./lazyB2.tsx, ./lazyB3.tsx, ../lazy.tsx) all `import()` this module, so
// Turbopack emits ONE async chunk group for all of them instead of one chunk
// per block: a blocks-template product page makes one request for its block
// code (and gets one copy of the shared product-state code) instead of ~16
// requests that start late during hydration and each carry their own copy.
//
// `ProductPageMagic` (the monolith `product-page`) is deliberately NOT here,
// so monolith pages never download the blocks.

//
// Store motion style: every export is wrapped with withProductMotion, so the
// section's `motion` prop reaches the shared product parts (gallery, variant
// chips, quantity, buy button, tabs) through one context. Without the prop
// the wrapper renders the block as is.

import { withProductMotion } from '@/components/product/productMotion';
import { ProductTitleBlock as ProductTitleBlockBase } from './ProductTitleBlock.client';
import { ProductPriceBlock as ProductPriceBlockBase } from './ProductPriceBlock.client';
import { ProductVariantsBlock as ProductVariantsBlockBase } from './ProductVariantsBlock.client';
import { ProductBuyBlock as ProductBuyBlockBase } from './ProductBuyBlock.client';
import { ProductBreadcrumbBlock as ProductBreadcrumbBlockBase } from './ProductBreadcrumbBlock.client';
import { ProductShortDescriptionBlock as ProductShortDescriptionBlockBase } from './ProductShortDescriptionBlock.client';
import { ProductPromotionsBlock as ProductPromotionsBlockBase } from './ProductPromotionsBlock.client';
import { ProductBundlesBlock as ProductBundlesBlockBase } from './ProductBundlesBlock.client';
import { ProductPersonalizationBlock as ProductPersonalizationBlockBase } from './ProductPersonalizationBlock.client';
import { ProductTrustBlock as ProductTrustBlockBase } from './ProductTrustBlock.client';
import { ProductShippingBlock as ProductShippingBlockBase } from './ProductShippingBlock.client';
import { ProductDescriptionBlock as ProductDescriptionBlockBase } from './ProductDescriptionBlock.client';
import { ProductSpecificationsBlock as ProductSpecificationsBlockBase } from './ProductSpecificationsBlock.client';
import { ProductFaqBlock as ProductFaqBlockBase } from './ProductFaqBlock.client';
import { ProductShippingReturnsBlock as ProductShippingReturnsBlockBase } from './ProductShippingReturnsBlock.client';
import { ProductStoriesBlock as ProductStoriesBlockBase } from './ProductStoriesBlock.client';
import { ProductGalleryMagic as ProductGalleryMagicBase } from '../ProductGalleryMagic.client';
import { ProductDetailsMagic as ProductDetailsMagicBase } from '../ProductDetailsMagic.client';
import { AddToCartMagic as AddToCartMagicBase } from '../AddToCartMagic.client';
import { ProductTabsMagic as ProductTabsMagicBase } from '../ProductTabsMagic.client';

export const ProductTitleBlock = withProductMotion(ProductTitleBlockBase);
export const ProductPriceBlock = withProductMotion(ProductPriceBlockBase);
export const ProductVariantsBlock = withProductMotion(ProductVariantsBlockBase);
export const ProductBuyBlock = withProductMotion(ProductBuyBlockBase);
export const ProductBreadcrumbBlock = withProductMotion(ProductBreadcrumbBlockBase);
export const ProductShortDescriptionBlock = withProductMotion(ProductShortDescriptionBlockBase);
export const ProductPromotionsBlock = withProductMotion(ProductPromotionsBlockBase);
export const ProductBundlesBlock = withProductMotion(ProductBundlesBlockBase);
export const ProductPersonalizationBlock = withProductMotion(ProductPersonalizationBlockBase);
export const ProductTrustBlock = withProductMotion(ProductTrustBlockBase);
export const ProductShippingBlock = withProductMotion(ProductShippingBlockBase);
export const ProductDescriptionBlock = withProductMotion(ProductDescriptionBlockBase);
export const ProductSpecificationsBlock = withProductMotion(ProductSpecificationsBlockBase);
export const ProductFaqBlock = withProductMotion(ProductFaqBlockBase);
export const ProductShippingReturnsBlock = withProductMotion(ProductShippingReturnsBlockBase);
export const ProductStoriesBlock = withProductMotion(ProductStoriesBlockBase);
export const ProductGalleryMagic = withProductMotion(ProductGalleryMagicBase);
export const ProductDetailsMagic = withProductMotion(ProductDetailsMagicBase);
export const AddToCartMagic = withProductMotion(AddToCartMagicBase);
export const ProductTabsMagic = withProductMotion(ProductTabsMagicBase);
