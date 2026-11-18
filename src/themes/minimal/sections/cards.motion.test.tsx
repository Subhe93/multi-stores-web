import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Store motion style on product cards and product rows (builder S2):
// featured-products, collection-products, product-slider, product-listing,
// ProductCard and the built-in paged grid with "load more".

const getProductsPage = vi.fn();

vi.mock('@/lib/api', () => ({
  storefront: { getProducts: () => new Promise(() => {}), getProductsPage: (...a: unknown[]) => getProductsPage(...a) },
  resolveMediaUrl: (u: string) => u,
}));
vi.mock('@/hooks/useMarket', () => ({ useMarket: () => null }));
vi.mock('next-intl', () => ({
  useTranslations: (ns?: string) => (k: string, values?: Record<string, unknown>) => {
    const key = ns ? `${ns}.${k}` : k;
    return values ? `${key}[${Object.entries(values).map(([n, v]) => `${n}=${v}`).join(',')}]` : key;
  },
}));
vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useRouter: () => ({ push: vi.fn(), prefetch: vi.fn() }),
  useSelectedLayoutSegment: () => null,
}));

import { ProductCard } from '@/components/product/ProductCard';
import { ListingPagedGrid } from '@/components/listing/ListingPagedGrid';
import type { ListingPagination } from '@/lib/listingPaging';
import { SectionRenderer } from '../../SectionRenderer';
import { CARDS_CSS } from '../../creative/css/cards.css';
import { G } from '../../creative/css/base.css';
import { minimalTheme } from '../theme';
import type { ListingContext, ListingProduct, SectionInstance, SectionRenderProps } from '../../types';
import { featuredProductsSection } from './FeaturedProducts';
import { collectionProductsSection } from './CollectionProducts';
import { productSliderSection } from './ProductSlider';
import { productListingMagicSection, PRODUCT_LISTING_DEFAULT_SETTINGS } from './listing/ProductListingMagic';

type Motion = SectionRenderProps['motion'];

const product = (i: number) => ({
  id: `p${i}`,
  base_price: 100 + i,
  compare_at_price: i === 0 ? 150 : undefined,
  translations: [{ locale: 'en', title: `Product ${i}`, slug: `product-${i}` }],
  images: [{ url: `/uploads/${i}.jpg` }],
});
const PRELOADED = [0, 1, 2, 3].map(product);

const ROWS = {
  'featured-products': featuredProductsSection,
  'collection-products': collectionProductsSection,
  'product-slider': productSliderSection,
} as const;

function row(key: keyof typeof ROWS, motion?: Motion) {
  const def = ROWS[key];
  const Component = def.Component;
  return renderToStaticMarkup(
    <Component
      settings={{ ...def.defaultSettings }}
      content={{ heading: 'New arrivals today', subheading: 'Fresh picks', link_label: 'See all' }}
      locale="en"
      primaryLocale="en"
      storeSlug="demo"
      currency="EUR"
      preloaded={PRELOADED}
      motion={motion}
    />,
  );
}

const dom = (html: string) => {
  const el = document.createElement('div');
  el.innerHTML = html;
  return el;
};

