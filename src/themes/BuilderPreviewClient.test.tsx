import { act, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';

// Builder preview of a PRODUCT_TEMPLATE made of product blocks. The preview
// route reads its sample product anonymously, which a store that is not LIVE
// refuses: the builder then posts the owner-read product with UPDATE_SECTIONS
// and every block (root or nested in a container) renders with it.

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/builder-preview/demo',
  useParams: () => ({ storeSlug: 'demo' }),
}));
vi.mock('next-intl', () => ({
  useLocale: () => 'en',
  useTranslations: () => (k: string) => k,
}));
vi.mock('@/hooks/useCart', () => ({ useCart: () => ({ addItem: vi.fn(() => Promise.resolve()) }) }));
vi.mock('@/components/StoreImage', () => ({
  StoreImage: ({ src, alt }: { src: string; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} />
  ),
}));
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
vi.mock('@/components/designer/DesignerSession', () => ({
  DesignerSessionProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  useDesignerSession: () => null,
  useDesignerAddonsTotal: () => 0,
  DesignerFormSlot: () => null,
}));

import { BuilderPreviewClient } from './BuilderPreviewClient';
import type { ProductContext, SectionInstance } from './types';

const sections: SectionInstance[] = [
  { id: 'title-root', section_key: 'product-title', settings: {}, sort_order: 0, translations: [], parent_id: null },
  { id: 'row1', section_key: 'layout-row', settings: {}, sort_order: 1, translations: [], parent_id: null },
  { id: 'title-nested', section_key: 'product-title', settings: {}, sort_order: 0, translations: [], parent_id: 'row1' },
] as SectionInstance[];

const product = {
  id: 'p1',
  slug: 'mug',
  base_price: 100,
  translations: [{ locale: 'en', title: 'Sample Mug', slug: 'mug', description: '<p>Text</p>' }],
  images: [],
  variants: [],
} as unknown as ProductContext;

function post(data: Record<string, unknown>) {
  act(() => {
    window.dispatchEvent(
      new MessageEvent('message', { data, origin: window.location.origin, source: window }),
    );
  });
}

function renderPreview(initialProduct?: ProductContext) {
  return render(
    <BuilderPreviewClient
      storeSlug="demo"
      initial={{
        themeKey: 'minimal',
        customizations: {},
        sections: [],
        locale: 'en',
        primaryLocale: 'en',
        product: initialProduct,
        currency: 'SEK',
      }}
    />,
  );
}

describe('BuilderPreviewClient product blocks', () => {
  it('shows placeholders without a product (closed store, nothing posted)', async () => {
    renderPreview();
    post({ type: 'UPDATE_SECTIONS', sections });
    expect(await screen.findAllByText('Pick a sample product to preview.')).toHaveLength(2);
    expect(screen.queryByText('Sample Mug')).toBeNull();
  });

  it('renders every block, nested ones included, with the posted product', async () => {
    renderPreview();
    post({ type: 'UPDATE_SECTIONS', sections, product });
    const titles = await screen.findAllByRole('heading', { name: 'Sample Mug' });
    expect(titles).toHaveLength(2);
    expect(screen.queryByText('Pick a sample product to preview.')).toBeNull();
  });

  it('keeps the posted product across later updates without one', async () => {
    renderPreview();
    post({ type: 'UPDATE_SECTIONS', sections, product });
    await screen.findAllByRole('heading', { name: 'Sample Mug' });
    post({ type: 'UPDATE_SECTIONS', sections: sections.slice(0, 1) });
    expect(await screen.findAllByRole('heading', { name: 'Sample Mug' })).toHaveLength(1);
  });

  it('projects the posted product like the live page (attribute labels of other locales drop)', async () => {
    const withAttr = {
      ...product,
      attributes: [
        {
          id: 'a1',
          value: 'Keramik',
          template: {
            name: 'material',
            translations: [
              { locale: 'sv', label: 'Material-SV' },
              { locale: 'en', label: 'Material-EN' },
              { locale: 'de', label: 'Werkstoff' },
            ],
          },
        },
      ],
    } as unknown as ProductContext;
    const rich = (key: string, id: string): SectionInstance =>
      ({
        id,
        section_key: 'rich-text',
        settings: { content_source: 'product_attribute', attribute_key: key },
        sort_order: 0,
        translations: [],
        parent_id: null,
      }) as unknown as SectionInstance;
    renderPreview();
    // en / en keeps the first row (sv) and en; the de label is pruned as live.
    post({ type: 'UPDATE_SECTIONS', sections: [rich('Material-EN', 'r1'), rich('Werkstoff', 'r2')], product: withAttr });
    const kept = await screen.findAllByText('Keramik');
    expect(kept).toHaveLength(1);
    expect(document.querySelector('[data-dynamic-source-hint="product_attribute"]')).not.toBeNull();
  });

  it('keeps the server-side sample when nothing usable is posted', async () => {
    renderPreview(product);
    post({ type: 'UPDATE_SECTIONS', sections, product: { title: 'no id' } });
    expect(await screen.findAllByRole('heading', { name: 'Sample Mug' })).toHaveLength(2);
  });
});
