import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import type { ProductData } from '@/components/product/ProductDetailClient';
import type { ProductContext, SectionRenderProps } from '../../../../types';

// B3 product blocks: the standalone pieces of `product-tabs`. Rendered inside
// a real ProductPageStateProvider (same harness as productBlocksB2.test.tsx);
// the personalization app is stubbed off.

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
vi.mock('@/components/product/personalization/usePersonalizationApp', () => ({
  usePersonalizationApp: () => ({
    appOn: false,
    appSettings: { validation_summary: false },
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
      fillable: undefined,
      onFill: undefined,
    },
    advanced: null,
    cardsConfig: undefined,
    priceDelta: 0,
    deltaInCart: false,
  }),
}));
vi.mock('@/components/designer/DesignerSession', () => ({
  useDesignerSession: () => null,
  useDesignerAddonsTotal: () => 0,
  DesignerFormSlot: () => null,
}));

import { ProductPageStateProvider } from '@/components/product/state/ProductPageState';
import { ProductDescriptionBlock } from './ProductDescriptionBlock.client';
import { ProductSpecificationsBlock, specificationsStyle } from './ProductSpecificationsBlock.client';
import { faqQuestionTag, ProductFaqBlock, toggleOpen } from './ProductFaqBlock.client';
import { ProductShippingReturnsBlock } from './ProductShippingReturnsBlock.client';
import { ProductTabsBlock } from './ProductTabsBlock.client';
import { productBlocksB3 } from './registryB3';
import { minimalTheme } from '../../../theme';

function makeProduct(overrides: Partial<ProductData> = {}): ProductData {
  return {
    id: 'p1',
    base_price: 100,
    translations: [
      { locale: 'en', title: 'Mug', slug: 'mug', description: '<p>Long <strong>text</strong></p>' },
      { locale: 'ar', title: 'كوب', slug: 'mug', description: '<p>نص طويل</p>' },
    ],
    images: [{ id: 'i1', url: 'https://cdn.test/a.jpg' }],
    variants: [],
    attributes: [
      { id: 'a1', value: '#ff0000', template: { name: 'color', type: 'COLOR', translations: [{ locale: 'en', label: 'Colour' }] } },
      { id: 'a2', value: true, template: { name: 'dishwasher', type: 'BOOLEAN', translations: [{ locale: 'en', label: 'Dishwasher safe' }] } },
      { id: 'a3', value: 350, template: { name: 'volume', type: 'NUMBER', unit: 'ml', translations: [] } },
    ],
    faqs: [
      { id: 'q1', sort_order: 0, translations: [{ locale: 'en', question: 'Microwave?', answer: '<p><strong>Yes</strong>, it is.</p>' }] },
      { id: 'q2', sort_order: 1, translations: [{ locale: 'en', question: 'Gift wrap?', answer: '<p>On request.</p>' }] },
      { id: 'q3', sort_order: 2, translations: [{ locale: 'en', question: 'Dishwasher?', answer: '<p>Top rack.</p>' }] },
    ],
    ...overrides,
  };
}

const bare = () =>
  makeProduct({ translations: [{ locale: 'en', title: 'Mug', slug: 'mug' }], attributes: [], faqs: [] });

function props(overrides: Partial<SectionRenderProps> = {}): SectionRenderProps {
  return { settings: {}, content: {}, locale: 'en', primaryLocale: 'en', storeSlug: 'demo', ...overrides };
}

/** Props as the storefront product route passes them (product in context). */
function live(overrides: Partial<SectionRenderProps> = {}): SectionRenderProps {
  return props({ product: { id: 'p1' } as unknown as ProductContext, builderPreview: false, ...overrides });
}

function withState(product: ProductData, ui: ReactNode, locale = 'en') {
  return render(
    <ProductPageStateProvider product={product} locale={locale} primaryLocale="en" currency="EUR">
      {ui}
    </ProductPageStateProvider>,
  );
}

describe('registryB3', () => {
  it('registers the four blocks on the product template only, in the product category', () => {
    expect(Object.keys(productBlocksB3).sort()).toEqual([
      'product-description',
      'product-faq',
      'product-shipping-returns',
      'product-specifications',
    ]);
    for (const [key, def] of Object.entries(productBlocksB3)) {
      expect(def.schema.id).toBe(key);
      expect(def.schema.category).toBe('product');
      expect(def.schema.pageTypes).toEqual(['PRODUCT_TEMPLATE']);
      expect(def.schema.label.en && def.schema.label.ar).toBeTruthy();
      expect(minimalTheme.sections[key]).toBe(def);
    }
  });

  it('keeps product-tabs registered', () => {
    expect(minimalTheme.sections['product-tabs']?.Component).toBeTruthy();
  });
});

