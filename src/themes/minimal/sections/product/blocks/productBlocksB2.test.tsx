import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import type { ProductData } from '@/components/product/ProductDetailClient';
import type { ProductContext, SectionRenderProps } from '../../../../types';

// B2 product blocks (product template layout, wave 2): every block reads the
// shared product page state, so they are rendered inside a real
// ProductPageStateProvider with a product fixture. The personalization app,
// its forms and the designer session are stubbed (they have their own tests).

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/en/products/mug',
  useParams: () => ({ storeSlug: 'demo' }),
}));
vi.mock('next-intl', () => ({
  useLocale: () => 'en',
  useTranslations: () => (k: string, vals?: Record<string, unknown>) => (vals ? `${k} ${JSON.stringify(vals)}` : k),
}));
vi.mock('@/hooks/useCart', () => ({ useCart: () => ({ addItem: vi.fn(() => Promise.resolve()) }) }));

const app = {
  advanced: null as unknown,
  legacyFields: [] as unknown[],
};
vi.mock('@/components/product/personalization/usePersonalizationApp', () => ({
  usePersonalizationApp: () => ({
    appOn: false,
    appSettings: { validation_summary: false },
    market: null,
    storeSlug: 'demo',
    fields: {
      fields: app.legacyFields,
      values: {},
      onChange: () => undefined,
      validateAll: () => ({ ok: true }),
      buildPayload: () => ({ fields: {}, display: [] }),
      applyServerError: () => null,
      errors: {},
      showAllErrors: false,
      fillable: undefined,
      onFill: undefined,
    },
    advanced: app.advanced,
    cardsConfig: undefined,
    priceDelta: 0,
    deltaInCart: false,
  }),
}));
let pieceKeys: string[] = [];
vi.mock('@/components/product/personalization/model', () => ({
  pieceOneRepeater: (defs: unknown) => (pieceKeys.length ? { id: 'rep', defs } : null),
  pieceOneOptionKeys: () => pieceKeys,
  visibleFieldsAt: () => ['f1'],
}));
vi.mock('@/components/product/personalization/PersonalizationForm', () => ({
  PersonalizationForm: ({ placement, pieceOne, anchor }: { placement: string; pieceOne?: ReactNode; anchor?: boolean }) => (
    <div data-testid={`pform-${placement}`} data-anchor={anchor ? '1' : '0'}>
      {pieceOne}
    </div>
  ),
}));
vi.mock('@/components/product/CustomFieldsForm', () => ({
  CustomFieldsForm: ({ fields }: { fields: unknown[] }) => <div data-testid="custom-fields">{fields.length}</div>,
}));
vi.mock('@/components/product/VariantSelector', () => ({
  VariantSelector: ({ optionFilter }: { optionFilter?: (k: string) => boolean }) => (
    <div data-testid="piece-one-variants">{['Color', 'Size'].filter((k) => !optionFilter || optionFilter(k)).join(',')}</div>
  ),
}));
let designerOn = false;
vi.mock('@/components/designer/DesignerSession', () => ({
  useDesignerSession: () => (designerOn ? { productId: 'p1', session: null } : null),
  useDesignerAddonsTotal: () => 0,
  DesignerFormSlot: ({ totalLabel, quantitySelector }: { totalLabel: string; quantitySelector?: ReactNode }) => (
    <div data-testid="designer-form">
      <span data-testid="designer-total">{totalLabel}</span>
      {quantitySelector}
    </div>
  ),
}));

import { ProductPageStateProvider, useProductPageState } from '@/components/product/state/ProductPageState';
import { ProductBreadcrumbBlock } from './ProductBreadcrumbBlock.client';
import { ProductShortDescriptionBlock } from './ProductShortDescriptionBlock.client';
import { ProductPromotionsBlock } from './ProductPromotionsBlock.client';
import { ProductBundlesBlock } from './ProductBundlesBlock.client';
import { ProductPersonalizationBlock } from './ProductPersonalizationBlock.client';
import { ProductTrustBlock } from './ProductTrustBlock.client';
import { ProductShippingBlock, shippingRowsForZone } from './ProductShippingBlock.client';
import { ProductTabsBlock, formatAttributeText } from './ProductTabsBlock.client';
import { ProductTabsMagic } from '../ProductTabsMagic.client';
import { productBlocksB2 } from './registryB2';

