'use client';

// Lazy client chunk of the `variant_image` dynamic source island (same split
// as ../product/blocks/lazyB1.tsx): only a page that renders a section with
// image_source = 'variant_image' fetches it. Default `ssr: true`, so the
// image is in the server HTML.

import dynamic from 'next/dynamic';

export const DynamicProductImage = dynamic(() =>
  import('./DynamicProductImage.client').then((m) => m.DynamicProductImage),
);
