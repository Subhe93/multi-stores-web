'use client';

// Lazy client wrappers of the B3 product blocks, same pattern as
// ./lazyB2.tsx: every wrapper resolves through the shared loader of the
// grouped block module (./productBlocksLoader.ts), so the blocks share one
// async chunk group that only product pages fetch. Default `ssr: true`: the
// HTML is server-rendered, only the hydration script arrives separately.

import dynamic from 'next/dynamic';
import { loadProductBlocks } from './productBlocksLoader';

export const ProductDescriptionBlock = dynamic(() => loadProductBlocks().then((m) => m.ProductDescriptionBlock));
export const ProductSpecificationsBlock = dynamic(() => loadProductBlocks().then((m) => m.ProductSpecificationsBlock));
export const ProductFaqBlock = dynamic(() => loadProductBlocks().then((m) => m.ProductFaqBlock));
export const ProductShippingReturnsBlock = dynamic(() => loadProductBlocks().then((m) => m.ProductShippingReturnsBlock));
