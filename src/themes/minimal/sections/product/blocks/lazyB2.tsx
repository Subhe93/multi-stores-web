'use client';

// Lazy client wrappers of the B2 product blocks, same pattern as
// ../lazy.tsx (M5 D24): the loading lives in client modules so the block
// code is an async chunk that only product pages fetch, instead of joining
// the store layout's client bundle. All wrappers resolve through the one
// shared loader (./productBlocksLoader.ts), so every block shares one chunk
// group. Default `ssr: true`: the HTML is unchanged, only the hydration
// script arrives separately.

import dynamic from 'next/dynamic';
import { loadProductBlocks } from './productBlocksLoader';

export const ProductBreadcrumbBlock = dynamic(() => loadProductBlocks().then((m) => m.ProductBreadcrumbBlock));
export const ProductShortDescriptionBlock = dynamic(() => loadProductBlocks().then((m) => m.ProductShortDescriptionBlock));
export const ProductPromotionsBlock = dynamic(() => loadProductBlocks().then((m) => m.ProductPromotionsBlock));
export const ProductBundlesBlock = dynamic(() => loadProductBlocks().then((m) => m.ProductBundlesBlock));
export const ProductPersonalizationBlock = dynamic(() => loadProductBlocks().then((m) => m.ProductPersonalizationBlock));
export const ProductTrustBlock = dynamic(() => loadProductBlocks().then((m) => m.ProductTrustBlock));
export const ProductShippingBlock = dynamic(() => loadProductBlocks().then((m) => m.ProductShippingBlock));
