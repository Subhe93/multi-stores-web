'use client';

// Starts downloading the product-block code as early as possible, from a
// chunk built against the product page's own modules.
//
// The product blocks are `next/dynamic` wrappers (ssr: true). On the client
// each one is a React.lazy whose server HTML stays inert until its code
// arrives, and React only asks for that code when hydration reaches the
// block. Turbopack's react-loadable-manifest does not give these chunks a
// usable <link rel="preload"> (its file names come from the server graph),
// so without this the add-to-cart button stayed dead until a request that
// started mid-hydration finished.
//
// The product route renders this component only for templates with product
// blocks. Being a client reference of that route, its module runs before
// hydration reaches the blocks (it is rendered ahead of them), registers its
// page-graph import with the shared loader (see ../splitLoader.ts for why
// that import is smaller than the wrappers' own) and starts it. It
// renders nothing, so the HTML is unchanged.

import { loadProductBlocks, registerPageProductBlocksImport } from './productBlocksLoader';

if (typeof window !== 'undefined') {
  registerPageProductBlocksImport(() => import('./productBlocks.page'));
  // A failed warm-up is harmless: the block wrappers retry on their own.
  loadProductBlocks().catch(() => {});
}

export function ProductBlocksWarmup() {
  return null;
}