describe('product-description', () => {
  it('renders the description HTML with the default heading', () => {
    const { container } = withState(makeProduct(), <ProductDescriptionBlock {...live()} />);
    expect(container.querySelector('h2')?.textContent).toBe('product.description');
    expect(container.querySelector('.prose strong')?.textContent).toBe('text');
  });

  it('matches the description panel of product-tabs', () => {
    const block = withState(makeProduct(), <ProductDescriptionBlock {...live()} />);
    const blockProse = block.container.querySelector('.prose')?.outerHTML;
    block.unmount();
    const tabs = withState(makeProduct(), <ProductTabsBlock {...live()} />);
    expect(tabs.container.querySelector('[role="tabpanel"] .prose')?.outerHTML).toBe(blockProse);
  });

  it('honours heading text, heading tag and show_heading', () => {
    const custom = withState(
      makeProduct(),
      <ProductDescriptionBlock {...live({ settings: { heading_level: 'h3' }, content: { heading: 'Om produkten' } })} />,
    );
    expect(custom.container.querySelector('h3')?.textContent).toBe('Om produkten');
    custom.unmount();
    const hidden = withState(makeProduct(), <ProductDescriptionBlock {...live({ settings: { show_heading: false } })} />);
    expect(hidden.container.querySelector('[data-product-block-heading]')).toBeNull();
  });

  it('uses the page locale translation', () => {
    const { container } = withState(makeProduct(), <ProductDescriptionBlock {...live({ locale: 'ar' })} />, 'ar');
    expect(container.textContent).toContain('نص طويل');
  });

  it('renders nothing live without a description; placeholder in the builder', () => {
    const empty = withState(bare(), <ProductDescriptionBlock {...live()} />);
    expect(empty.container.innerHTML).toBe('');
    empty.unmount();
    const builder = withState(bare(), <ProductDescriptionBlock {...live({ builderPreview: true })} />);
    expect(builder.container.querySelector('[data-product-block-placeholder]')?.textContent).toContain('This product has no description.');
  });

  it('shows the placeholder in the builder before a product loads', () => {
    const { container } = render(<ProductDescriptionBlock {...props({ locale: 'ar' })} />);
    expect(container.querySelector('[data-product-block-placeholder]')?.textContent).toContain('وصف المنتج');
  });
});

describe('product-specifications', () => {
  const rows = (c: HTMLElement) => Array.from(c.querySelectorAll('tbody tr')).map((tr) => tr.textContent);

  it('renders the same table as the specifications panel of product-tabs (striped default)', () => {
    const block = withState(makeProduct(), <ProductSpecificationsBlock {...live()} />);
    expect(block.container.querySelector('h2')?.textContent).toBe('product.specifications');
    expect(rows(block.container)).toEqual(['Colour#ff0000', 'Dishwasher safecommon.yes', 'volume350 ml']);
    const blockTable = block.container.querySelector('table')?.outerHTML;
    block.unmount();
    const tabs = withState(makeProduct(), <ProductTabsBlock {...live()} />);
    act(() => fireEvent.click(screen.getAllByRole('tab')[1]));
    expect(tabs.container.querySelector('table')?.outerHTML).toBe(blockTable);
  });

  it('plain table drops the zebra rows; list uses a definition list', () => {
    const plain = withState(makeProduct(), <ProductSpecificationsBlock {...live({ settings: { style: 'table' } })} />);
    expect(plain.container.querySelectorAll('tr.bg-gray-50')).toHaveLength(0);
    plain.unmount();
    const list = withState(makeProduct(), <ProductSpecificationsBlock {...live({ settings: { style: 'list' } })} />);
    expect(Array.from(list.container.querySelectorAll('dt')).map((d) => d.textContent)).toEqual(['Colour', 'Dishwasher safe', 'volume']);
    expect(list.container.querySelector('table')).toBeNull();
  });

  it('falls back to striped for unknown styles', () => {
    expect(specificationsStyle(undefined)).toBe('striped');
    expect(specificationsStyle('weird')).toBe('striped');
    expect(specificationsStyle('list')).toBe('list');
  });

  it('renders nothing live without attributes; placeholder in the builder', () => {
    expect(withState(bare(), <ProductSpecificationsBlock {...live()} />).container.innerHTML).toBe('');
    const builder = withState(bare(), <ProductSpecificationsBlock {...live({ builderPreview: true })} />);
    expect(builder.container.querySelector('[data-product-block-placeholder]')).not.toBeNull();
  });
});

