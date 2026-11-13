'use client';

// Lazy client chunks of the B3 product blocks, same pattern as ./lazyB2.tsx:
// each block is an async chunk that only product pages fetch. Default
// `ssr: true`: the HTML is server-rendered, only the hydration script
// arrives separately.

import dynamic from 'next/dynamic';

export const ProductDescriptionBlock = dynamic(() =>
  import('./ProductDescriptionBlock.client').then((m) => m.ProductDescriptionBlock),
);
export const ProductSpecificationsBlock = dynamic(() =>
  import('./ProductSpecificationsBlock.client').then((m) => m.ProductSpecificationsBlock),
);
export const ProductFaqBlock = dynamic(() => import('./ProductFaqBlock.client').then((m) => m.ProductFaqBlock));
export const ProductShippingReturnsBlock = dynamic(() =>
  import('./ProductShippingReturnsBlock.client').then((m) => m.ProductShippingReturnsBlock),
);