describe.each(Object.keys(ROWS) as Array<keyof typeof ROWS>)('%s with the store motion style', (key) => {
  it('without the motion prop the markup is the markup of today', () => {
    const plain = row(key);
    expect(plain).not.toContain('data-cx-');
    expect(plain).not.toContain('cx-w');
    expect(plain).toContain('object-cover transition-transform duration-500 group-hover:scale-105');
    expect(plain).toContain('shrink-0 hover:opacity-70 transition-opacity"');
    expect(plain).toBe(row(key, undefined));
  });

  it('scroll: heading in masked words, subheading rises, link sweeps, frames zoom slowly', () => {
    const el = dom(row(key, 'scroll'));
    expect(el.querySelector('h2 [data-cx-reveal="words"]')).not.toBeNull();
    expect(el.querySelectorAll('h2 .cx-wi')).toHaveLength(3);
    expect(el.querySelector('p[data-cx-reveal="rise"]')?.getAttribute('data-cx-i')).toBe('2');
    const link = el.querySelector('a[data-cx-hover="underline"]');
    expect(link?.hasAttribute('data-cx-arrow')).toBe(true);
    expect(link?.className).not.toContain('hover:opacity-70');
    expect(el.querySelectorAll('[data-cx-hover="media"]')).toHaveLength(4);
    // The recipe zoom replaces the utility zoom, never both.
    expect(el.innerHTML).not.toContain('group-hover:scale-');
    // No lift: these cards have no surface or border of their own.
    expect(el.querySelector('[data-cx-hover="lift"]')).toBeNull();
  });

  it('intro: the heading plays on load, the cards keep the scroll form (never hidden above the fold)', () => {
    const el = dom(row(key, 'intro'));
    expect(el.querySelector('h2 [data-cx-intro="words"]')).not.toBeNull();
    expect(el.querySelector('a[href="/products/product-0"]')?.hasAttribute('data-cx-intro')).toBe(false);
  });

  it('text, links and prices do not change', () => {
    const plain = dom(row(key));
    const moving = dom(row(key, 'scroll'));
    expect(moving.textContent).toBe(plain.textContent);
    const hrefs = (el: HTMLElement) => Array.from(el.querySelectorAll('a')).map((a) => a.getAttribute('href'));
    expect(hrefs(moving)).toEqual(hrefs(plain));
  });
});

describe('grids and slider', () => {
  it.each(['featured-products', 'collection-products'] as const)('%s: the grid staggers and each card is an item', (key) => {
    for (const motion of ['scroll', 'intro'] as const) {
      const el = dom(row(key, motion));
      const grid = el.querySelector('[data-cx-reveal="stagger"]');
      expect(grid?.className).toContain('grid');
      expect(Array.from(grid!.children).every((c) => c.tagName === 'A' && c.hasAttribute('data-cx-item'))).toBe(true);
      expect(grid!.children).toHaveLength(4);
    }
  });

  it('product-slider: the row is one reveal, slides carry their step, the track is untouched', () => {
    const el = dom(row('product-slider', 'scroll'));
    const wrap = el.querySelector('[data-cx-reveal="slides"]');
    expect(wrap?.firstElementChild?.getAttribute('aria-roledescription')).toBe('carousel');
    const slides = Array.from(el.querySelectorAll('[data-cx-slide]'));
    expect(slides.map((s) => s.getAttribute('data-cx-i'))).toEqual([null, '1', '2', '3']);
    expect(el.querySelector('[data-cx-item]')).toBeNull();
    // Without motion the slider is not wrapped.
    expect(dom(row('product-slider')).querySelector('section > [aria-roledescription="carousel"]')).not.toBeNull();
  });
});

describe('ProductCard', () => {
  const card = (extra: Partial<Parameters<typeof ProductCard>[0]> = {}) =>
    renderToStaticMarkup(<ProductCard title="Mug" href="/products/mug" price={12} imageUrl="/uploads/mug.jpg" {...extra} />);

  it('default: no engine attribute, the utility zoom stays', () => {
    const html = card();
    expect(html).not.toContain('data-cx-');
    expect(html).toContain('object-cover transition-transform duration-500 group-hover:scale-110');
    expect(html).toBe(card({ motion: undefined, arriving: 2 }));
  });

  it('motion: stagger item on the link itself, slow zoom on the frame', () => {
    for (const motion of ['scroll', 'intro'] as const) {
      const a = dom(card({ motion })).firstElementChild!;
      expect(a.tagName).toBe('A');
      expect(a.hasAttribute('data-cx-item')).toBe(true);
      expect(a.hasAttribute('data-cx-intro')).toBe(false);
      expect(a.firstElementChild?.getAttribute('data-cx-hover')).toBe('media');
      expect(a.innerHTML).not.toContain('group-hover:scale-110');
      expect(a.textContent).toBe(dom(card()).textContent);
    }
  });

  it('arriving: an appended card rises once on mount with its step', () => {
    const a = dom(card({ motion: 'scroll', arriving: 3 })).firstElementChild!;
    expect(a.getAttribute('data-cx-intro')).toBe('rise');
    expect(a.getAttribute('data-cx-i')).toBe('3');
    expect(a.hasAttribute('data-cx-more')).toBe(true);
    expect(a.hasAttribute('data-cx-item')).toBe(false);
    expect(dom(card({ motion: 'scroll', arriving: 0 })).firstElementChild!.hasAttribute('data-cx-i')).toBe(false);
  });
});