function makeProduct(overrides: Partial<ProductData> = {}): ProductData {
  return {
    id: 'p1',
    base_price: 100,
    translations: [
      { locale: 'en', title: 'Mug', slug: 'mug', description: '<p>Long text</p>', short_description: '<p><em>Short</em> text</p>' },
    ],
    images: [{ id: 'i1', url: 'https://cdn.test/a.jpg' }],
    variants: [],
    ...overrides,
  };
}

function props(overrides: Partial<SectionRenderProps> = {}): SectionRenderProps {
  return { settings: {}, content: {}, locale: 'en', primaryLocale: 'en', storeSlug: 'demo', ...overrides };
}

/** Props as the storefront product route passes them (product in context). */
function live(overrides: Partial<SectionRenderProps> = {}): SectionRenderProps {
  return props({ product: { id: 'p1' } as unknown as ProductContext, ...overrides });
}

function withState(product: ProductData, ui: ReactNode, locale = 'en') {
  return render(
    <ProductPageStateProvider product={product} locale={locale} primaryLocale="en" currency="EUR">
      {ui}
    </ProductPageStateProvider>,
  );
}

/** Shows the shared state's quantity and price so tests can see what other blocks would. */
function StateProbe() {
  const s = useProductPageState();
  return (
    <div data-testid="probe">
      {s.quantity}|{s.displayPrice}|{s.selectedBundleOfferId ?? '-'}
    </div>
  );
}

beforeEach(() => {
  app.advanced = null;
  app.legacyFields = [];
  pieceKeys = [];
  designerOn = false;
});

describe('registryB2', () => {
  it('registers every B2 block on the product template only, in the product category', () => {
    expect(Object.keys(productBlocksB2).sort()).toEqual(
      [
        'product-breadcrumb',
        'product-bundles',
        'product-personalization',
        'product-promotions',
        'product-shipping',
        'product-short-description',
        'product-tabs',
        'product-trust',
      ].sort(),
    );
    for (const [key, def] of Object.entries(productBlocksB2)) {
      expect(def.schema.id).toBe(key);
      expect(def.schema.pageTypes).toEqual(['PRODUCT_TEMPLATE']);
      expect(def.schema.category).toBe('product');
      expect(def.schema.label.en).toBeTruthy();
      expect(def.schema.label.ar).toBeTruthy();
      for (const t of def.schema.translatable) expect(def.schema.schema.some((f) => f.key === t)).toBe(true);
    }
  });

  it('product-tabs keeps every original setting name', () => {
    const keys = productBlocksB2['product-tabs'].schema.schema.map((f) => f.key);
    for (const k of [
      'show_description', 'show_faqs', 'show_shipping', 'show_returns',
      'tab_description_label', 'tab_faqs_label', 'tab_shipping_label', 'tab_returns_label',
      'shipping_html', 'returns_html',
    ]) {
      expect(keys).toContain(k);
    }
  });
});

describe('placeholders outside a provider', () => {
  const blocks = [
    ProductBreadcrumbBlock, ProductShortDescriptionBlock, ProductPromotionsBlock, ProductBundlesBlock,
    ProductPersonalizationBlock, ProductTrustBlock, ProductShippingBlock, ProductTabsBlock,
  ];
  it('render nothing on the storefront (product in context, no builder preview)', () => {
    for (const Block of blocks) {
      const { container, unmount } = render(<Block {...props({ product: {} as ProductContext })} />);
      expect(container.innerHTML).toBe('');
      unmount();
    }
  });
  it('render a dashed placeholder in the builder preview', () => {
    for (const Block of blocks) {
      const { container, unmount } = render(<Block {...props({ builderPreview: true, locale: 'ar' })} />);
      expect(container.querySelector('[data-product-block-placeholder]')).not.toBeNull();
      unmount();
    }
  });
  it('treat a missing product context as the builder (no sample product yet)', () => {
    for (const Block of blocks) {
      const { container, unmount } = render(<Block {...props()} />);
      expect(container.querySelector('[data-product-block-placeholder]')).not.toBeNull();
      unmount();
    }
  });
});

