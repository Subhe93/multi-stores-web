import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import type { ProductData } from '@/components/product/ProductDetailClient';

// Quick add of the product card: the button (the only part a listing ships),
// the dialog it imports on the first click, and the rule that the dialog
// buys through the product page state (variants, stock) or sends the shopper
// to the product page when the product needs more than a variant.

const addItem = vi.fn((..._args: unknown[]) => Promise.resolve());
const getProduct = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/products',
  useParams: () => ({ storeSlug: 'demo' }),
}));
vi.mock('next/link', () => ({
  default: ({ children, href, prefetch: _p, ...rest }: { children: ReactNode; href: string; prefetch?: boolean }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock('next-intl', () => ({
  useLocale: () => 'en',
  useTranslations: (ns?: string) => (k: string, values?: Record<string, unknown>) => {
    const key = ns ? `${ns}.${k}` : k;
    return values ? `${key}:${JSON.stringify(values)}` : key;
  },
}));
vi.mock('@/hooks/useCart', () => ({ useCart: () => ({ addItem }) }));
vi.mock('@/hooks/useMarket', () => ({ useMarket: () => ({ key: 'se' }) }));
vi.mock('@/hooks/useProductCard', () => ({
  useProductCardSettings: () => ({ corners: 'square' }),
  useProductCardStoreSlug: () => 'demo',
}));
vi.mock('@/lib/api', async (orig) => {
  const mod = await orig<typeof import('@/lib/api')>();
  return { ...mod, storefront: { ...mod.storefront, getProduct: (...a: unknown[]) => getProduct(...a) } };
});
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

import { QuickAddButton } from './QuickAddButton.client';
import { needsProductPage } from './QuickAddDialog.client';

function makeProduct(overrides: Partial<ProductData> = {}): ProductData {
  return {
    id: 'p1',
    base_price: 100,
    translations: [{ locale: 'en', title: 'Wool coat', slug: 'wool-coat' }],
    images: [],
    variants: [
      { id: 'v-s', price: 100, stock: 3, options: { Size: 'S' }, is_active: true },
      { id: 'v-m', price: 100, stock: 0, options: { Size: 'M' }, is_active: true },
    ],
    ...overrides,
  };
}

function renderButton(card: Parameters<typeof QuickAddButton>[0]['card'] = null) {
  return render(
    <QuickAddButton productSlug="wool-coat" productId="p1" title="Wool coat" href="/products/wool-coat" card={card} currency="SEK" />,
  );
}

const opener = () => screen.getByRole('button', { name: /product\.quickAddFor/ });
const dialog = () => document.querySelector<HTMLElement>('[data-quick-add-dialog]');

async function open() {
  fireEvent.click(opener());
  await waitFor(() => expect(dialog()).not.toBeNull());
}

beforeEach(() => {
  addItem.mockClear();
  getProduct.mockReset();
  getProduct.mockResolvedValue(makeProduct());
});

describe('QuickAddButton', () => {
  it('is a dialog opener named after the product and ships no dialog before a click', () => {
    renderButton();
    const btn = opener();
    expect(btn).toHaveAttribute('aria-haspopup', 'dialog');
    expect(btn).toHaveAttribute('aria-expanded', 'false');
    expect(btn.getAttribute('aria-label')).toContain('Wool coat');
    expect(btn.closest('a')).toBeNull();
    expect(dialog()).toBeNull();
    expect(getProduct).not.toHaveBeenCalled();
  });

  it('renders nothing for a sold-out product', () => {
    const { container } = renderButton({ second_image: null, swatches: null, sizes: null, stock: { soldOut: true, count: null }, has_variants: true });
    expect(container).toBeEmptyDOMElement();
  });
});

describe('QuickAddDialog', () => {
  it('reads the product with the store slug, locale and market, and shows the page controls', async () => {
    renderButton();
    await open();
    expect(getProduct).toHaveBeenCalledWith('demo', 'wool-coat', 'en', { key: 'se' });
    const d = dialog()!;
    expect(d.tagName).toBe('DIALOG');
    expect(d).toHaveAttribute('data-corners', 'square');
    await waitFor(() => expect(d.querySelector('.qadd-buy button')).not.toBeNull());
    expect(d.querySelector('.qadd-options')).not.toBeNull();
    expect(d.querySelector('a.qadd-details')).toHaveAttribute('href', '/products/wool-coat');
  });

  it('asks for the option first, then adds the picked variant with its stock on the line', async () => {
    renderButton();
    await open();
    const d = dialog()!;
    await waitFor(() => expect(d.querySelector('.qadd-buy button')).not.toBeNull());
    const buy = d.querySelector<HTMLButtonElement>('.qadd-buy button')!;
    await waitFor(() => expect(buy).not.toBeDisabled());
    fireEvent.click(buy);
    expect(addItem).not.toHaveBeenCalled();
    expect(d.querySelector('.qadd-alert')).not.toBeNull();

    const pickS = Array.from(d.querySelectorAll<HTMLButtonElement>('.qadd-options button')).find((b) => b.textContent?.trim() === 'S')!;
    fireEvent.click(pickS);
    fireEvent.click(buy);
    await waitFor(() => expect(addItem).toHaveBeenCalledTimes(1));
    const call = addItem.mock.calls[0] as unknown[];
    expect(call[0]).toBe('p1');
    expect(call[1]).toBe('v-s');
    expect(call[2]).toBe(1);
    expect(JSON.stringify(call[4])).toContain('"stockOnHand":3');
    await waitFor(() => expect(d.querySelector('.qadd-added[data-on]')).not.toBeNull());
    expect(d.querySelector('.qadd-added a')).toHaveAttribute('href', '/cart');
  });

  it('shows only a link to the product page when the product needs more than a variant', async () => {
    getProduct.mockResolvedValue(makeProduct({ custom_fields: [{ id: 'f1', type: 'text', translations: [] }] }));
    renderButton();
    await open();
    const d = dialog()!;
    await waitFor(() => expect(d.querySelector('[data-quick-add-link-only]')).not.toBeNull());
    expect(d.querySelector('[data-quick-add-link-only]')).toHaveAttribute('href', '/products/wool-coat');
    expect(d.querySelector('.qadd-buy')).toBeNull();
    expect(d.querySelector('.qadd-options')).toBeNull();
  });

  it('closes on Escape and gives focus back to the button', async () => {
    renderButton();
    await open();
    const d = dialog()!;
    await waitFor(() => expect(d.querySelector('.qadd-close')).toHaveFocus());
    fireEvent.keyDown(d, { key: 'Escape' });
    await waitFor(() => expect(dialog()).toBeNull());
    expect(opener()).toHaveFocus();
    expect(opener()).toHaveAttribute('aria-expanded', 'false');
  });

  it('keeps Tab inside the dialog', async () => {
    renderButton();
    await open();
    const d = dialog()!;
    await waitFor(() => expect(d.querySelector('.qadd-buy button')).not.toBeNull());
    const items = d.querySelectorAll<HTMLElement>('a[href], button:not([disabled])');
    const last = items[items.length - 1];
    last.focus();
    fireEvent.keyDown(d, { key: 'Tab' });
    expect(items[0]).toHaveFocus();
    fireEvent.keyDown(d, { key: 'Tab', shiftKey: true });
    expect(last).toHaveFocus();
  });

  it('offers a retry when the product does not load', async () => {
    getProduct.mockRejectedValueOnce(new Error('down'));
    renderButton();
    await open();
    const d = dialog()!;
    const retry = await waitFor(() => {
      const b = d.querySelector<HTMLButtonElement>('.qadd-error button');
      expect(b).not.toBeNull();
      return b!;
    });
    fireEvent.click(retry);
    await waitFor(() => expect(d.querySelector('.qadd-buy button')).not.toBeNull());
    expect(getProduct).toHaveBeenCalledTimes(2);
  });
});

describe('needsProductPage', () => {
  it('is true for personalization, designer, custom fields, upload and bundles only', () => {
    expect(needsProductPage(makeProduct())).toBe(false);
    expect(needsProductPage(makeProduct({ personalization: { enabled: true, free_shipping_threshold: null } }))).toBe(true);
    expect(needsProductPage(makeProduct({ personalization: { enabled: false, free_shipping_threshold: null } }))).toBe(false);
    expect(needsProductPage(makeProduct({ designer: { template: 't' } }))).toBe(true);
    expect(needsProductPage(makeProduct({ allow_customer_upload: true }))).toBe(true);
    expect(needsProductPage(makeProduct({ bundles: [{ id: 'b', offers: [] }] } as unknown as Partial<ProductData>))).toBe(true);
  });
});