describe('product-listing section', () => {
  const ProductListingMagic = productListingMagicSection.Component;
  const PRODUCTS: ListingProduct[] = [0, 1, 2].map((i) => ({
    id: `p${i}`,
    base_price: 100 + i,
    translations: [{ locale: 'en', title: `Product ${i}`, slug: `product-${i}` }],
    images: [{ url: `/uploads/${i}.jpg` }],
  }));
  const listing = (hero: boolean): ListingContext =>
    ({
      kind: 'catalog',
      products: PRODUCTS,
      collections: [],
      query: {},
      hero: { enabled: hero, show_count: true },
      basePath: '/products',
      isFiltered: false,
    }) as ListingContext;
  const html = (motion: Motion, hero = false) =>
    renderToStaticMarkup(
      <ProductListingMagic
        settings={{ ...PRODUCT_LISTING_DEFAULT_SETTINGS }}
        content={{ heading: 'All products', subheading: 'Everything we make' }}
        locale="en"
        primaryLocale="en"
        storeSlug="demo"
        currency="EUR"
        listing={listing(hero)}
        motion={motion}
      />,
    );

  it('without motion: no engine attribute', () => {
    expect(html(undefined)).not.toContain('data-cx-');
    expect(html(undefined, true)).not.toContain('data-cx-');
  });

  it('intro (the usual case): title in words, grid in the scroll form, controls untouched', () => {
    const el = dom(html('intro'));
    expect(el.querySelector('h1 [data-cx-intro="words"]')).not.toBeNull();
    expect(el.querySelector('h1')?.textContent).toBe('All products');
    const grid = el.querySelector('[data-cx-reveal="stagger"]')!;
    expect(grid.children).toHaveLength(3);
    expect(Array.from(grid.children).every((c) => c.tagName === 'A' && c.hasAttribute('data-cx-item'))).toBe(true);
    // Search, sort pills and the count line carry no entrance.
    for (const node of Array.from(el.querySelectorAll('form, form *, [role="status"]'))) {
      expect(node.hasAttribute('data-cx-intro') || node.hasAttribute('data-cx-reveal')).toBe(false);
    }
    expect(el.textContent).toBe(dom(html(undefined)).textContent);
  });

  it('banner: the subheading keeps its own opacity (no entrance on it)', () => {
    const el = dom(html('intro', true));
    expect(el.querySelector('h1 [data-cx-intro="words"]')).not.toBeNull();
    expect(el.querySelector('p.opacity-85')?.hasAttribute('data-cx-intro')).toBe(false);
  });
});

describe('per-section override through the renderer', () => {
  const section = (id: string, settings: Record<string, unknown>): SectionInstance => ({
    id,
    section_key: 'featured-products',
    settings,
    sort_order: Number(id.slice(1)),
    translations: [{ locale: 'en', content: { heading: 'Row heading' } }],
  });
  const page = [section('s1', {}), section('s2', {}), section('s3', { _style: { motion: 'none' } })];
  const render = (motion: boolean) =>
    renderToStaticMarkup(
      <SectionRenderer theme={minimalTheme} sections={page} locale="en" primaryLocale="en" storeSlug="demo" motion={motion} />,
    );
  const part = (html: string, id: string) => {
    const el = dom(html).querySelector(`[data-section-id="${id}"]`);
    return el ? el.outerHTML : '';
  };

  it('switch off: no engine attribute anywhere', () => {
    expect(render(false)).not.toContain('data-cx-');
  });

  it('switch on: the row gets its recipes, the section set to "none" does not', () => {
    const on = render(true);
    expect(part(on, 's2')).toContain('data-cx-reveal="words"');
    expect(part(on, 's2')).toContain('data-cx-hover="underline"');
    expect(part(on, 's3')).not.toBe('');
    expect(part(on, 's3')).not.toContain('data-cx-');
    expect(part(on, 's3')).toContain('hover:opacity-70 transition-opacity');
  });
});