describe('product-faq', () => {
  const triggers = () => screen.getAllByRole('button');

  it('renders an accessible accordion, all closed by default', () => {
    const { container } = withState(makeProduct(), <ProductFaqBlock {...live()} />);
    expect(container.querySelector('h2')?.textContent).toBe('product.faq');
    const buttons = triggers();
    expect(buttons.map((b) => b.textContent)).toEqual(['Microwave?', 'Gift wrap?', 'Dishwasher?']);
    for (const b of buttons) {
      expect(b.getAttribute('aria-expanded')).toBe('false');
      const panel = document.getElementById(b.getAttribute('aria-controls')!);
      expect(panel?.getAttribute('role')).toBe('region');
      expect(panel?.getAttribute('aria-labelledby')).toBe(b.id);
      expect(panel?.hidden).toBe(true);
    }
  });

  it('opens and closes on click; answers render as HTML', () => {
    withState(makeProduct(), <ProductFaqBlock {...live()} />);
    const first = triggers()[0];
    act(() => fireEvent.click(first));
    expect(first.getAttribute('aria-expanded')).toBe('true');
    const panel = document.getElementById(first.getAttribute('aria-controls')!)!;
    expect(panel.hidden).toBe(false);
    expect(panel.querySelector('strong')?.textContent).toBe('Yes');
    act(() => fireEvent.click(first));
    expect(first.getAttribute('aria-expanded')).toBe('false');
  });

  it('open_first opens the first question', () => {
    withState(makeProduct(), <ProductFaqBlock {...live({ settings: { open_first: true } })} />);
    expect(triggers().map((b) => b.getAttribute('aria-expanded'))).toEqual(['true', 'false', 'false']);
  });

  it('allows several open by default; allow_multiple false keeps one open', () => {
    const multi = withState(makeProduct(), <ProductFaqBlock {...live()} />);
    act(() => fireEvent.click(triggers()[0]));
    act(() => fireEvent.click(triggers()[1]));
    expect(triggers().map((b) => b.getAttribute('aria-expanded'))).toEqual(['true', 'true', 'false']);
    multi.unmount();
    withState(makeProduct(), <ProductFaqBlock {...live({ settings: { allow_multiple: false } })} />);
    act(() => fireEvent.click(triggers()[0]));
    act(() => fireEvent.click(triggers()[1]));
    expect(triggers().map((b) => b.getAttribute('aria-expanded'))).toEqual(['false', 'true', 'false']);
  });

  it('re-syncs open panels when open_first / allow_multiple change without a remount', () => {
    const product = makeProduct();
    const view = withState(product, <ProductFaqBlock {...live()} />);
    const rerender = (settings: Record<string, unknown>) =>
      view.rerender(
        <ProductPageStateProvider product={product} locale="en" primaryLocale="en" currency="EUR">
          <ProductFaqBlock {...live({ settings })} />
        </ProductPageStateProvider>,
      );
    const expanded = () => triggers().map((b) => b.getAttribute('aria-expanded'));
    expect(expanded()).toEqual(['false', 'false', 'false']);
    rerender({ open_first: true });
    expect(expanded()).toEqual(['true', 'false', 'false']);
    act(() => fireEvent.click(triggers()[2]));
    expect(expanded()).toEqual(['true', 'false', 'true']);
    rerender({ open_first: true, allow_multiple: false });
    expect(expanded()).toEqual(['false', 'false', 'true']);
    rerender({ open_first: false, allow_multiple: false });
    expect(expanded()).toEqual(['false', 'false', 'false']);
  });

  it('question tag sits one level below the block heading', () => {
    expect(faqQuestionTag(true, undefined)).toBe('h3');
    expect(faqQuestionTag(true, 'h2')).toBe('h3');
    expect(faqQuestionTag(true, 'h3')).toBe('h4');
    expect(faqQuestionTag(true, 'h6')).toBe('h6');
    expect(faqQuestionTag(true, 'p')).toBe('h3');
    expect(faqQuestionTag(false, 'h4')).toBe('h3');
    const { container } = withState(makeProduct(), <ProductFaqBlock {...live({ settings: { heading_level: 'h3' } })} />);
    expect(container.querySelector('[data-product-block-heading]')?.tagName).toBe('H3');
    expect(Array.from(container.querySelectorAll('h4 > button')).map((b) => b.textContent)).toEqual([
      'Microwave?',
      'Gift wrap?',
      'Dishwasher?',
    ]);
  });

  it('default questions stay h3 under the h2 heading', () => {
    const { container } = withState(makeProduct(), <ProductFaqBlock {...live()} />);
    expect(container.querySelectorAll('h3 > button')).toHaveLength(3);
  });

  it('skips FAQs without a question in the shown locale (same rule as the FAQPage JSON-LD)', () => {
    const product = makeProduct({
      faqs: [
        { id: 'q1', sort_order: 0, translations: [{ locale: 'en', question: 'Microwave?', answer: '<p>Yes</p>' }] },
        { id: 'q2', sort_order: 1, translations: [{ locale: 'en', question: '   ', answer: '<p>Orphan</p>' }] },
      ],
    });
    withState(product, <ProductFaqBlock {...live()} />);
    expect(triggers().map((b) => b.textContent)).toEqual(['Microwave?']);
  });

  it('arrow keys, Home and End move focus between questions', () => {
    withState(makeProduct(), <ProductFaqBlock {...live()} />);
    const [a, b, c] = triggers();
    a.focus();
    fireEvent.keyDown(a, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(b);
    fireEvent.keyDown(b, { key: 'End' });
    expect(document.activeElement).toBe(c);
    fireEvent.keyDown(c, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(a);
    fireEvent.keyDown(a, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(c);
    fireEvent.keyDown(c, { key: 'Home' });
    expect(document.activeElement).toBe(a);
  });

  it('toggleOpen rules', () => {
    expect(toggleOpen([], 1, true)).toEqual([1]);
    expect(toggleOpen([0], 1, true)).toEqual([0, 1]);
    expect(toggleOpen([0], 1, false)).toEqual([1]);
    expect(toggleOpen([0, 1], 0, true)).toEqual([1]);
  });

  it('is RTL-safe: logical alignment, no physical left/right classes', () => {
    const { container } = withState(makeProduct(), <ProductFaqBlock {...live({ locale: 'ar' })} />, 'ar');
    const html = container.innerHTML;
    expect(triggers()[0].className).toContain('text-start');
    expect(html).not.toMatch(/\b(text-left|text-right|ml-|mr-|pl-|pr-|left-|right-)/);
  });

  it('renders nothing live without FAQs; placeholder in the builder', () => {
    expect(withState(bare(), <ProductFaqBlock {...live()} />).container.innerHTML).toBe('');
    const builder = withState(bare(), <ProductFaqBlock {...live({ builderPreview: true, locale: 'ar' })} />);
    expect(builder.container.querySelector('[data-product-block-placeholder]')?.textContent).toContain('لا توجد أسئلة شائعة');
  });
});

describe('product-shipping-returns', () => {
  const content = { shipping_html: '<p>Ships in 2 days</p>', returns_html: '<p>30-day returns</p>' };

  it('shows both texts with default headings', () => {
    const { container } = withState(makeProduct(), <ProductShippingReturnsBlock {...live({ content })} />);
    expect(Array.from(container.querySelectorAll('h2')).map((h) => h.textContent)).toEqual([
      'product.shippingHeading',
      'product.returnsHeading',
    ]);
    expect(container.textContent).toContain('Ships in 2 days');
    expect(container.textContent).toContain('30-day returns');
  });

  it('custom headings, show_shipping / show_returns / show_heading', () => {
    const custom = withState(
      makeProduct(),
      <ProductShippingReturnsBlock {...live({ content: { ...content, shipping_heading: 'Leverans' }, settings: { show_returns: false } })} />,
    );
    expect(custom.container.querySelector('h2')?.textContent).toBe('Leverans');
    expect(custom.container.textContent).not.toContain('30-day returns');
    custom.unmount();
    const noHead = withState(makeProduct(), <ProductShippingReturnsBlock {...live({ content, settings: { show_heading: false } })} />);
    expect(noHead.container.querySelector('h2')).toBeNull();
    expect(noHead.container.textContent).toContain('30-day returns');
  });

  it('matches the shipping panel markup of product-tabs', () => {
    const block = withState(makeProduct(), <ProductShippingReturnsBlock {...live({ content })} />);
    const prose = block.container.querySelector('[data-shipping-returns-part="shipping"] .prose')?.outerHTML;
    block.unmount();
    const tabs = withState(
      bare(),
      <ProductTabsBlock {...live({ settings: { show_shipping: true }, content })} />,
    );
    expect(tabs.container.querySelector('[role="tabpanel"] .prose')?.outerHTML).toBe(prose);
  });

  it('renders nothing live without text; placeholder with a hint in the builder', () => {
    expect(withState(makeProduct(), <ProductShippingReturnsBlock {...live()} />).container.innerHTML).toBe('');
    const off = withState(makeProduct(), <ProductShippingReturnsBlock {...live({ content, settings: { show_shipping: false, show_returns: false } })} />);
    expect(off.container.innerHTML).toBe('');
    off.unmount();
    const builder = withState(makeProduct(), <ProductShippingReturnsBlock {...live({ builderPreview: true })} />);
    expect(builder.container.querySelector('[data-product-block-placeholder]')?.textContent).toContain('block’s settings');
  });
});
