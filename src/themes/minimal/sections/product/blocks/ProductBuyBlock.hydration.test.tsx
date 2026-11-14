import { act, fireEvent } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Suspense, lazy, type ReactNode } from 'react';
import { renderToString } from 'react-dom/server';
import { hydrateRoot, type Root } from 'react-dom/client';
import type { ProductData } from '@/components/product/ProductDetailClient';
import type { ProductContext, SectionRenderProps } from '../../../../types';

// The add-to-cart button of the product-buy block before hydration. The
// block is a lazy chunk, so its server HTML can sit on screen without a
// click handler for a while: the button must then look busy (aria-disabled,
// spinner, primary colour and label kept) without native `disabled`, so a tap
// in that window is replayed by React, and become a working button right
// after its boundary hydrates, without a hydration mismatch.

const addItem = vi.fn(() => Promise.resolve());

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/en/products/x',
  useParams: () => ({ storeSlug: 'demo' }),
}));
vi.mock('next-intl', () => ({
  useLocale: () => 'en',
  useTranslations: () => (k: string, values?: Record<string, unknown>) =>
    values ? `${k}:${JSON.stringify(values)}` : k,
}));
vi.mock('@/hooks/useCart', () => ({ useCart: () => ({ addItem }) }));
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
    priceDelta: 0,
    deltaInCart: false,
  }),
}));

import { ProductPageStateProvider } from '@/components/product/state/ProductPageState';
import { ProductBuyBlock } from './ProductBuyBlock.client';

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

function props(product: ProductData, settings: Record<string, unknown> = {}): SectionRenderProps {
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

function Page({ product, children }: { product: ProductData; children: ReactNode }) {
  return (
    <ProductPageStateProvider product={product} locale="en" primaryLocale="en" currency="SEK">
      {children}
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

/** Server HTML of `ui`, parsed into a detached container. */
function serverDom(ui: ReactNode): HTMLElement {
  const el = document.createElement('div');
  el.innerHTML = renderToString(ui);
  return el;
}

const addButtons = (el: HTMLElement) =>
  Array.from(el.querySelectorAll<HTMLButtonElement>('button')).filter((b) => b.textContent?.includes('common.addToCart'));

describe('product-buy: add-to-cart button before hydration', () => {
  it('server HTML: busy and aria-disabled (not natively disabled), primary colour and label kept, spinner instead of the cart icon', () => {
    const product = makeProduct();
    const el = serverDom(
      <Page product={product}>
        <ProductBuyBlock {...props(product, { sticky_on_mobile: true })} />
      </Page>,
    );
    const buttons = addButtons(el);
    // Inline button and sticky mobile CTA.
    expect(buttons).toHaveLength(2);
    for (const b of buttons) {
      // Native `disabled` would make the browser drop the click, so React
      // could not replay a tap made before the boundary hydrates.
      expect(b.disabled).toBe(false);
      expect(b.getAttribute('aria-disabled')).toBe('true');
      expect(b.getAttribute('aria-busy')).toBe('true');
      expect(b.hasAttribute('data-hydrating')).toBe(true);
      expect(b.className).toContain('cursor-progress');
      // Never the grey "unavailable" look: the store colour stays.
      expect(b.className).not.toContain('bg-gray-100');
      expect(b.getAttribute('style')).toContain('var(--store-primary');
      expect(b.hasAttribute('data-on-primary')).toBe(true);
      expect(b.querySelector('svg.animate-spin')).toBeTruthy();
      expect(b.textContent?.trim()).toBe('common.addToCart');
    }
  });

  it('a product that cannot be added keeps its disabled grey look (no spinner) before hydration', () => {
    const product = makeProduct({ variants: [{ id: 'v1', price: 100, stock: 0, options: { Size: 'S' } }] });
    const el = serverDom(
      <Page product={product}>
        <ProductBuyBlock {...props(product)} />
      </Page>,
    );
    const [b] = addButtons(el);
    expect(b.disabled).toBe(true);
    expect(b.className).toContain('bg-gray-100');
    expect(b.querySelector('svg.animate-spin')).toBeNull();
  });

  it('after hydration: enabled, not busy, and the click adds to the cart (no mismatch)', async () => {
    const product = makeProduct();
    const ui = (
      <Page product={product}>
        <ProductBuyBlock {...props(product, { sticky_on_mobile: true })} />
      </Page>
    );
    host = document.createElement('div');
    host.innerHTML = renderToString(ui);
    document.body.appendChild(host);
    expect(addButtons(host).every((b) => b.getAttribute('aria-disabled') === 'true')).toBe(true);

    const recoverable = vi.fn();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await act(async () => {
      root = hydrateRoot(host!, ui, { onRecoverableError: recoverable });
    });
    expect(recoverable).not.toHaveBeenCalled();
    expect(consoleError.mock.calls.filter((c) => String(c[0]).toLowerCase().includes('hydrat'))).toEqual([]);
    consoleError.mockRestore();

    const buttons = addButtons(host);
    expect(buttons).toHaveLength(2);
    for (const b of buttons) {
      expect(b.disabled).toBe(false);
      expect(b.hasAttribute('aria-disabled')).toBe(false);
      expect(b.hasAttribute('aria-busy')).toBe(false);
      expect(b.hasAttribute('data-hydrating')).toBe(false);
      expect(b.className).not.toContain('cursor-progress');
      expect(b.querySelector('svg.animate-spin')).toBeNull();
    }
    await act(async () => {
      fireEvent.click(buttons[0]);
    });
    expect(addItem).toHaveBeenCalledTimes(1);
  });

  it('a tap after the block chunk arrived but before its boundary hydrated is not lost', async () => {
    const product = makeProduct();
    // Server: the block renders inside a Suspense boundary. Client: the same
    // boundary holds a lazy component whose chunk has not arrived yet.
    let resolveChunk: (m: { default: typeof ProductBuyBlock }) => void = () => undefined;
    const LazyBuy = lazy(
      () => new Promise<{ default: typeof ProductBuyBlock }>((r) => { resolveChunk = r; }),
    );
    const blockProps = props(product);
    const serverUi = (
      <Page product={product}>
        <Suspense fallback={null}><ProductBuyBlock {...blockProps} /></Suspense>
      </Page>
    );
    const clientUi = (
      <Page product={product}>
        <Suspense fallback={null}><LazyBuy {...blockProps} /></Suspense>
      </Page>
    );
    host = document.createElement('div');
    host.innerHTML = renderToString(serverUi);
    document.body.appendChild(host);
    await act(async () => {
      root = hydrateRoot(host!, clientUi, { onRecoverableError: () => undefined });
    });
    const [b] = addButtons(host);
    expect(b.getAttribute('aria-disabled')).toBe('true');
    await act(async () => {
      // The chunk arrives, but React has not hydrated the boundary yet (its
      // retry is still queued). A tap now makes React hydrate it at once and
      // dispatch the click, as long as the browser fires the click at all,
      // which it does not for a natively disabled button.
      resolveChunk({ default: ProductBuyBlock });
      for (let i = 0; i < 5; i += 1) await Promise.resolve();
      expect(b.getAttribute('aria-disabled')).toBe('true');
      // jsdom dispatches clicks on disabled buttons too, so check what a
      // browser would do explicitly.
      expect(b.disabled).toBe(false);
      b.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });
    expect(addItem).toHaveBeenCalledTimes(1);
  });
});
