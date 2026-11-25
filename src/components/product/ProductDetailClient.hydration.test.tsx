import { act, fireEvent } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { renderToString } from 'react-dom/server';
import { hydrateRoot, type Root } from 'react-dom/client';
import type { ProductData } from '@/components/product/ProductDetailClient';
import type { ProductContext, SectionRenderProps } from '@/themes/types';

// The add-to-cart buttons of the monolith product page (ProductDetailClient,
// used by every store on the monolith template, e.g. noroj) and of the
// add-to-cart magic section before hydration. Their server HTML can sit on
// screen without a click handler on a slow phone, and React does not replay
// a tap on a boundary whose chunk has not arrived (QA 2026-11-14 #8). Like
// the product-buy block they must look busy (natively disabled, aria-busy,
// spinner, store colour and label kept) until hydrated, then work normally;
// a product that cannot be added keeps its disabled look.

const addItem = vi.fn(() => Promise.resolve());

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/en/products/x',
  useParams: () => ({ storeSlug: 'demo' }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('next-intl', () => {
  const t = Object.assign(
    (k: string, values?: Record<string, unknown>) => (values ? `${k}:${JSON.stringify(values)}` : k),
    { rich: (k: string) => k, markup: (k: string) => k, raw: (k: string) => k, has: () => true },
  );
  return { useLocale: () => 'en', useTranslations: () => t };
});
vi.mock('@/hooks/useCart', () => ({ useCart: () => ({ addItem }) }));
vi.mock('@/components/StoreImage', () => ({
  StoreImage: ({ src, alt }: { src: string; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} />
  ),
}));

import { ProductDetailClient } from '@/components/product/ProductDetailClient';
import { ProductPageStateProvider } from '@/components/product/state/ProductPageState';
import { AddToCartMagic } from '@/themes/minimal/sections/product/AddToCartMagic.client';

function makeProduct(overrides: Partial<ProductData> = {}): ProductData {
  return {
    id: 'p1',
    base_price: 100,
    translations: [{ locale: 'en', title: 'Mug', slug: 'mug' }],
    images: [],
    variants: [],
    ...overrides,
  };
}

const OUT_OF_STOCK: Partial<ProductData> = {
  variants: [{ id: 'v1', price: 100, stock: 0, options: { Size: 'S' } }],
};

function Monolith({ product }: { product: ProductData }) {
  return (
    <ProductDetailClient
      product={product}
      locale="en"
      primaryLocale="en"
      currency="EUR"
      options={{ trustBadges: [], showShipping: false, showTabs: false }}
    />
  );
}

function magicProps(product: ProductData, settings: Record<string, unknown> = {}): SectionRenderProps {
  return {
    settings,
    content: {},
    locale: 'en',
    primaryLocale: 'en',
    storeSlug: 'demo',
    product: product as unknown as ProductContext,
    currency: 'SEK',
  };
}

function Magic({ product, settings }: { product: ProductData; settings?: Record<string, unknown> }) {
  return (
    <ProductPageStateProvider product={product} locale="en" primaryLocale="en" currency="SEK">
      <AddToCartMagic {...magicProps(product, settings)} />
    </ProductPageStateProvider>
  );
}

let root: Root | null = null;
let host: HTMLElement | null = null;
afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = null;
  host = null;
  addItem.mockClear();
});

function serverDom(ui: ReactNode): HTMLElement {
  const el = document.createElement('div');
  el.innerHTML = renderToString(ui);
  return el;
}

const addButtons = (el: HTMLElement) =>
  Array.from(el.querySelectorAll<HTMLButtonElement>('button')).filter((b) => b.textContent?.includes('common.addToCart'));

async function hydrate(ui: ReactNode) {
  host = document.createElement('div');
  host.innerHTML = renderToString(ui);
  document.body.appendChild(host);
  const recoverable = vi.fn();
  const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  await act(async () => {
    root = hydrateRoot(host!, ui, { onRecoverableError: recoverable });
  });
  expect(recoverable).not.toHaveBeenCalled();
  expect(consoleError.mock.calls.filter((c) => String(c[0]).toLowerCase().includes('hydrat'))).toEqual([]);
  consoleError.mockRestore();
  return host;
}

