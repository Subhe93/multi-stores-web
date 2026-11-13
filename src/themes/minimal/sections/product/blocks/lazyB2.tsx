'use client';

// Lazy client chunks of the B2 product blocks, same pattern as
// ../lazy.tsx (M5 D24): the `import()` lives in a client module so each
// block is an async chunk that only product pages fetch, instead of joining
// the store layout's client bundle. Default `ssr: true`: the HTML is
// unchanged, only the hydration script arrives separately.

import dynamic from 'next/dynamic';

export const ProductBreadcrumbBlock = dynamic(() => import('./ProductBreadcrumbBlock.client').then((m) => m.ProductBreadcrumbBlock));
export const ProductShortDescriptionBlock = dynamic(() =>
  import('./ProductShortDescriptionBlock.client').then((m) => m.ProductShortDescriptionBlock),
);
export const ProductPromotionsBlock = dynamic(() => import('./ProductPromotionsBlock.client').then((m) => m.ProductPromotionsBlock));
export const ProductBundlesBlock = dynamic(() => import('./ProductBundlesBlock.client').then((m) => m.ProductBundlesBlock));
export const ProductPersonalizationBlock = dynamic(() =>
  import('./ProductPersonalizationBlock.client').then((m) => m.ProductPersonalizationBlock),
);
export const ProductTrustBlock = dynamic(() => import('./ProductTrustBlock.client').then((m) => m.ProductTrustBlock));
export const ProductShippingBlock = dynamic(() => import('./ProductShippingBlock.client').then((m) => m.ProductShippingBlock));
