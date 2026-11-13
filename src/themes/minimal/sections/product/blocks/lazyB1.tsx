'use client';

// Lazy client chunks of the B1 product blocks (same split as ../lazy.tsx,
// M5 D24): each block becomes its own async chunk that only product pages
// fetch. Default `ssr: true`, so the HTML is rendered on the server.

import dynamic from 'next/dynamic';

export const ProductTitleBlock = dynamic(() => import('./ProductTitleBlock.client').then((m) => m.ProductTitleBlock));
export const ProductPriceBlock = dynamic(() => import('./ProductPriceBlock.client').then((m) => m.ProductPriceBlock));
export const ProductVariantsBlock = dynamic(() => import('./ProductVariantsBlock.client').then((m) => m.ProductVariantsBlock));
export const ProductBuyBlock = dynamic(() => import('./ProductBuyBlock.client').then((m) => m.ProductBuyBlock));
