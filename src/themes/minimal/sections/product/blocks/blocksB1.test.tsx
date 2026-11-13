import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import type { ProductData } from '@/components/product/ProductDetailClient';
import type { ProductContext, SectionRenderProps } from '../../../../types';

// Product layout wave 2, B1: the title / price / variants / buy blocks and the
// rebuilt product-gallery / product-details / add-to-cart sections render
// from the page's shared product state, so two blocks never disagree.

const push = vi.fn();
const addItem = vi.fn(() => Promise.resolve());
let priceDelta = 0;

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  usePathname: () => '/en/products/x',
  useParams: () => ({ storeSlug: 'demo' }),
}));
vi.mock('next-intl', () => ({
  useLocale: () => 'en',
  useTranslations: () => (k: string, values?: Record<string, unknown>) =>
    values ? `${k}:${JSON.stringify(values)}` : k,
}));
vi.mock('@/hooks/useCart', () => ({ useCart: () => ({ addItem }) }));
// Plain <img> instead of next/image so the gallery's src can be asserted.
vi.mock('@/components/StoreImage', () => ({
  StoreImage: ({ src, alt, fetchPriority }: { src: string; alt: string; fetchPriority?: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} data-fetch-priority={fetchPriority} />
  ),
}));
// The personalization app is stubbed (it has its own tests): the blocks only
// read its form API and the shown price delta.
vi.mock('@/components/product/personalization/usePersonalizationApp', () => ({
  usePersonalizationApp: () => ({
    appOn: false,
    appSettings: {},
    market: null,
    storeSlug: 'demo',
    fields: {
      fields: [],
      values: {},
      onChange: () => undefined,
      validateAll: () => ({ ok: true }),
      buildPayload: () => ({ fields: {}, display: [] }),
      applyServerError: () => null,
      errors: {},
      showAllErrors: false,
    },
    advanced: null,
    cardsConfig: undefined,
    priceDelta,
    deltaInCart: false,
  }),
}));

import { ProductPageStateProvider, useProductPageState } from '@/components/product/state/ProductPageState';
import { ProductTitleBlock } from './ProductTitleBlock.client';
import { ProductPriceBlock } from './ProductPriceBlock.client';
import { ProductVariantsBlock } from './ProductVariantsBlock.client';
import { ProductBuyBlock } from './ProductBuyBlock.client';
import { ProductGalleryMagic } from '../ProductGalleryMagic.client';
import { ProductDetailsMagic } from '../ProductDetailsMagic.client';
import { AddToCartMagic } from '../AddToCartMagic.client';
import { registryB1 } from './registryB1';

const IMG = (name: string) => `https://cdn.test/${name}.jpg`;
const money = (n: number) => new Intl.NumberFormat('en', { style: 'currency', currency: 'SEK' }).format(n);

function makeProduct(overrides: Partial<ProductData> = {}): ProductData {
  return {
    id: 'p1',
    base_price: 100,
    translations: [
      { locale: 'en', title: 'Mug', slug: 'mug', description: '<p>Long text</p>', short_description: '<p>Short text</p>' },
    ],
    images: [{ id: 'i1', url: IMG('base-1') }, { id: 'i2', url: IMG('base-2') }],
    vendor: { company_name: 'Acme' },
    primary_collection_path: [{ id: 'c1', slug: 'mugs', path: ['mugs'], translations: [{ locale: 'en', name: 'Mugs' }] }],
    variants: [
      { id: 'v-red', sku: 'MUG-RED', price: 120, compare_at_price: 150, stock: 5, options: { Color: 'Red' }, images: [{ url: IMG('red-variant') }] },
      { id: 'v-green', sku: 'MUG-GREEN', price: 110, stock: 3, options: { Color: 'Green' } },
    ],
    variant_option_config: [
      { name: 'Color', style: 'color', values: ['Red', 'Green'], imageMap: { Green: IMG('green-value'), Red: IMG('red-value') } },
    ],
    personalization: { enabled: true, free_shipping_threshold: null },
    bundles: [
      {
        id: 'b1',
        status: 'ACTIVE',
        translations: [{ locale: 'en', name: 'Bundle' }],
        offers: [
          { id: 'o3', quantity: 3, discount_type: 'PERCENTAGE', discount_value: 10, sort_order: 0, translations: [{ locale: 'en', title: 'Buy 3' }] },
        ],
      },
    ],
    ...overrides,
  };
}

function props(product: ProductData | undefined, settings: Record<string, unknown> = {}, content: Record<string, unknown> = {}): SectionRenderProps {
  return {
    settings,
    content,
    locale: 'en',
    primaryLocale: 'en',
    storeSlug: 'demo',
    product: product as unknown as ProductContext,
    currency: 'SEK',
  };
}

