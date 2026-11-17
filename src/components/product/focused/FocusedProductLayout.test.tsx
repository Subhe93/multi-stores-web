import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { CheckoutSettingsProvider } from '@/hooks/useCheckoutSettings';
import { normalizeCheckoutSettings } from '@/lib/checkoutSettings';
import { focusedProductLayoutSupports } from '@/lib/focusedStorefront';
import type { ProductData } from '@/components/product/ProductDetailClient';

// Focused storefront product page ("booking step"): a presentation of the
// shared product state. Covered here: the intro, the summary card, the form
// card (fields in a grid with real labels, variants, quantity only when more
// than one unit can be bought, the per-order limit message, sold out), the
// "More information" disclosure, and which products fall back.

const addItem = vi.fn(() => Promise.resolve());

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/products/testlektion',
  useParams: () => ({ storeSlug: 'demo' }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('next-intl', () => {
  const t = Object.assign(
    (k: string, values?: Record<string, unknown>) => (values ? `${k}:${JSON.stringify(values)}` : k),
    { rich: (k: string) => k, markup: (k: string) => k, raw: (k: string) => k, has: () => true },
  );
  return { useLocale: () => 'sv', useTranslations: () => t };
});
vi.mock('@/hooks/useCart', () => ({ useCart: () => ({ addItem }) }));
vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api')>()),
  resolveMediaUrl: (u: string) => u,
}));
vi.mock('@/lib/storeMedia', () => ({
  responsiveImgProps: (src: string) => ({ src }),
  isSvgSrc: (src: string) => src.endsWith('.svg'),
  optimizedImageUrl: (src: string) => src,
}));

import { ProductPageStateProvider } from '@/components/product/state/ProductPageState';
import { FocusedProductLayout } from './FocusedProductLayout';

const FOCUSED = normalizeCheckoutSettings({ external_site_url: 'https://mollstrands.example/', external_focus: true });

const field = (id: string, label: string, type = 'TEXT', required = true) => ({
  id,
  name: id,
  type,
  is_required: required,
  sort_order: 0,
  translations: [{ locale: 'sv', label }],
});

const base: ProductData = {
  id: 'p1',
  base_price: 499,
  max_per_order: 1,
  translations: [
    {
      locale: 'sv',
      title: 'Testlektion 60 min',
      slug: 'testlektion-60-min',
      short_description: '<p>Kort text</p>',
      description: '<h2>Lång text</h2>',
    },
  ],
  images: [{ id: 'i1', url: '/uploads/bil.webp', alt_text: 'Bil' }],
  variants: [],
  custom_fields: [field('f1', 'Förnamn'), field('f2', 'Efternamn'), field('f3', 'Meddelande', 'TEXTAREA', false)],
  primary_collection_path: [{ id: 'c1', slug: 'b-korkort', path: ['b-korkort'], translations: [{ locale: 'sv', name: 'B-körkort' }] }],
  faqs: [{ id: 'q1', sort_order: 0, translations: [{ locale: 'sv', question: 'Fråga?', answer: '<p>Svar</p>' }] }],
} as unknown as ProductData;

function renderLayout(product: ProductData, props: { sellerPhone?: string | null } = {}, wrap?: (node: ReactNode) => ReactNode) {
  const node = (
    <CheckoutSettingsProvider value={FOCUSED}>
      <ProductPageStateProvider product={product} locale="sv" primaryLocale="sv" currency="SEK">
        <FocusedProductLayout storeSlug="demo" {...props} />
      </ProductPageStateProvider>
    </CheckoutSettingsProvider>
  );
  return render(wrap ? wrap(node) : node);
}

// jsdom has no scrollIntoView (the state scrolls to the first field with an error).
Element.prototype.scrollIntoView = vi.fn();

afterEach(() => {
  cleanup();
  addItem.mockClear();
});

