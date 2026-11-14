// Product-route entry of the monolith `product-page` section, imported only
// by ProductPageMagicWarmup. A separate module on purpose: Turbopack keys an
// async loader by its target module, so importing ./ProductPageMagic.client
// there would reuse the store layout's loader (whose chunks repeat
// ProductDetailClient, which the product page already ships). See
// ./splitLoader.ts.

export * from './ProductPageMagic.client';