describe('"load more" with the motion style', () => {
  const card = (i: number): ListingProduct => ({
    id: `p${i}`,
    base_price: 10 + i,
    translations: [{ locale: 'sv', title: `Produkt ${i}`, slug: `produkt-${i}` }],
    images: [{ url: `/uploads/${i}.jpg` }],
  });
  const PAGINATION: ListingPagination = { total: 9, pageSize: 3, hasMore: true, request: { locale: 'sv' } };

  beforeEach(() => {
    getProductsPage.mockReset();
  });

  const grid = (motion?: Motion) =>
    render(
      <ListingPagedGrid
        storeSlug="demo"
        initial={[0, 1, 2].map(card)}
        pagination={PAGINATION}
        locale="sv"
        lp=""
        currency="SEK"
        gridClassName="grid grid-cols-2"
        variant="catalog"
        motion={motion}
      />,
    );

  it('without motion nothing is marked, before or after loading more', async () => {
    getProductsPage.mockResolvedValue({
      items: [3, 4, 5].map((i) => ({ ...card(i), base_price: String(10 + i) })),
      total: 9,
      page: 2,
      limit: 3,
      has_more: true,
      legacy: false,
    });
    const { container } = grid();
    expect(container.innerHTML).not.toContain('data-cx-');
    fireEvent.click(screen.getByRole('button'));
    await waitFor(() => expect(container.querySelectorAll('.grid > a')).toHaveLength(6));
    expect(container.innerHTML).not.toContain('data-cx-');
  });

  it('first page: stagger items; appended cards rise on mount; focus moves to the first new card; button presses', async () => {
    getProductsPage.mockResolvedValue({
      items: [3, 4, 5, 6, 7].map((i) => ({ ...card(i), base_price: String(10 + i) })),
      total: 9,
      page: 2,
      limit: 3,
      has_more: true,
      legacy: false,
    });
    const { container } = grid('scroll');
    const gridEl = container.querySelector('.grid')!;
    expect(gridEl.getAttribute('data-cx-reveal')).toBe('stagger');
    expect(Array.from(gridEl.children).every((c) => c.hasAttribute('data-cx-item'))).toBe(true);
    const button = screen.getByRole('button');
    expect(button.getAttribute('data-cx-hover')).toBe('press');
    expect(button.hasAttribute('data-cx-magnetic')).toBe(false);

    await act(async () => {
      fireEvent.click(button);
    });
    await waitFor(() => expect(gridEl.children).toHaveLength(8));
    const cards = Array.from(gridEl.children);
    // The first page keeps its role; the new cards come in waves of four.
    expect(cards.slice(0, 3).every((c) => c.hasAttribute('data-cx-item') && !c.hasAttribute('data-cx-more'))).toBe(true);
    expect(cards.slice(3).map((c) => c.getAttribute('data-cx-intro'))).toEqual(Array(5).fill('rise'));
    expect(cards.slice(3).map((c) => c.getAttribute('data-cx-i'))).toEqual([null, '1', '2', '3', null]);
    // Cards stay direct children of the grid, so the focus hand-over works.
    expect(document.activeElement).toBe(cards[3]);
  });
});

describe('stylesheet slot', () => {
  it('every rule that hides or moves sits behind the gate', () => {
    const rules = CARDS_CSS.replace(/@media[^{]+\{/g, '').split('}').filter((r) => r.includes('{'));
    for (const rule of rules) {
      const selector = rule.split('{')[0];
      if (rule.includes('!important')) continue; // the print reset
      for (const one of selector.split(/,(?![^(]*\))/)) expect(one.startsWith('html[data-cx-motion] .store-root')).toBe(true);
    }
    expect(CARDS_CSS).toContain(`${G} [data-cx-reveal="slides"][data-cx-state="pending"] [data-cx-slide]{opacity:0`);
    expect(CARDS_CSS).not.toMatch(/\b(left|right|margin-left|margin-right)\s*:/);
  });
});