function Provider({ product, children }: { product: ProductData; children: ReactNode }) {
  return (
    <ProductPageStateProvider product={product} locale="en" primaryLocale="en" currency="SEK">
      {children}
    </ProductPageStateProvider>
  );
}

describe('B1 product blocks', () => {
  beforeEach(() => {
    priceDelta = 0;
    addItem.mockClear();
  });

  it('registers every B1 key for the product template with EN + AR labels', () => {
    expect(Object.keys(registryB1).sort()).toEqual(
      ['add-to-cart', 'product-buy', 'product-details', 'product-gallery', 'product-price', 'product-title', 'product-variants'],
    );
    for (const [key, def] of Object.entries(registryB1)) {
      expect(def.schema.id).toBe(key);
      expect(def.schema.pageTypes).toEqual(['PRODUCT_TEMPLATE']);
      expect(def.schema.category).toBe('product');
      expect(def.schema.label.en).toBeTruthy();
      expect(def.schema.label.ar).toBeTruthy();
      expect(def.Component).toBeTruthy();
    }
  });

  it('title: H1, vendor and the primary collection link', () => {
    const product = makeProduct();
    render(<Provider product={product}><ProductTitleBlock {...props(product)} /></Provider>);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Mug');
    expect(screen.getByText(/product\.soldBy/).textContent).toContain('Acme');
    expect(screen.getByRole('link', { name: 'Mugs' }).getAttribute('href')).toContain('mugs');
  });

  it('title: the toggles hide the vendor and collection', () => {
    const product = makeProduct();
    render(<Provider product={product}><ProductTitleBlock {...props(product, { show_vendor: false, show_collection: false })} /></Provider>);
    expect(screen.queryByText(/product\.soldBy/)).toBeNull();
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('variant switch updates the gallery lead and the price in separate blocks at once', () => {
    const product = makeProduct();
    const { container } = render(
      <Provider product={product}>
        <div data-testid="gallery"><ProductGalleryMagic {...props(product, { layout: 'main-thumbnails' })} /></div>
        <div data-testid="variants"><ProductVariantsBlock {...props(product)} /></div>
        <div data-testid="price"><ProductPriceBlock {...props(product)} /></div>
        <div data-testid="details"><ProductDetailsMagic {...props(product)} /></div>
      </Provider>,
    );
    const lead = () => screen.getByTestId('gallery').querySelector('img')!.getAttribute('src');
    expect(lead()).toBe(IMG('base-1'));
    expect(screen.getByTestId('price').textContent).toContain(money(100));

    fireEvent.click(screen.getByTitle('Red'));

    expect(lead()).toBe(IMG('red-variant'));
    expect(screen.getByTestId('gallery').querySelector('img')!.getAttribute('data-fetch-priority')).toBe('high');
    const price = screen.getByTestId('price').textContent!;
    expect(price).toContain(money(120));
    expect(price).toContain(money(150));
    expect(price).toContain('SKU: MUG-RED');
    // product-details shows the same variant price, not the base price.
    const details = screen.getByTestId('details').querySelector('[data-product-price]')!.textContent;
    expect(details).toBe(money(120));
    expect(container.textContent).not.toContain('reviews');
  });

  it('a partial colour pick puts the imageMap image first in the gallery', () => {
    const product = makeProduct({
      variants: [
        { id: 'g-s', price: 110, stock: 3, options: { Color: 'Green', Size: 'S' } },
        { id: 'g-m', price: 110, stock: 3, options: { Color: 'Green', Size: 'M' } },
      ],
    });
    render(
      <Provider product={product}>
        <div data-testid="gallery"><ProductGalleryMagic {...props(product, { layout: 'stacked' })} /></div>
        <ProductVariantsBlock {...props(product)} />
      </Provider>,
    );
    fireEvent.click(screen.getByTitle('Green'));
    expect(screen.getByTestId('gallery').querySelector('img')!.getAttribute('src')).toBe(IMG('green-value'));
  });

  it('price: personalization delta and the unit × quantity line', () => {
    priceDelta = 25;
    const product = makeProduct({ variants: [], bundles: [] });
    render(
      <Provider product={product}>
        <div data-testid="price"><ProductPriceBlock {...props(product)} /></div>
        <ProductBuyBlock {...props(product)} />
      </Provider>,
    );
    expect(screen.getByTestId('price').textContent).toContain(money(125));
    fireEvent.click(screen.getByLabelText('increaseQuantity'));
    const text = screen.getByTestId('price').textContent!;
    expect(text).toContain(money(250));
    expect(text).toContain(`${money(125)} × 2`);
  });

  it('buy: a bundle offer forces the quantity minimum and step, and prices the line', () => {
    const product = makeProduct({ variants: [] });
    // The bundle picker is a B2 block; the shared state's action stands in.
    function SelectBundle() {
      const s = useProductPageState();
      return <button type="button" onClick={() => s.handleSelectBundle('o3')}>pick-bundle</button>;
    }
    render(
      <Provider product={product}>
        <div data-testid="price"><ProductPriceBlock {...props(product)} /></div>
        <div data-testid="buy"><ProductBuyBlock {...props(product)} /></div>
        <SelectBundle />
      </Provider>,
    );
    fireEvent.click(screen.getByText('pick-bundle'));
    const buy = screen.getByTestId('buy');
    expect(buy.textContent).toContain('Buy 3');
    expect(buy.querySelector('.min-w-10')!.textContent).toBe('3');
    expect(screen.getByLabelText('decreaseQuantity')).toBeDisabled();
    expect(screen.getByTestId('price').textContent).toContain(money(270));
    fireEvent.click(screen.getByLabelText('increaseQuantity'));
    expect(buy.querySelector('.min-w-10')!.textContent).toBe('6');
    // Dropping the bundle from the chip restores the plain step.
    fireEvent.click(screen.getByRole('button', { name: 'cart.remove' }));
    expect(buy.textContent).not.toContain('Buy 3');
  });

  it('add-to-cart is disabled when the selected variant is out of stock (buy block and composite)', () => {
    const product = makeProduct({
      variants: [{ id: 'only', price: 80, stock: 0, options: { Color: 'Red' } }],
      bundles: [],
    });
    render(
      <Provider product={product}>
        <div data-testid="buy"><ProductBuyBlock {...props(product)} /></div>
        <div data-testid="composite"><AddToCartMagic {...props(product)} /></div>
      </Provider>,
    );
    const buyButton = screen.getByTestId('buy').querySelector('button[data-on-primary], button.rounded-full') as HTMLButtonElement;
    expect(screen.getByRole('button', { name: 'common.addToCart' })).toBeDisabled();
    expect(buyButton.disabled).toBe(true);
    expect(screen.getByRole('button', { name: 'product.outOfStock' })).toBeDisabled();
  });

  it('buy: adds the chosen variant with the shared quantity and shows the toast', async () => {
    const product = makeProduct();
    render(
      <Provider product={product}>
        <ProductVariantsBlock {...props(product)} />
        <ProductBuyBlock {...props(product)} />
      </Provider>,
    );
    const add = screen.getByRole('button', { name: 'common.addToCart' });
    expect(add).toBeDisabled();
    expect(screen.getByText('product.selectOptions')).toBeTruthy();
    fireEvent.click(screen.getByTitle('Red'));
    expect(add).not.toBeDisabled();
    fireEvent.click(screen.getByLabelText('increaseQuantity'));
    await act(async () => {
      fireEvent.click(add);
    });
    expect(addItem).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(addItem.mock.calls[0])).toContain('v-red');
    expect(screen.getAllByRole('status').length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: 'cart.viewCart' }).getAttribute('href')).toBe('/cart');
  });

  it('buy: content button label and the sticky mobile CTA', () => {
    const product = makeProduct({ variants: [] });
    const { container } = render(
      <Provider product={product}>
        <ProductBuyBlock {...props(product, { sticky_on_mobile: true, show_quantity: false }, { button_label: 'Buy now' })} />
      </Provider>,
    );
    expect(screen.getAllByRole('button', { name: 'Buy now' })).toHaveLength(2);
    expect(container.querySelector('[data-sticky-cta]')).not.toBeNull();
    expect(screen.queryByLabelText('increaseQuantity')).toBeNull();
  });

  it('add-to-cart composite honours the old setting names', () => {
    const product = makeProduct({
      variants: [{ id: 'only', price: 80, stock: 4, options: { Color: 'Red' } }],
      bundles: [],
    });
    const { container } = render(
      <Provider product={product}>
        <AddToCartMagic
          {...props(
            product,
            { button_style: 'outline', full_width: false, show_quantity: false, show_stock: true, sticky_on_mobile: true },
            { button_label: 'Grab it' },
          )}
        />
      </Provider>,
    );
    const buttons = screen.getAllByRole('button', { name: 'Grab it' });
    // Inline + sticky copy.
    expect(buttons).toHaveLength(2);
    expect(buttons[0].className).not.toContain('w-full');
    expect(buttons[0].getAttribute('style')).toContain('transparent');
    expect(screen.queryByLabelText('increaseQuantity')).toBeNull();
    expect(screen.getByText(/product\.stockCount/)).toBeTruthy();
    expect(container.querySelector('[data-product-price]')!.textContent).toBe(money(80));
  });

  it('product-details and the add-to-cart composite show the same line price (quantity and bundle)', () => {
    const product = makeProduct({ variants: [] });
    function SelectBundle() {
      const s = useProductPageState();
      return <button type="button" onClick={() => s.handleSelectBundle('o3')}>pick-bundle</button>;
    }
    render(
      <Provider product={product}>
        <div data-testid="details"><ProductDetailsMagic {...props(product)} /></div>
        <div data-testid="composite"><AddToCartMagic {...props(product)} /></div>
        <SelectBundle />
      </Provider>,
    );
    const headline = (id: string) => screen.getByTestId(id).querySelector('[data-product-price]')!.textContent;
    const strike = (id: string) => screen.getByTestId(id).querySelector('.line-through')?.textContent ?? null;

    // Quantity 2, no bundle: both show the line total, the composite adds unit × qty.
    fireEvent.click(screen.getByRole('button', { name: 'common.increaseQuantity' }));
    expect(headline('details')).toBe(money(200));
    expect(headline('composite')).toBe(money(200));
    expect(screen.getByTestId('composite').textContent).toContain(`${money(100)} × 2`);

    // Bundle of 3 at -10%: both strike the base total and show the discounted line.
    fireEvent.click(screen.getByText('pick-bundle'));
    expect(headline('details')).toBe(money(270));
    expect(headline('composite')).toBe(money(270));
    expect(strike('details')).toBe(money(300));
    expect(strike('composite')).toBe(money(300));
    expect(screen.getByTestId('composite').textContent).toContain(`${money(90)} × 3`);
  });

  it('product-details honours the old toggles and never renders a rating', () => {
    const product = makeProduct({ compare_at_price: 200, variants: [] });
    const { container, rerender } = render(
      <Provider product={product}>
        <ProductDetailsMagic {...props(product, { show_rating: true })} />
      </Provider>,
    );
    expect(container.textContent).toContain('-50%');
    expect(container.textContent).toContain('Short text');
    expect(container.textContent).toContain('Long text');
    expect(container.textContent).not.toMatch(/review|تقييم/);
    rerender(
      <Provider product={product}>
        <ProductDetailsMagic {...props(product, { show_price: false, show_description: false, show_sale_badge: false })} />
      </Provider>,
    );
    expect(container.querySelector('[data-product-price]')).toBeNull();
    expect(container.textContent).not.toContain('Long text');
    expect(container.textContent).not.toContain('-50%');
  });

  it('gallery honours the old layouts and the classic layout is the product page gallery', () => {
    const product = makeProduct({ variants: [] });
    const { container, rerender } = render(
      <Provider product={product}>
        <ProductGalleryMagic {...props(product, { layout: 'grid', aspect: 'portrait' })} />
      </Provider>,
    );
    expect(container.querySelectorAll('img')).toHaveLength(2);
    expect(container.querySelector('.aspect-\\[3\\/4\\]')).not.toBeNull();
    rerender(
      <Provider product={product}>
        <ProductGalleryMagic {...props(product, { layout: 'main-thumbnails', enable_zoom: false })} />
      </Provider>,
    );
    // Main image + two thumbnails; no zoom hint.
    expect(container.querySelectorAll('img')).toHaveLength(3);
    expect(container.querySelector('.lucide-zoom-in')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Image 2' }));
    expect(container.querySelector('img')!.getAttribute('src')).toBe(IMG('base-2'));
    rerender(
      <Provider product={product}>
        <ProductGalleryMagic {...props(product, { layout: 'main-thumbnails' })} />
      </Provider>,
    );
    expect(container.querySelector('.lucide-zoom-in')).not.toBeNull();
  });

  it('without a provider: placeholder in the builder (no product), nothing on the storefront', () => {
    const product = makeProduct();
    const blocks = [ProductTitleBlock, ProductPriceBlock, ProductVariantsBlock, ProductBuyBlock, ProductGalleryMagic, ProductDetailsMagic, AddToCartMagic];
    for (const Block of blocks) {
      const preview = render(<Block {...props(undefined)} />);
      expect(preview.container.querySelector('[data-product-block-placeholder]')).not.toBeNull();
      preview.unmount();
      const live = render(<Block {...props(product)} />);
      expect(live.container.innerHTML).toBe('');
      live.unmount();
      const explicit = render(<Block {...props(product)} builderPreview />);
      expect(explicit.container.querySelector('[data-product-block-placeholder]')).not.toBeNull();
      explicit.unmount();
    }
  });
});
