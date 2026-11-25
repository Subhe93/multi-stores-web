// Inputs of the product JSON-LD regression fixtures (M171): one product per
// output shape (Product, ProductGroup, Product + AggregateOffer), each with
// every M161 / M170 piece switched on (seller, shipping details, handling
// time, return policy, variant URLs, videos). `productJsonLd.m170.json`
// holds the output of the builder as committed BEFORE the reviews app, so a
// store without reviews can be shown to keep byte-identical markup.

import type { ProductJsonLdInput, ProductShippingRates } from '@/lib/productJsonLd';

const shipping: ProductShippingRates = {
  requires_shipping: true,
  currency: 'EUR',
  rates: [
    { country: 'DE', cost: 4.9, min_days: 2, max_days: 4 },
    { country: 'AT', cost: 6.9, min_days: 3, max_days: 6 },
  ],
  handling_days: { min: 1, max: 2 },
  return_policies: [{ countries: ['DE', 'AT'], category: 'finite', days: 30, methods: ['mail'], fees: 'customer' }],
};

const base = {
  name: 'Namenskette',
  descriptionHtml: '<p>Kette mit <strong>Gravur</strong></p>',
  locale: 'de',
  canonical: 'https://namez.shop/de-de/products/namenskette',
  images: ['https://api.example.com/uploads/a.webp', 'https://api.example.com/uploads/b.webp'],
  brand: 'Namez',
  sellerId: 'https://namez.shop/#organization',
  currency: 'EUR',
  shipping,
  videos: [{ '@type': 'VideoObject', name: 'Namenskette', thumbnailUrl: 'https://api.example.com/uploads/v.jpg' }],
  resolveMedia: (u: string) => `https://api.example.com${u}`,
} satisfies Omit<ProductJsonLdInput, 'product'>;

const variant = (n: number, color: string) => ({
  id: `3f0c1c1e-0b7e-4a57-9a53-${String(n).padStart(12, '0')}`,
  sku: `NH-01-${n}`,
  price: 39 + n,
  stock: n % 2,
  options: { color, size: n % 2 ? 'S' : 'M' },
  is_active: true,
});

export type LdShape = 'product' | 'group' | 'aggregate';

export const LD_FIXTURE_INPUTS: Record<LdShape, ProductJsonLdInput> = {
  product: {
    ...base,
    product: { id: 'p1', sku: 'NH-01', base_price: 39, track_inventory: true, stock_quantity: 3 },
  },
  group: {
    ...base,
    product: {
      id: 'p2',
      sku: 'NH-02',
      base_price: 39,
      variants: [
        { ...variant(1, 'Gold'), images: [{ url: '/uploads/gold.webp' }] },
        variant(2, 'Silber'),
        { ...variant(3, 'Rose'), is_active: false },
      ],
      variant_option_config: [{ name: 'color', imageMap: { Silber: '/uploads/silber.webp' } }],
    },
  },
  aggregate: {
    ...base,
    product: {
      id: 'p3',
      base_price: 39,
      variants: Array.from({ length: 101 }, (_, i) => variant(i + 1, `C${i + 1}`)),
    },
  },
};
