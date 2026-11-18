// Storefront product rows (the `GET /storefront/:slug/products` item shape,
// trimmed to what the listing pages read) shared by the listing page tests.

export interface FixtureProduct {
  id: string;
  base_price: number | string;
  tax_rate_bp?: number | null;
  compare_at_price?: number | string | null;
  created_at: string;
  requires_shipping?: boolean | null;
  translations: Array<{ locale: string; title: string; slug: string; description?: string }>;
  images: Array<{ url: string }>;
  promotions?: Array<{ type: string; value: unknown; translations?: Array<{ title?: string }> }>;
  vendor?: { company_name: string } | null;
}

/** Three products with distinct prices and dates (API order: newest first). */
export function listingFixtureProducts(): FixtureProduct[] {
  return [
    {
      id: 'p1',
      base_price: '120.00',
      compare_at_price: '150.00',
      tax_rate_bp: 2500,
      created_at: '2026-11-03T10:00:00.000Z',
      translations: [
        { locale: 'sv', title: 'Mugg', slug: 'mugg', description: '<p>Lång beskrivning</p>' },
        { locale: 'ar', title: 'كوب', slug: '-' },
      ],
      images: [{ url: '/uploads/products/mugg.jpg' }, { url: '/uploads/products/mugg-2.jpg' }],
      promotions: [{ type: 'PERCENTAGE', value: 20, translations: [{ title: 'Rea' }] }],
      vendor: { company_name: 'Namez AB' },
    },
    {
      id: 'p2',
      base_price: 80,
      compare_at_price: null,
      tax_rate_bp: null,
      created_at: '2026-11-02T10:00:00.000Z',
      requires_shipping: false,
      translations: [{ locale: 'sv', title: 'Presentkort', slug: 'presentkort' }],
      images: [],
      promotions: [
        { type: 'FREE_SHIPPING', value: 0, translations: [{ title: 'Fri frakt' }] },
        { type: 'FIXED_AMOUNT', value: 10, translations: [{ title: 'Tio av' }] },
      ],
    },
    {
      id: 'p3',
      base_price: '300.00',
      created_at: '2026-11-01T10:00:00.000Z',
      translations: [
        { locale: 'en', title: 'Poster', slug: 'poster' },
        { locale: 'ar', title: 'ملصق', slug: 'ملصق' },
      ],
      images: [{ url: 'https://cdn.example.com/poster.svg' }],
      vendor: null,
    },
  ];
}
