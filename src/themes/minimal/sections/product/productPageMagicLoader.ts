// Loader of the monolith `product-page` section (./ProductPageMagic.client)
// for its lazy wrapper in ./lazy.tsx. ProductPageMagicWarmup registers the
// product route's own import of it (./ProductPageMagic.page); see
// ./splitLoader.ts for why that import is smaller than the fallback.

import type * as ProductPageMagicClient from './ProductPageMagic.client';
import { createSplitLoader } from './splitLoader';

export type ProductPageMagicModule = typeof ProductPageMagicClient;

const loader = createSplitLoader<ProductPageMagicModule>(() => import('./ProductPageMagic.client'));

export const registerPageProductPageMagicImport = loader.register;
export const loadProductPageMagic = loader.load;