describe('FocusedProductLayout', () => {
  it('intro: collection as plain text, the title and the short description', () => {
    const { container } = renderLayout(base);
    const intro = container.querySelector('[data-focused-intro]') as HTMLElement;
    expect(intro).toHaveTextContent('B-körkort');
    expect(within(intro).getByRole('heading', { level: 1 })).toHaveTextContent('Testlektion 60 min');
    expect(intro).toHaveTextContent('Kort text');
    // No link into the (redirected) catalogue anywhere on the page.
    const hrefs = [...container.querySelectorAll('a[href]')].map((a) => a.getAttribute('href') ?? '');
    expect(hrefs.filter((h) => h === '/' || h.startsWith('/collections') || h === '/products')).toEqual([]);
  });

  it('summary card: main image, price with the tax note and the seller phone', () => {
    const { container } = renderLayout(base, { sellerPhone: '042-10 61 11' });
    const summary = container.querySelector('[data-focused-summary]') as HTMLElement;
    const imgs = summary.querySelectorAll('img');
    expect(imgs).toHaveLength(1);
    expect(imgs[0]).toHaveAttribute('src', '/uploads/bil.webp');
    expect(imgs[0]).toHaveAttribute('alt', 'Bil');
    expect(imgs[0]).toHaveClass('object-cover');
    expect(summary).toHaveTextContent('common.price');
    expect(summary.textContent).toMatch(/499/);
    const phone = within(summary).getByRole('link', { name: '042-10 61 11' });
    expect(phone).toHaveAttribute('href', 'tel:042106111');
    // No gallery thumbnails or zoom control.
    expect(summary.querySelector('button')).toBeNull();
  });

  it('summary card without an image or a phone: only the price', () => {
    const { container } = renderLayout({ ...base, images: [] } as ProductData);
    const summary = container.querySelector('[data-focused-summary]') as HTMLElement;
    expect(summary.querySelector('img')).toBeNull();
    expect(summary.querySelector('[data-focused-phone]')).toBeNull();
    expect(summary.textContent).toMatch(/499/);
  });

  it('form card: "Your details" heading (not the generic one), fields in a two-column grid with bound labels', () => {
    const { container } = renderLayout(base);
    const form = container.querySelector('[data-focused-form]') as HTMLElement;
    expect(within(form).getByRole('heading', { level: 2 })).toHaveTextContent('focused.stepDetails');
    expect(form).not.toHaveTextContent('product.customizeYourProduct');

    const grid = form.querySelector('[data-clarity-mask]') as HTMLElement;
    expect(grid).toHaveClass('grid', 'grid-cols-1', 'md:grid-cols-2');
    const cells = [...grid.children] as HTMLElement[];
    expect(cells).toHaveLength(3);
    // A long field takes both columns; the short ones share a row.
    expect(cells[0]).not.toHaveClass('md:col-span-2');
    expect(cells[1]).not.toHaveClass('md:col-span-2');
    expect(cells[2]).toHaveClass('md:col-span-2');

    const first = screen.getByLabelText(/Förnamn/);
    expect(first.tagName).toBe('INPUT');
    expect(first).toHaveAttribute('aria-required', 'true');
    expect(screen.getByLabelText(/Meddelande/).tagName).toBe('TEXTAREA');
    expect(screen.getByLabelText(/Meddelande/)).not.toHaveAttribute('aria-required');
  });

  it('primary button: full width, the existing add-to-cart label; the per-order limit message; no quantity picker for one unit', () => {
    const { container } = renderLayout(base);
    const buy = container.querySelector('[data-focused-buy]') as HTMLElement;
    const button = within(buy).getByRole('button');
    expect(button).toHaveTextContent('common.addToCart');
    expect(button).toHaveClass('w-full', 'rounded-full');
    expect(button).toHaveAttribute('data-on-primary');
    expect(buy.querySelector('[data-quantity-limit]')).toHaveTextContent('product.maxQuantityReached:{"max":1}');
    // max_per_order = 1: nothing to pick.
    expect(buy).not.toHaveTextContent('product.quantity');
    expect(within(buy).getAllByRole('button')).toHaveLength(1);
  });

  it('shows the quantity picker when more than one unit is allowed', () => {
    const { container } = renderLayout({ ...base, max_per_order: 3 } as ProductData);
    const buy = container.querySelector('[data-focused-buy]') as HTMLElement;
    expect(buy).toHaveTextContent('product.quantity');
    expect(within(buy).getAllByRole('button').length).toBeGreaterThan(1);
    expect(buy.querySelector('[data-quantity-limit]')).toBeNull();
  });

  it('a click with required fields missing shows the errors and adds nothing', () => {
    const { container } = renderLayout(base);
    const buy = container.querySelector('[data-focused-buy]') as HTMLElement;
    fireEvent.click(within(buy).getByRole('button'));
    expect(addItem).not.toHaveBeenCalled();
    expect(within(buy).getByRole('alert')).toBeInTheDocument();
    expect(screen.getByLabelText(/Förnamn/)).toHaveAttribute('aria-invalid', 'true');
  });

  it('sold out: the button is disabled and says so', () => {
    const { container } = renderLayout({ ...base, track_inventory: true, stock_quantity: 0 } as ProductData);
    const button = within(container.querySelector('[data-focused-buy]') as HTMLElement).getByRole('button');
    expect(button).toBeDisabled();
    expect(button).toHaveTextContent('product.outOfStock');
  });

  it('draft preview: the button is disabled', () => {
    const { container } = renderLayout({ ...base, status: 'DRAFT' } as ProductData);
    expect(within(container.querySelector('[data-focused-buy]') as HTMLElement).getByRole('button')).toBeDisabled();
  });

  it('variants: the option picker of the shared state is in the form card', () => {
    const product = {
      ...base,
      max_per_order: null,
      custom_fields: [],
      variants: [
        { id: 'v1', price: 499, stock: 5, options: { Växellåda: 'Manuell' } },
        { id: 'v2', price: 549, stock: 5, options: { Växellåda: 'Automat' } },
      ],
    } as unknown as ProductData;
    const { container } = renderLayout(product);
    const form = container.querySelector('[data-focused-form]') as HTMLElement;
    expect(form).toHaveTextContent('Manuell');
    expect(form).toHaveTextContent('Automat');
    // No fields: no "Your details" heading.
    expect(within(form).queryByRole('heading', { level: 2 })).toBeNull();
    // Options missing: the click points at them instead of adding.
    fireEvent.click(within(container.querySelector('[data-focused-buy]') as HTMLElement).getAllByRole('button').pop()!);
    expect(addItem).not.toHaveBeenCalled();
    expect(form.querySelector('[data-variant-hint]')).toHaveTextContent('product.selectOptions');
  });

  it('a product without fields or variants: just the button', () => {
    const { container } = renderLayout({ ...base, custom_fields: [] } as ProductData);
    const form = container.querySelector('[data-focused-form]') as HTMLElement;
    expect(form.querySelector('[data-clarity-mask]')).toBeNull();
    expect(within(form).queryByRole('heading')).toBeNull();
    expect(within(form).getByRole('button')).toHaveTextContent('common.addToCart');
  });

  it('long description and FAQ sit in a closed "More information" disclosure', () => {
    const { container } = renderLayout(base);
    const more = container.querySelector('[data-focused-more]') as HTMLDetailsElement;
    expect(more.tagName).toBe('DETAILS');
    expect(more.open).toBe(false);
    expect(more.querySelector('summary')).toHaveTextContent('focused.moreInformation');
    expect(more).toHaveTextContent('Lång text');
    expect(more).toHaveTextContent('Fråga?');
  });

  it('no disclosure when there is nothing more to read', () => {
    const product = { ...base, faqs: [], translations: [{ locale: 'sv', title: 'T', slug: 't' }] } as unknown as ProductData;
    expect(renderLayout(product).container.querySelector('[data-focused-more]')).toBeNull();
  });

  it('a very long title wraps instead of overflowing', () => {
    const title = 'Supercalifragilisticexpialidocious'.repeat(6);
    const product = { ...base, translations: [{ locale: 'sv', title, slug: 't' }] } as unknown as ProductData;
    renderLayout(product);
    expect(screen.getByRole('heading', { level: 1 })).toHaveClass('wrap-break-word');
  });

  it('RTL: logical classes only in the layout itself', () => {
    const { container } = renderLayout(base, { sellerPhone: '042-10 61 11' }, (node) => <div dir="rtl">{node}</div>);
    const own = [
      container.querySelector('[data-focused-intro]'),
      container.querySelector('[data-focused-summary]'),
      container.querySelector('[data-focused-more]'),
    ] as HTMLElement[];
    const classes = own.flatMap((root) => [root, ...root.querySelectorAll('[class]')]).flatMap((el) => (el.getAttribute('class') ?? '').split(/\s+/));
    const physical = classes.filter((c) => /^(?:[a-z-]+:)*-?(?:ml|mr|pl|pr|left|right|text-left|text-right|border-l|border-r|rounded-l|rounded-r)-/.test(c));
    expect(physical).toEqual([]);
    expect(container.querySelector('[data-focused-phone] a')).toHaveAttribute('dir', 'ltr');
  });
});