function expectReady(b: HTMLButtonElement) {
  expect(b.disabled).toBe(false);
  expect(b.hasAttribute('aria-busy')).toBe(false);
  expect(b.hasAttribute('data-hydrating')).toBe(false);
  expect(b.className).not.toContain('cursor-progress');
  expect(b.querySelector('svg.animate-spin')).toBeNull();
}

describe('monolith product page: add-to-cart button before hydration', () => {
  it('server HTML: busy and natively disabled, store colour and label kept, spinner instead of the cart icon', () => {
    const el = serverDom(<Monolith product={makeProduct()} />);
    const buttons = addButtons(el);
    expect(buttons).toHaveLength(1);
    const [b] = buttons;
    expect(b.disabled).toBe(true);
    expect(b.getAttribute('aria-busy')).toBe('true');
    expect(b.hasAttribute('data-hydrating')).toBe(true);
    expect(b.className).toContain('cursor-progress');
    expect(b.className).not.toContain('bg-gray-100');
    expect(b.getAttribute('style')).toContain('var(--store-primary');
    expect(b.hasAttribute('data-on-primary')).toBe(true);
    expect(b.querySelector('svg.animate-spin')).toBeTruthy();
    expect(b.textContent?.trim()).toBe('common.addToCart');
  });

  it('outline style keeps its outline colours while busy', () => {
    const el = serverDom(
      <ProductDetailClient product={makeProduct()} locale="en" primaryLocale="en" currency="EUR" options={{ buttonStyle: 'outline' }} />,
    );
    const [b] = addButtons(el);
    expect(b.disabled).toBe(true);
    expect(b.getAttribute('style')).toContain('border');
    expect(b.querySelector('svg.animate-spin')).toBeTruthy();
  });

  it('a product that cannot be added keeps its grey disabled look (no spinner) before hydration', () => {
    const el = serverDom(<Monolith product={makeProduct(OUT_OF_STOCK)} />);
    const [b] = addButtons(el);
    expect(b.disabled).toBe(true);
    expect(b.className).toContain('bg-gray-100');
    expect(b.className).not.toContain('cursor-progress');
    expect(b.querySelector('svg.animate-spin')).toBeNull();
  });

  it('after hydration: enabled, not busy, and the click adds to the cart (no mismatch)', async () => {
    const el = await hydrate(<Monolith product={makeProduct()} />);
    const [b] = addButtons(el);
    expectReady(b);
    await act(async () => {
      fireEvent.click(b);
    });
    expect(addItem).toHaveBeenCalledTimes(1);
  });
});

describe('add-to-cart magic section: button before hydration', () => {
  it('server HTML: busy and natively disabled, theme colours and label kept, spinner (inline and sticky)', () => {
    const el = serverDom(<Magic product={makeProduct()} settings={{ sticky_on_mobile: true }} />);
    const buttons = addButtons(el);
    expect(buttons).toHaveLength(2);
    for (const b of buttons) {
      expect(b.disabled).toBe(true);
      expect(b.getAttribute('aria-busy')).toBe('true');
      expect(b.hasAttribute('data-hydrating')).toBe(true);
      expect(b.className).toContain('cursor-progress');
      // Not the faded "unavailable" look.
      expect(b.className).not.toContain('disabled:opacity-50');
      expect(b.getAttribute('style')).toContain('var(--theme-colors-primary)');
      expect(b.querySelector('svg.animate-spin')).toBeTruthy();
      expect(b.textContent?.trim()).toBe('common.addToCart');
    }
  });

  it('an out-of-stock product keeps its disabled look and label (no spinner) before hydration', () => {
    const el = serverDom(<Magic product={makeProduct(OUT_OF_STOCK)} />);
    const b = Array.from(el.querySelectorAll<HTMLButtonElement>('button')).find((x) => x.textContent?.includes('product.outOfStock'));
    expect(b).toBeTruthy();
    expect(b!.disabled).toBe(true);
    expect(b!.className).toContain('disabled:opacity-50');
    expect(b!.className).not.toContain('cursor-progress');
    expect(b!.querySelector('svg.animate-spin')).toBeNull();
  });

  it('after hydration: enabled, not busy, and the click adds to the cart (no mismatch)', async () => {
    const el = await hydrate(<Magic product={makeProduct()} settings={{ sticky_on_mobile: true }} />);
    const buttons = addButtons(el);
    expect(buttons).toHaveLength(2);
    buttons.forEach(expectReady);
    await act(async () => {
      fireEvent.click(buttons[0]);
    });
    expect(addItem).toHaveBeenCalledTimes(1);
  });
});