describe('product-breadcrumb', () => {
  it('links home, the primary collection chain and ends on the product title', () => {
    const product = makeProduct({
      primary_collection_path: [
        { id: 'c1', slug: 'kitchen', path: ['kitchen'], translations: [{ locale: 'en', name: 'Kitchen' }] },
        { id: 'c2', slug: 'mugs', path: ['kitchen', 'mugs'], translations: [{ locale: 'en', name: 'Mugs' }] },
      ],
    });
    withState(product, <ProductBreadcrumbBlock {...live()} />);
    const nav = screen.getByRole('navigation', { name: 'Breadcrumb' });
    const links = Array.from(nav.querySelectorAll('a')).map((a) => [a.textContent, a.getAttribute('href')]);
    expect(links[0]).toEqual(['common.home', '/']);
    expect(links[1][0]).toBe('Kitchen');
    expect(links[2][0]).toBe('Mugs');
    expect(links[2][1]).toContain('mugs');
    expect(nav.textContent).toContain('Mug');
  });

  it('falls back to Products, prefixes secondary locales and can hide the current crumb', () => {
    const product = makeProduct({ translations: [{ locale: 'ar', title: 'كوب', slug: 'kob' }] });
    withState(product, <ProductBreadcrumbBlock {...live({ settings: { show_current: false }, locale: 'ar' })} />, 'ar');
    const nav = screen.getByRole('navigation');
    const hrefs = Array.from(nav.querySelectorAll('a')).map((a) => a.getAttribute('href'));
    // next/link drops the trailing slash of `/ar/`.
    expect(hrefs).toEqual(['/ar', '/ar/products']);
    expect(nav.textContent).not.toContain('كوب');
  });
});

describe('product-short-description', () => {
  it('renders the short description HTML', () => {
    const { container } = withState(makeProduct(), <ProductShortDescriptionBlock {...live()} />);
    expect(container.querySelector('em')?.textContent).toBe('Short');
  });
  it('adds the monolith divider (20px apart) only when show_divider is true', () => {
    const { container, unmount } = withState(
      makeProduct(),
      <ProductShortDescriptionBlock {...live({ settings: { show_divider: true } })} />,
    );
    const divider = container.querySelector('[data-short-description-divider]');
    expect(divider?.className).toBe('border-t border-gray-100');
    expect(divider?.parentElement?.className).toBe('flex flex-col gap-5');
    unmount();
    // Saved sections have no key: unchanged markup (no divider, no gap wrapper class).
    for (const settings of [{}, { show_divider: false }]) {
      const off = withState(makeProduct(), <ProductShortDescriptionBlock {...live({ settings })} />);
      expect(off.container.querySelector('[data-short-description-divider]')).toBeNull();
      expect(off.container.querySelector('.gap-5')).toBeNull();
      expect(off.container.querySelector('em')?.textContent).toBe('Short');
      off.unmount();
    }
  });
  it('renders nothing without one (placeholder in the builder)', () => {
    const product = makeProduct({ translations: [{ locale: 'en', title: 'Mug', slug: 'mug' }] });
    const { container } = withState(product, <ProductShortDescriptionBlock {...live()} />);
    expect(container.innerHTML).toBe('');
  });
});

describe('product-promotions', () => {
  const product = makeProduct({
    promotions: [
      { id: 'pr1', type: 'FLASH_SALE', value: 20, expires_at: '2026-12-01T00:00:00Z', translations: [{ locale: 'en', title: 'Flash!' }] },
      { id: 'pr2', type: 'FREE_SHIPPING', value: 0, translations: [] },
      { id: 'pr3', type: 'PERCENTAGE', value: 15, translations: [{ locale: 'en', title: '', description: '<b>Only today</b>' }] },
    ],
  });
  it('renders one card per promotion with its title or a typed label', () => {
    const { container } = withState(product, <ProductPromotionsBlock {...live()} />);
    const cards = container.querySelectorAll('[data-promotion-type]');
    expect(cards).toHaveLength(3);
    expect(cards[0].textContent).toContain('Flash!');
    expect(cards[0].textContent).toContain('product.endsOn');
    expect(cards[1].textContent).toContain('checkout.freeShippingLabel');
    expect(cards[2].textContent).toContain('product.percentOff {"percent":15}');
    expect(cards[2].querySelector('b')?.textContent).toBe('Only today');
  });
  it('can hide the end date', () => {
    const { container } = withState(product, <ProductPromotionsBlock {...live({ settings: { show_end_date: false } })} />);
    expect(container.textContent).not.toContain('product.endsOn');
  });
});

