'use client';

// Starts downloading the monolith `product-page` section's code before
// hydration reaches it, from a chunk built against the product page's own
// modules (same mechanism as ./blocks/ProductBlocksWarmup.tsx; see
// ./splitLoader.ts). The product route renders it only for templates with a
// visible `product-page` section. It renders nothing.

import { loadProductPageMagic, registerPageProductPageMagicImport } from './productPageMagicLoader';

if (typeof window !== 'undefined') {
  registerPageProductPageMagicImport(() => import('./ProductPageMagic.page'));
  // A failed warm-up is harmless: the section wrapper retries on its own.
  loadProductPageMagic().catch(() => {});
}

export function ProductPageMagicWarmup() {
  return null;
}
