'use client';

// Lazy client chunks of the product magic sections (M5 D24). The `import()`
// has to live in a client module: a `next/dynamic` in the (server) section
// definition files keeps the components in the store layout's client bundle,
// because the client graph is built from client references, not from server
// dynamic imports. From here each section becomes its own async chunk that
// only product pages fetch. Default `ssr: true`: the HTML is unchanged, only
// the hydration script arrives separately.
//
// The designer app (M5.5) is split the same way one level down: these
// sections import only the light `@/components/designer/DesignerSession`
// module, whose `next/dynamic` imports load the renderer chunk
// (`DesignerInline`) on designer products alone, so a product page without
// a design template ships no renderer code.
//
// The split sections that sit beside the product blocks (gallery, details,
// add-to-cart, tabs) load with the blocks' grouped module through its shared
// loader (./blocks/productBlocksLoader.ts), so a blocks template fetches one
// chunk group. The monolith `product-page` keeps its own chunk, loaded the
// same way through ./productPageMagicLoader.ts.

import dynamic from 'next/dynamic';
import { loadProductBlocks } from './blocks/productBlocksLoader';
import { loadProductPageMagic } from './productPageMagicLoader';

export const AddToCartMagic = dynamic(() => loadProductBlocks().then((m) => m.AddToCartMagic));
export const ProductDetailsMagic = dynamic(() => loadProductBlocks().then((m) => m.ProductDetailsMagic));
export const ProductGalleryMagic = dynamic(() => loadProductBlocks().then((m) => m.ProductGalleryMagic));
export const ProductPageMagic = dynamic(() => loadProductPageMagic().then((m) => m.ProductPageMagic));
export const ProductTabsMagic = dynamic(() => loadProductBlocks().then((m) => m.ProductTabsMagic));