describe('product-bundles', () => {
  const product = makeProduct({
    bundles: [
      {
        id: 'b1',
        status: 'ACTIVE',
        translations: [{ locale: 'en', name: 'Bundle' }],
        offers: [
          { id: 'o3', quantity: 3, discount_type: 'PERCENTAGE', discount_value: 10, sort_order: 1, translations: [{ locale: 'en', title: 'Buy 3', sticker_text: 'Popular' }] },
          { id: 'o2', quantity: 2, discount_type: 'FIXED', discount_value: 10, sort_order: 0, translations: [] },
        ],
      },
    ],
  });
  it('lists offers in sort order and picking one forces the shared quantity and price', () => {
    withState(product, (
      <>
        <ProductBundlesBlock {...live()} />
        <StateProbe />
      </>
    ));
    const buttons = screen.getAllByRole('button');
    expect(buttons[0].textContent).toContain('product.buyQuantity {"count":2}');
    expect(buttons[1].textContent).toContain('Buy 3');
    expect(buttons[1].textContent).toContain('Popular');
    expect(screen.getByTestId('probe').textContent).toBe('1|100|-');
    act(() => fireEvent.click(buttons[1]));
    expect(buttons[1].getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByTestId('probe').textContent).toBe('3|270|o3');
    // A second click clears the offer.
    act(() => fireEvent.click(buttons[1]));
    expect(screen.getByTestId('probe').textContent).toContain('|-');
  });
});

describe('product-personalization', () => {
  it('legacy custom fields render under the heading, with the customer upload', () => {
    app.legacyFields = [{ id: 'f1' }, { id: 'f2' }];
    withState(makeProduct({ allow_customer_upload: true }), <ProductPersonalizationBlock {...live()} />);
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('product.customizeYourProduct');
    expect(screen.getByTestId('custom-fields').textContent).toBe('2');
    expect(screen.getByText('product.fileUploads')).toBeInTheDocument();
  });

  it('the heading can be hidden', () => {
    app.legacyFields = [{ id: 'f1' }];
    withState(makeProduct(), <ProductPersonalizationBlock {...live({ settings: { show_heading: false } })} />);
    expect(screen.queryByRole('heading')).toBeNull();
    expect(screen.getByTestId('custom-fields')).toBeInTheDocument();
  });

  it('the personalization app renders both placements and the piece-1 colour picker', () => {
    app.advanced = { defs: [], result: { visibleIds: [] }, ctx: {} };
    pieceKeys = ['Color'];
    withState(makeProduct(), <ProductPersonalizationBlock {...live()} />);
    expect(screen.getByTestId('pform-before_variants').getAttribute('data-anchor')).toBe('1');
    expect(screen.getByTestId('pform-after_variants')).toBeInTheDocument();
    // Only the piece-1 option renders inside the piece-1 box.
    expect(screen.getByTestId('piece-one-variants').textContent).toBe('Color');
    expect(screen.queryByTestId('custom-fields')).toBeNull();
  });

  it("placement 'before_variants' shows only the app's before-variants fields", () => {
    app.advanced = { defs: [], result: { visibleIds: [] }, ctx: {} };
    app.legacyFields = [{ id: 'f1' }];
    pieceKeys = ['Color'];
    withState(
      makeProduct({ allow_customer_upload: true }),
      <ProductPersonalizationBlock {...live({ settings: { placement: 'before_variants' } })} />,
    );
    expect(screen.getByTestId('pform-before_variants').getAttribute('data-anchor')).toBe('1');
    expect(screen.queryByTestId('pform-after_variants')).toBeNull();
    expect(screen.queryByTestId('piece-one-variants')).toBeNull();
    expect(screen.queryByRole('heading')).toBeNull();
    expect(screen.queryByText('product.fileUploads')).toBeNull();
  });

  it("placement 'after_variants' leaves the before-variants fields out", () => {
    app.advanced = { defs: [], result: { visibleIds: [] }, ctx: {} };
    pieceKeys = ['Color'];
    withState(makeProduct({ allow_customer_upload: true }), <ProductPersonalizationBlock {...live({ settings: { placement: 'after_variants' } })} />);
    expect(screen.queryByTestId('pform-before_variants')).toBeNull();
    expect(screen.getByTestId('pform-after_variants')).toBeInTheDocument();
    expect(screen.getByTestId('piece-one-variants').textContent).toBe('Color');
    expect(screen.getByText('product.fileUploads')).toBeInTheDocument();
  });

  it("placement 'before_variants' renders nothing without the personalization app or with the designer", () => {
    app.legacyFields = [{ id: 'f1' }];
    const { container } = withState(makeProduct(), <ProductPersonalizationBlock {...live({ settings: { placement: 'before_variants' } })} />);
    expect(container.innerHTML).toBe('');
    cleanup();
    designerOn = true;
    app.advanced = { defs: [], result: { visibleIds: [] }, ctx: {} };
    const second = withState(makeProduct(), <ProductPersonalizationBlock {...live({ settings: { placement: 'before_variants' } })} />);
    expect(second.container.innerHTML).toBe('');
  });

  it('the designer form replaces the forms and shows the line total', () => {
    designerOn = true;
    app.legacyFields = [{ id: 'f1' }];
    withState(makeProduct({ allow_customer_upload: true }), <ProductPersonalizationBlock {...live()} />);
    expect(screen.getByTestId('designer-form')).toBeInTheDocument();
    expect(screen.getByTestId('designer-total').textContent).toMatch(/100/);
    expect(screen.queryByTestId('custom-fields')).toBeNull();
    expect(screen.queryByText('product.fileUploads')).toBeNull();
  });

  it('renders nothing for a product without personalization', () => {
    const { container } = withState(makeProduct(), <ProductPersonalizationBlock {...live()} />);
    expect(container.innerHTML).toBe('');
  });
});

