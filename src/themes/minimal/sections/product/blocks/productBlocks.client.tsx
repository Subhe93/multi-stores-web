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

export { ProductTitleBlock } from './ProductTitleBlock.client';
export { ProductPriceBlock } from './ProductPriceBlock.client';
export { ProductVariantsBlock } from './ProductVariantsBlock.client';
export { ProductBuyBlock } from './ProductBuyBlock.client';
export { ProductBreadcrumbBlock } from './ProductBreadcrumbBlock.client';
export { ProductShortDescriptionBlock } from './ProductShortDescriptionBlock.client';
export { ProductPromotionsBlock } from './ProductPromotionsBlock.client';
export { ProductBundlesBlock } from './ProductBundlesBlock.client';
export { ProductPersonalizationBlock } from './ProductPersonalizationBlock.client';
export { ProductTrustBlock } from './ProductTrustBlock.client';
export { ProductShippingBlock } from './ProductShippingBlock.client';
export { ProductDescriptionBlock } from './ProductDescriptionBlock.client';
export { ProductSpecificationsBlock } from './ProductSpecificationsBlock.client';
export { ProductFaqBlock } from './ProductFaqBlock.client';
export { ProductShippingReturnsBlock } from './ProductShippingReturnsBlock.client';
export { ProductStoriesBlock } from './ProductStoriesBlock.client';
export { ProductGalleryMagic } from '../ProductGalleryMagic.client';
export { ProductDetailsMagic } from '../ProductDetailsMagic.client';
export { AddToCartMagic } from '../AddToCartMagic.client';
export { ProductTabsMagic } from '../ProductTabsMagic.client';
