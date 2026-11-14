// The one loader of the grouped product-block module (./productBlocks.client),
// shared by every lazy block wrapper (./lazyB1.tsx, ./lazyB2.tsx,
// ./lazyB3.tsx, ../lazy.tsx). ProductBlocksWarmup registers the product
// route's own import of it (./productBlocks.page); see ../splitLoader.ts for
// why that import is smaller than the wrappers' fallback import.

import type * as ProductBlocks from './productBlocks.client';
import { createSplitLoader } from '../splitLoader';

export type ProductBlocksModule = typeof ProductBlocks;

const loader = createSplitLoader<ProductBlocksModule>(() => import('./productBlocks.client'));

export const registerPageProductBlocksImport = loader.register;
export const loadProductBlocks = loader.load;