describe('product-trust', () => {
  it('renders only the owner badges with labels', () => {
    const { container } = render(
      <ProductTrustBlock {...live({
          content: { trust_badges: [{ icon: 'truck', label: 'Fast delivery', description: '1-2 days' }, { icon: 'shield' }] },
        })}
      />,
    );
    expect(container.textContent).toContain('Fast delivery');
    expect(container.textContent).toContain('1-2 days');
    expect(container.querySelectorAll('.grid > div')).toHaveLength(1);
    expect(container.querySelector('.grid')?.className).toContain('grid-cols-2');
  });
  it('honours the one-column option', () => {
    const { container } = render(
      <ProductTrustBlock {...live({ settings: { columns: '1' }, content: { trust_badges: [{ label: 'Returns' }] } })} />,
    );
    expect(container.querySelector('.grid')?.className).toContain('grid-cols-1');
  });
});

describe('product-shipping', () => {
  const product = makeProduct({
    shipping_profile: {
      name: 'Default',
      zones: [
        {
          id: 'z1', name: 'Sweden', countries: ['SE'], base_cost: 49, per_item_cost: 0,
          estimated_days_min: 1, estimated_days_max: 3,
          methods: [
            { id: 'm1', name: 'Postnord', translations: { en: 'PostNord home' }, type: 'DELIVERY', base_cost: 59, free_threshold: 500, estimated_days_min: 1, estimated_days_max: 2 },
            { id: 'm2', name: 'Pickup', type: 'PICKUP', base_cost: 0, estimated_days_min: 0, estimated_days_max: 0 },
          ],
        },
        { id: 'z2', name: 'EU', countries: ['DE', 'FR', 'NL', 'BE'], base_cost: 99, per_item_cost: 0, estimated_days_min: 3, estimated_days_max: 7 },
      ],
    },
  });
  it('renders one row per method, the legacy zone row and the heading', () => {
    const { container } = withState(product, <ProductShippingBlock {...live()} />);
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('product.shippingAndDelivery');
    const rows = container.querySelectorAll('[data-shipping-row]');
    expect(rows).toHaveLength(3);
    expect(rows[0].textContent).toContain('PostNord home');
    expect(rows[0].textContent).toContain('product.freeShippingOver');
    expect(rows[1].textContent).toContain('product.pickup');
    expect(rows[1].textContent).toContain('product.freeShipping');
    expect(rows[2].textContent).toContain('DE, FR, NL +1');
  });
  it('can hide the heading; zone rows fall back to the legacy cost', () => {
    withState(product, <ProductShippingBlock {...live({ settings: { show_heading: false } })} />);
    expect(screen.queryByRole('heading')).toBeNull();
    const zone = product.shipping_profile!.zones[1];
    expect(shippingRowsForZone(zone, 'en')).toEqual([
      { key: 'z2', title: 'EU', pickup: false, cost: 99, freeOver: null, daysMin: 3, daysMax: 7 },
    ]);
  });
});

