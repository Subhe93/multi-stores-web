'use client';

// Lazy client wrappers of the B1 product blocks. Every wrapper resolves
// through the one shared loader of the grouped block module
// (./productBlocksLoader.ts), so all product blocks share one async chunk
// group that only product pages fetch. Default `ssr: true`, so the HTML is
// rendered on the server.

import dynamic from 'next/dynamic';
import { loadProductBlocks } from './productBlocksLoader';

export const ProductTitleBlock = dynamic(() => loadProductBlocks().then((m) => m.ProductTitleBlock));
export const ProductPriceBlock = dynamic(() => loadProductBlocks().then((m) => m.ProductPriceBlock));
export const ProductVariantsBlock = dynamic(() => loadProductBlocks().then((m) => m.ProductVariantsBlock));
export const ProductBuyBlock = dynamic(() => loadProductBlocks().then((m) => m.ProductBuyBlock));
