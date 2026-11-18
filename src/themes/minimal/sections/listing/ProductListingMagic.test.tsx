import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { ListingCollection, ListingContext, ListingProduct, SectionRenderProps } from '../../../types';

// Characterization of the `product-listing` section (CATALOG_TEMPLATE /
// COLLECTION_TEMPLATE body). The snapshots were recorded BEFORE the opt-in
// server pagination was added: a listing without `pagination` (every store at
// or below the threshold, and every store on an older API) must keep
// rendering byte-identical markup.

vi.mock('next-intl', () => ({
  useTranslations: (ns?: string) => (k: string) => (ns ? `${ns}.${k}` : k),
}));

import { productListingMagicSection, PRODUCT_LISTING_DEFAULT_SETTINGS } from './ProductListingMagic';

const ProductListingMagic = productListingMagicSection.Component;

const PRODUCTS: ListingProduct[] = [
  {
    id: 'p1',
    base_price: 120,
    compare_at_price: 150,
    tax_rate_bp: 2500,
    created_at: '2026-11-03T10:00:00.000Z',
    translations: [
      { locale: 'sv', title: 'Mugg', slug: 'mugg' },
      { locale: 'ar', title: 'كوب', slug: '-' },
    ],
    images: [{ url: '/uploads/products/mugg.jpg' }],
    promotions: [{ type: 'PERCENTAGE', value: 20, translations: [{ title: 'Rea' }] }],
    vendor: { company_name: 'Namez AB' },
  },
  {
    id: 'p2',
    base_price: 80,
    created_at: '2026-11-02T10:00:00.000Z',
    translations: [{ locale: 'sv', title: 'Kopp', slug: 'kopp' }],
    images: [],
  },
  {
    id: 'p3',
    base_price: 300,
    created_at: '2026-11-01T10:00:00.000Z',
    translations: [
      { locale: 'en', title: 'Poster', slug: 'poster' },
      { locale: 'ar', title: 'ملصق', slug: 'ملصق' },
    ],
    images: [{ url: 'https://cdn.example.com/poster.svg' }],
    promotions: [{ type: 'BUY_X_GET_Y', value: 1, translations: [{ title: 'Köp 2' }] }],
  },
];

const CHILD: ListingCollection = {
  id: 'c2',
  slug: 'koppar',
  path: ['kok', 'koppar'],
  translations: [{ locale: 'sv', name: 'Koppar' }, { locale: 'ar', name: 'أكواب' }],
};
const ROOT: ListingCollection = {
  id: 'c1',
  slug: 'kok',
  path: ['kok'],
  translations: [{ locale: 'sv', name: 'Kök' }, { locale: 'ar', name: 'مطبخ' }],
  children: [CHILD, { id: 'c3', slug: 'gammal', is_active: false, translations: [{ locale: 'sv', name: 'Gammal' }] }],
};
const COLLECTION: ListingCollection = {
  ...ROOT,
  thumbnail_url: '/uploads/collections/kok.jpg',
  translations: [
    {
      locale: 'sv',
      name: 'Kök',
      description: '<p>Allt för köket</p>',
      long_description: '<h2>Om köket</h2><p>Lång text</p>',
    },
    { locale: 'ar', name: 'مطبخ', description: '<p>كل شيء للمطبخ</p>', long_description: '<p>نص طويل</p>' },
  ],
};

function catalog(query: ListingContext['query'], products: ListingProduct[] = PRODUCTS): ListingContext {
  return {
    kind: 'catalog',
    products,
    collections: [ROOT],
    query,
    hero: { enabled: true, show_count: true },
    basePath: '/products',
    isFiltered: Boolean(query.search || query.category || query.creator_category),
  } as ListingContext;
}

function collection(query: ListingContext['query']): ListingContext {
  return {
    kind: 'collection',
    products: PRODUCTS,
    collections: [],
    collection: { ...COLLECTION, children: [CHILD] },
    collectionPath: [],
    query,
    hero: { enabled: true, show_count: true },
    basePath: '/collections/kok',
    isFiltered: Boolean(query.search),
  } as ListingContext;
}

function html(listing: ListingContext, locale: string, extra: Partial<SectionRenderProps> = {}) {
  return renderToStaticMarkup(
    <ProductListingMagic
      settings={{ ...PRODUCT_LISTING_DEFAULT_SETTINGS }}
      content={{}}
      locale={locale}
      primaryLocale="sv"
      storeSlug="namez-se"
      currency="SEK"
      listing={listing}
      {...extra}
    />,
  );
}

describe('product-listing section without pagination (unchanged markup)', () => {
  it('catalog, sv, sorted and searched', () => {
    expect(html(catalog({ search: 'mugg', sort: 'price_asc', creator_category: 'kok' }), 'sv')).toMatchSnapshot();
  });

  it('catalog, ar (secondary locale), no filters', () => {
    expect(html(catalog({}), 'ar')).toMatchSnapshot();
  });

  it('catalog, sv, filtered to nothing', () => {
    expect(html(catalog({ search: 'zzz' }, []), 'sv')).toMatchSnapshot();
  });

  it('catalog, sv, banner off and count hidden', () => {
    expect(
      html(catalog({ sort: 'newest' }), 'sv', {
        settings: { ...PRODUCT_LISTING_DEFAULT_SETTINGS, show_hero: false, show_count: false, columns: 3 },
      }),
    ).toMatchSnapshot();
  });

  it('collection, sv, sorted and searched', () => {
    expect(html(collection({ search: 'kopp', sort: 'newest' }), 'sv')).toMatchSnapshot();
  });

  it('collection, ar, price descending', () => {
    expect(html(collection({ sort: 'price_desc' }), 'ar')).toMatchSnapshot();
  });
});
