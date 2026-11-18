import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { CardExtras } from '@/lib/productCard/model';
import { resolveProductCard, type ProductCardSettings, type ProductCardStored } from '@/lib/productCard/settings';

// Enhanced product card (builder W1): the fixed structure (article, one
// stretched link, buttons outside the link), the hover image, the badge
// modes, availability and the price path.

const display = vi.fn((amount: number) => ({ amount }));

vi.mock('next/link', () => ({
  default: ({ href, children, prefetch: _prefetch, ...rest }: { href: string; children: React.ReactNode; prefetch?: boolean }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock('next-intl', () => ({
  useTranslations: () => (k: string, values?: Record<string, unknown>) => (values ? `${k}:${JSON.stringify(values)}` : k),
}));
vi.mock('@/hooks/useDisplayPrice', () => ({ useDisplayPrice: () => display }));
vi.mock('@/components/product/PriceTaxSuffix', () => ({
  PriceTaxSuffix: ({ taxRateBp }: { taxRateBp?: number | null }) => <span data-testid="tax" data-rate={String(taxRateBp)} />,
}));
vi.mock('@/components/StoreImage', () => ({
  StoreImage: ({ src, alt, loading, className, fetchPriority }: { src: string; alt: string; loading?: 'lazy' | 'eager'; className?: string; fetchPriority?: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} loading={loading} className={className} data-priority={fetchPriority} />
  ),
}));
vi.mock('./QuickAddButton.client', () => ({
  QuickAddButton: ({ productSlug }: { productSlug: string }) => (
    <button type="button" data-testid="quick-add" data-slug={productSlug} />
  ),
}));
vi.mock('./CardSwatchList', () => ({ CardSwatchList: () => <ul data-testid="swatches" /> }));
vi.mock('./CardSizeLine', () => ({ CardSizeLine: () => <p data-testid="sizes" /> }));

import { ProductCardEnhanced } from './ProductCardEnhanced';

const settings = (stored: ProductCardStored = {}): ProductCardSettings => resolveProductCard(stored)!;
const extras = (over: Partial<CardExtras> = {}): CardExtras => ({
  second_image: null,
  swatches: null,
  sizes: null,
  stock: null,
  has_variants: false,
  ...over,
});

const BASE = { title: 'Linen shirt', href: '/products/linen-shirt', price: 80, imageUrl: '/uploads/a.jpg', currency: 'EUR' };

function draw(stored: ProductCardStored, props: Partial<React.ComponentProps<typeof ProductCardEnhanced>> = {}) {
  return render(<ProductCardEnhanced {...BASE} settings={settings(stored)} {...props} />).container;
}

describe('ProductCardEnhanced: structure', () => {
  it('is an article with one link, named by the title', () => {
    const c = draw({ style: 'editorial' });
    const root = c.firstElementChild!;
    expect(root.tagName).toBe('ARTICLE');
    expect(root.classList.contains('pcard')).toBe(true);
    expect(root.getAttribute('data-card-style')).toBe('editorial');
    expect(root.getAttribute('data-corners')).toBe('square');
    const links = c.querySelectorAll('a');
    expect(links).toHaveLength(1);
    expect(links[0].className).toBe('pcard-link');
    expect(links[0].getAttribute('href')).toBe('/products/linen-shirt');
    expect(links[0].textContent).toBe('Linen shirt');
    expect(links[0].closest('h3')).not.toBeNull();
    // The image is decorative: the link carries the name once.
    expect(c.querySelector('img.pcard-img')!.getAttribute('alt')).toBe('');
  });

  it('keeps the quick-add button out of the link', () => {
    const c = draw({ quick_add: true }, { productSlug: 'linen-shirt', card: extras() });
    const button = c.querySelector('[data-testid="quick-add"]')!;
    expect(button.getAttribute('data-slug')).toBe('linen-shirt');
    expect(button.closest('a')).toBeNull();
    expect(button.closest('.pcard-actions')).not.toBeNull();
    expect(c.querySelector('a button, a [role="button"]')).toBeNull();
  });

  it('renders no quick add without the setting or without a slug', () => {
    expect(draw({ quick_add: false }, { productSlug: 'x' }).querySelector('.pcard-actions')).toBeNull();
    expect(draw({ quick_add: true }).querySelector('.pcard-actions')).toBeNull();
  });

  it('editorial has no veil and no "View" pill; the classic look keeps them', () => {
    expect(draw({ style: 'editorial' }).querySelector('.pcard-overlay')).toBeNull();
    const classic = draw({});
    expect(classic.firstElementChild!.getAttribute('data-corners')).toBe('theme');
    const veil = classic.querySelector('.pcard-overlay')!;
    expect(veil.getAttribute('aria-hidden')).toBe('true');
    expect(veil.textContent).toBe('view');
  });

  it('takes the motion attributes of the classic card, or the caller\'s own', () => {
    const still = draw({}).firstElementChild!;
    expect([...still.attributes].some((a) => a.name.startsWith('data-cx-'))).toBe(false);
    expect(draw({}).querySelector('.pcard-media')!.hasAttribute('data-cx-hover')).toBe(false);

    const moving = draw({}, { motion: 'on' as never });
    expect(moving.querySelector('.pcard-media')!.getAttribute('data-cx-hover')).toBe('media');
    expect([...moving.firstElementChild!.attributes].some((a) => a.name.startsWith('data-cx-'))).toBe(true);

    const arriving = draw({}, { motion: 'on' as never, arriving: 2 });
    expect(arriving.firstElementChild!.hasAttribute('data-cx-more')).toBe(true);

    const own = draw({}, { motion: 'on' as never, entrance: { 'data-cx-own': '1' } as never });
    expect(own.firstElementChild!.getAttribute('data-cx-own')).toBe('1');
    expect(own.firstElementChild!.hasAttribute('data-cx-more')).toBe(false);
  });
});

describe('ProductCardEnhanced: hover image', () => {
  it('renders the second image lazily, hidden from assistive tech, only when the setting is on', () => {
    const card = extras({ second_image: '/uploads/b.jpg' });
    expect(draw({ hover_image: false }, { card }).querySelector('.pcard-alt')).toBeNull();
    expect(draw({ hover_image: true }, { card: extras() }).querySelector('.pcard-alt')).toBeNull();

    const c = draw({ hover_image: true }, { card, priority: true });
    const alt = c.querySelector('img.pcard-alt')!;
    expect(alt.getAttribute('src')).toContain('/uploads/b.jpg');
    // Lazy even on a priority card: only the first image may be the LCP.
    expect(alt.getAttribute('loading')).toBe('lazy');
    expect(alt.getAttribute('data-priority')).toBeNull();
    expect(alt.getAttribute('alt')).toBe('');
    // The veil would cover the second image: it leaves.
    expect(c.querySelector('.pcard-overlay')).toBeNull();
  });

  it('skips a second image equal to the first', () => {
    const c = draw({ hover_image: true }, { card: extras({ second_image: '/uploads/a.jpg' }), imageUrl: '/uploads/a.jpg' });
    expect(c.querySelector('.pcard-alt')).toBeNull();
  });

  it('the stylesheet shows it only to a hovering fine pointer', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/components/product/card/pcard.css'), 'utf8').replace(/\s+/g, ' ');
    // Default: not rendered at all, so a lazy image is never fetched on touch.
    expect(css).toMatch(/\.pcard-alt \{ display: none; \}/);
    const gate = css.indexOf('@media (hover: hover) and (pointer: fine) { .pcard-alt { display: block;');
    expect(gate).toBeGreaterThan(css.indexOf('.pcard-alt { display: none; }'));
    // No physical property in the sheet (RTL).
    expect(css).not.toMatch(/[\s;{](left|right|margin-left|margin-right|padding-left|padding-right)\s*:/);
  });
});

describe('ProductCardEnhanced: badge', () => {
  const sale = { price: 80, comparePrice: 100 };

  it('percent: "-N%" with a spoken form', () => {
    const b = draw({ badge: 'percent' }, sale).querySelector('.pcard-badge[data-kind="sale"]')!;
    expect(b.querySelector('[aria-hidden="true"]')!.textContent).toBe('-20%');
    expect(b.querySelector('.pcard-sr')!.textContent).toBe('percentOff:{"percent":20}');
    expect(b.getAttribute('data-at')).toBe('start');
  });

  it('sale: the word', () => {
    expect(draw({ badge: 'sale' }, sale).querySelector('.pcard-badge[data-kind="sale"]')!.textContent).toBe('sale');
  });

  it('none: hidden, and no badge without a discount', () => {
    expect(draw({ badge: 'none' }, sale).querySelector('.pcard-badge')).toBeNull();
    expect(draw({ badge: 'percent' }, { price: 80, comparePrice: 80 }).querySelector('.pcard-badge')).toBeNull();
    expect(draw({ badge: 'sale' }).querySelector('.pcard-badge')).toBeNull();
  });

  it('the custom badge yields to a discount, the promotion label stays', () => {
    const plain = draw({}, { badge: 'New', promotionLabel: '3 for 2' });
    expect(plain.querySelector('.pcard-badge[data-kind="custom"]')!.textContent).toBe('New');
    expect(plain.querySelector('.pcard-badge[data-kind="promo"]')!.getAttribute('data-at')).toBe('end');

    const reduced = draw({}, { ...sale, badge: 'New', promotionLabel: '3 for 2' });
    expect(reduced.querySelector('.pcard-badge[data-kind="custom"]')).toBeNull();
    expect(reduced.querySelector('.pcard-badge[data-kind="promo"]')!.textContent).toBe('3 for 2');
  });
});

describe('ProductCardEnhanced: availability', () => {
  const low = extras({ stock: { soldOut: false, count: 2 } });
  const out = extras({ stock: { soldOut: true, count: null } });

  it('off: nothing', () => {
    const c = draw({ availability: 'off' }, { card: out });
    expect(c.querySelector('.pcard-stock')).toBeNull();
    expect(c.firstElementChild!.hasAttribute('data-sold-out')).toBe(false);
  });

  it('sold_out: the sold-out line only', () => {
    const c = draw({ availability: 'sold_out' }, { card: out });
    expect(c.querySelector('.pcard-stock')!.textContent).toBe('outOfStock');
    expect(c.firstElementChild!.hasAttribute('data-sold-out')).toBe(true);
    expect(draw({ availability: 'sold_out' }, { card: low }).querySelector('.pcard-stock')).toBeNull();
  });

  it('sold_out_and_low: "Only N left" up to the threshold', () => {
    const c = draw({ availability: 'sold_out_and_low' }, { card: low });
    expect(c.querySelector('.pcard-stock[data-state="low"]')!.textContent).toBe('onlyNLeft:{"count":2}');
    const above = draw({ availability: 'sold_out_and_low', low_stock_threshold: 1 }, { card: low });
    expect(above.querySelector('.pcard-stock')).toBeNull();
    const five = extras({ stock: { soldOut: false, count: 5 } });
    expect(draw({ availability: 'sold_out_and_low' }, { card: five }).querySelector('.pcard-stock')).toBeNull();
    expect(
      draw({ availability: 'sold_out_and_low', low_stock_threshold: 5 }, { card: five }).querySelector('.pcard-stock'),
    ).not.toBeNull();
  });

  it('untracked stock shows nothing', () => {
    const c = draw({ availability: 'sold_out_and_low' }, { card: extras({ stock: null }) });
    expect(c.querySelector('.pcard-stock')).toBeNull();
    expect(draw({ availability: 'sold_out_and_low' }).querySelector('.pcard-stock')).toBeNull();
  });
});

describe('ProductCardEnhanced: price and parts', () => {
  it('formats through the display price with the tax rate, and prints the suffix', () => {
    display.mockClear();
    display.mockImplementation((amount: number) => ({ amount: amount * 0.8 }));
    const c = draw({}, { price: 100, comparePrice: 150, taxRateBp: 2500 });
    expect(display).toHaveBeenCalledWith(100, 2500, 'EUR');
    expect(display).toHaveBeenCalledWith(150, 2500, 'EUR');
    expect(c.querySelector('.pcard-price-now')!.textContent).toBe('€80.00');
    expect(c.querySelector('.pcard-price-was')!.textContent).toBe('€120.00');
    expect(c.querySelector('[data-testid="tax"]')!.getAttribute('data-rate')).toBe('2500');
    display.mockImplementation((amount: number) => ({ amount }));
  });

  it('renders swatches and sizes only with the setting and the model part', () => {
    const card = extras({
      swatches: { items: [{ value: 'Sand', css: '#d8c7a8' }], more: 0, total: 1 },
      sizes: { items: [{ value: 'M', available: true }], more: 0 },
    });
    const on = draw({ swatches: true, sizes_line: true }, { card });
    expect(on.querySelector('[data-testid="swatches"]')).not.toBeNull();
    expect(on.querySelector('[data-testid="sizes"]')).not.toBeNull();
    const off = draw({}, { card });
    expect(off.querySelector('[data-testid="swatches"]')).toBeNull();
    expect(off.querySelector('[data-testid="sizes"]')).toBeNull();
    const empty = draw({ swatches: true, sizes_line: true }, { card: extras() });
    expect(empty.querySelector('[data-testid="swatches"]')).toBeNull();
    expect(empty.querySelector('[data-testid="sizes"]')).toBeNull();
  });

  it('prints the vendor line and a placeholder without an image', () => {
    const c = draw({}, { vendorName: 'Atelier', imageUrl: undefined });
    expect(c.querySelector('.pcard-vendor')!.textContent).toBe('soldBy:{"name":"Atelier"}');
    expect(c.querySelector('.pcard-placeholder')).not.toBeNull();
    expect(c.querySelector('img')).toBeNull();
  });
});