describe('focusedProductLayoutSupports', () => {
  it('presents regular products', () => {
    expect(focusedProductLayoutSupports({})).toBe(true);
    expect(focusedProductLayoutSupports({ designer: null })).toBe(true);
    expect(focusedProductLayoutSupports(base)).toBe(true);
  });

  it('falls back for designer products, custom products and a missing product', () => {
    expect(focusedProductLayoutSupports({ designer: { template_id: 't1' } })).toBe(false);
    expect(focusedProductLayoutSupports({ _type: 'custom_product' })).toBe(false);
    expect(focusedProductLayoutSupports(null)).toBe(false);
    expect(focusedProductLayoutSupports(undefined)).toBe(false);
  });
});

// Service / digital product ("Physical product" off): the add-to-cart
// metadata carries the no-shipping flag; every other product adds as before.
describe('FocusedProductLayout add metadata (requires_shipping)', () => {
  const simple = { ...base, custom_fields: [] } as unknown as ProductData;
  const clickAdd = (container: HTMLElement) =>
    fireEvent.click(within(container.querySelector('[data-focused-buy]') as HTMLElement).getAllByRole('button').pop()!);
  const lastMeta = () => (addItem.mock.calls.at(-1) as unknown as unknown[])[4] as Record<string, unknown>;

  it('requires_shipping false goes on the line', async () => {
    const { container } = renderLayout({ ...simple, requires_shipping: false } as ProductData);
    clickAdd(container);
    await waitFor(() => expect(addItem).toHaveBeenCalledTimes(1));
    expect(lastMeta().requiresShipping).toBe(false);
  });

  it('a product that ships (true, or no key from an older API) adds no key', async () => {
    for (const product of [simple, { ...simple, requires_shipping: true } as ProductData]) {
      const { container, unmount } = renderLayout(product);
      clickAdd(container);
      await waitFor(() => expect(addItem).toHaveBeenCalledTimes(1));
      expect('requiresShipping' in lastMeta()).toBe(false);
      unmount();
      addItem.mockClear();
    }
  });
});