// Variant URLs (M170 B): `?variant=<id>` preselects the variant in the server
// HTML; the client starts from the same selection (no hydration mismatch) and
// the page load does not rewrite the address bar.
describe('monolith product page: preselected variant (?variant=)', () => {
  const RED = '3f6c1c1e-0b7e-4a57-9a53-2f1a8f1d2c11';
  const BLUE = '9a1b2c3d-4e5f-4a6b-8c7d-0e1f2a3b4c5d';
  const product = makeProduct({
    images: [{ id: 'i1', url: 'https://cdn.test/base.jpg' }],
    variants: [
      { id: RED, sku: 'MUG-RED', price: 120, stock: 5, options: { Color: 'Red' }, images: [{ url: 'https://cdn.test/red.jpg' }] },
      { id: BLUE, sku: 'MUG-BLUE', price: 110, stock: 0, options: { Color: 'Blue' }, images: [{ url: 'https://cdn.test/blue.jpg' }] },
    ],
  });
  const page = (initialVariantId?: string) => (
    <ProductDetailClient
      product={product}
      locale="en"
      primaryLocale="en"
      currency="EUR"
      options={{ trustBadges: [], showShipping: false, showTabs: false }}
      syncVariantUrl
      {...(initialVariantId ? { initialVariantId } : null)}
    />
  );
  const imageSources = (el: HTMLElement) => Array.from(el.querySelectorAll('img')).map((i) => i.getAttribute('src'));

  it('server HTML: the image and the buyable state of the preselected variant', () => {
    const el = serverDom(page(RED));
    expect(imageSources(el)[0]).toBe('https://cdn.test/red.jpg');
    expect(addButtons(el)).toHaveLength(1);
    // Without the parameter the product gallery leads, as before.
    expect(imageSources(serverDom(page()))[0]).toBe('https://cdn.test/base.jpg');
  });

  it('server HTML: a sold-out preselected variant is rendered as sold out', () => {
    const el = serverDom(page(BLUE));
    expect(imageSources(el)[0]).toBe('https://cdn.test/blue.jpg');
    // Blocked for good (grey, no hydration spinner), unlike the buyable one.
    const [soldOut] = addButtons(el);
    expect(soldOut.disabled).toBe(true);
    expect(soldOut.className).toContain('bg-gray-100');
    expect(soldOut.className).not.toContain('cursor-progress');
    const [buyable] = addButtons(serverDom(page(RED)));
    expect(buyable.className).not.toContain('bg-gray-100');
    expect(buyable.className).toContain('cursor-progress');
  });

  it('hydrates without a mismatch and does not write the URL on load', async () => {
    // jsdom has no scrollIntoView (the gallery keeps the active thumb in view).
    const proto = Element.prototype as { scrollIntoView?: () => void };
    const hadScrollIntoView = 'scrollIntoView' in proto;
    if (!hadScrollIntoView) proto.scrollIntoView = () => undefined;
    const replaceState = vi.spyOn(window.history, 'replaceState');
    const el = await hydrate(page(RED));
    expect(imageSources(el)[0]).toBe('https://cdn.test/red.jpg');
    addButtons(el).forEach(expectReady);
    expect(replaceState).not.toHaveBeenCalled();
    replaceState.mockRestore();
    if (!hadScrollIntoView) delete proto.scrollIntoView;
  });
});
