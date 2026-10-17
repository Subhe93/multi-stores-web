'use client';

// Lazy client chunks of the product magic sections (M5 D24). The `import()`
// has to live in a client module: a `next/dynamic` in the (server) section
// definition files keeps the components in the store layout's client bundle,
// because the client graph is built from client references, not from server
// dynamic imports. From here each section becomes its own async chunk that
// only product pages fetch. Default `ssr: true`: the HTML is unchanged, only
// the hydration script arrives separately.

import dynamic from 'next/dynamic';

export const AddToCartMagic = dynamic(() => import('./AddToCartMagic.client').then((m) => m.AddToCartMagic));
export const ProductGalleryMagic = dynamic(() => import('./ProductGalleryMagic.client').then((m) => m.ProductGalleryMagic));
export const ProductPageMagic = dynamic(() => import('./ProductPageMagic.client').then((m) => m.ProductPageMagic));
export const ProductTabsMagic = dynamic(() => import('./ProductTabsMagic.client').then((m) => m.ProductTabsMagic));