describe('product-tabs', () => {
  const product = makeProduct({
    attributes: [
      { id: 'a1', value: '#ff0000', template: { name: 'color', type: 'COLOR', translations: [{ locale: 'en', label: 'Colour' }] } },
      { id: 'a2', value: true, template: { name: 'dishwasher', type: 'BOOLEAN', translations: [{ locale: 'en', label: 'Dishwasher safe' }] } },
      { id: 'a3', value: { w: 10, h: 12 }, template: { name: 'size', type: 'DIMENSIONS', unit: 'cm', translations: [] } },
      { id: 'a4', value: ['Gift', 'Kitchen'], template: { name: 'tags', type: 'MULTI_SELECT', translations: [] } },
      { id: 'a5', value: 350, template: { name: 'volume', type: 'NUMBER', unit: 'ml', translations: [] } },
    ],
    faqs: [{ id: 'q1', sort_order: 0, translations: [{ locale: 'en', question: 'Microwave?', answer: '<p><strong>Yes</strong>, it is.</p>' }] }],
  });

  it('shows description, specifications and FAQ tabs; specs render by type', () => {
    const { container } = withState(product, <ProductTabsBlock {...live()} />);
    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((t) => t.textContent)).toEqual(['product.description', 'product.specifications', 'product.faq(1)']);
    expect(container.textContent).toContain('Long text');
    act(() => fireEvent.click(tabs[1]));
    const cells = Array.from(container.querySelectorAll('tbody tr')).map((tr) => tr.textContent);
    expect(cells).toEqual(['Colour#ff0000', 'Dishwasher safecommon.yes', 'size10cm × 12cm', 'tagsGift, Kitchen', 'volume350 ml']);
  });

  it('FAQ answers render as HTML', () => {
    const { container } = withState(product, <ProductTabsBlock {...live()} />);
    act(() => fireEvent.click(screen.getAllByRole('tab')[2]));
    expect(container.querySelector('details strong')?.textContent).toBe('Yes');
  });

  it('old settings and labels still apply; shipping / returns content tabs', () => {
    withState(
      product,
      <ProductTabsMagic {...live({
          settings: { show_description: false, show_faqs: false, show_shipping: true, show_returns: true },
          content: { tab_shipping_label: 'Delivery', shipping_html: '<p>Ships in 2 days</p>', returns_html: '' },
        })}
      />,
    );
    const tabs = screen.getAllByRole('tab');
    // Returns has no content, so it is left out.
    expect(tabs.map((t) => t.textContent)).toEqual(['product.specifications', 'Delivery']);
    act(() => fireEvent.click(tabs[1]));
    expect(screen.getByText('Ships in 2 days')).toBeInTheDocument();
  });

  it('formats attribute text values', () => {
    expect(formatAttributeText({ id: 'x', value: 'Steel', template: { name: 'm', translations: [] } })).toBe('Steel');
    expect(formatAttributeText({ id: 'x', value: 2, template: { name: 'w', unit: 'kg', translations: [] } })).toBe('2 kg');
  });

  it('renders nothing without any tab data', () => {
    const bare = makeProduct({ translations: [{ locale: 'en', title: 'Mug', slug: 'mug' }] });
    const { container } = withState(bare, <ProductTabsBlock {...live()} />);
    expect(container.innerHTML).toBe('');
  });
});
