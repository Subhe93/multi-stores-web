import { act, render, screen, waitFor } from '@testing-library/react';
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

// Records what the preview hands the sections through context.
const providedApps: unknown[] = [];
const providedTax: unknown[] = [];
vi.mock('@/hooks/useStoreApps', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/hooks/useStoreApps')>();
  return {
    ...actual,
    StoreAppsProvider: (props: { value?: unknown; children: ReactNode }) => {
      providedApps.push(props.value);
      return <actual.StoreAppsProvider value={props.value as never}>{props.children}</actual.StoreAppsProvider>;
    },
  };
});
vi.mock('@/hooks/useStoreTax', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/hooks/useStoreTax')>();
  return {
    ...actual,
    StoreTaxProvider: (props: { value: unknown; children: ReactNode }) => {
      providedTax.push(props.value);
      return <actual.StoreTaxProvider value={props.value as never}>{props.children}</actual.StoreTaxProvider>;
    },
  };
});

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

function renderPreview(initialProduct?: ProductContext, currency = 'SEK') {
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
        currency,
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

  it('prices in the posted store currency (draft store: the route fell back to EUR)', async () => {
    const price: SectionInstance[] = [
      { id: 'price', section_key: 'product-price', settings: {}, sort_order: 0, translations: [], parent_id: null },
    ] as SectionInstance[];
    const sek = new Intl.NumberFormat('en', { style: 'currency', currency: 'SEK' }).format(100);
    const eur = new Intl.NumberFormat('en', { style: 'currency', currency: 'EUR' }).format(100);
    const priceText = () => document.querySelector('[data-section-id="price"]')?.textContent ?? '';
    renderPreview(undefined, 'EUR');
    post({ type: 'UPDATE_SECTIONS', sections: price, product });
    await waitFor(() => expect(priceText()).toContain(eur));
    post({ type: 'UPDATE_SECTIONS', sections: price, product, currency: 'SEK' });
    await waitFor(() => expect(priceText()).toContain(sek));
    // A later update without a currency (or an invalid one) keeps SEK.
    post({ type: 'UPDATE_SECTIONS', sections: price, currency: 'kr' });
    await waitFor(() => expect(priceText()).toContain(sek));
    expect(priceText()).not.toContain(eur);
  });

  it('provides the posted store apps and tax settings (draft store: the route read the closed shell)', async () => {
    const price: SectionInstance[] = [
      { id: 'price', section_key: 'product-price', settings: {}, sort_order: 0, translations: [], parent_id: null },
    ] as SectionInstance[];
    providedApps.length = 0;
    providedTax.length = 0;
    renderPreview(undefined, 'EUR');
    post({ type: 'UPDATE_SECTIONS', sections: price, product });
    await waitFor(() => expect(document.querySelector('[data-section-id="price"]')).not.toBeNull());
    // Nothing posted, nothing from the route: the route's providers apply.
    expect(providedApps).toEqual([]);
    expect(providedTax).toEqual([]);
    post({
      type: 'UPDATE_SECTIONS',
      sections: price,
      product,
      currency: 'SEK',
      apps: { personalization: { enabled: true, settings: { x: 1 } }, b2b: { enabled: false } },
      tax: { pricing_mode: 'INCLUSIVE', display_prices_incl_tax: true, country: 'se' },
    });
    await waitFor(() =>
      expect(providedApps.at(-1)).toEqual({ personalization: { enabled: true, settings: { x: 1 } } }),
    );
    expect(providedTax.at(-1)).toEqual({
      pricing_mode: 'INCLUSIVE',
      display_prices_incl_tax: true,
      country: 'SE',
      registrant: 'STORE',
    });
    // A later update without them keeps both.
    post({ type: 'UPDATE_SECTIONS', sections: price });
    await waitFor(() => expect(providedApps.at(-1)).toEqual({ personalization: { enabled: true, settings: { x: 1 } } }));
    expect(providedTax.at(-1)).toMatchObject({ country: 'SE' });
  });
  it('defines the --store-* brand colours (theme tokens, then the posted owner-read store colour)', async () => {
    const { container } = renderPreview(undefined, 'SEK');
    const root = () => container.querySelector('.store-root') as HTMLElement;
    // Without a store colour: the theme's primary, like the live layout.
    const tokenPrimary = root().style.getPropertyValue('--theme-colors-primary');
    expect(tokenPrimary).not.toBe('');
    expect(root().style.getPropertyValue('--store-primary')).toBe(tokenPrimary);
    expect(root().style.getPropertyValue('--store-primary-contrast')).not.toBe('');
    post({ type: 'UPDATE_SECTIONS', sections, theme: { primaryColor: '#e11d48' } });
    await waitFor(() => expect(root().style.getPropertyValue('--store-primary')).toBe('#e11d48'));
    // A later update without the block keeps it.
    post({ type: 'UPDATE_SECTIONS', sections });
    expect(root().style.getPropertyValue('--store-primary')).toBe('#e11d48');
  });
});

// Optional theme tokens: an Arabic-script fallback font and a button radius.
describe('BuilderPreviewClient Arabic font and button radius tokens', () => {
  const fontLink = () => document.getElementById('builder-preview-fonts') as HTMLLinkElement | null;
  const buttonStyle = (container: HTMLElement) => container.querySelector('style[data-theme-button-css]');
  // The minimal theme's own fonts: the link the preview always built.
  const BASE_HREF =
    'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700&family=Inter:wght@400;500;600;700&display=swap';

  it('unset or invalid: the font link is unchanged and no extra style is rendered', async () => {
    const { container, unmount } = renderPreview();
    await waitFor(() => expect(fontLink()?.href).toBe(BASE_HREF));
    expect(buttonStyle(container)).toBeNull();
    const root = container.querySelector('.store-root') as HTMLElement;
    const hasButtonRule = () => (container.textContent ?? '').includes('--theme-radius-button');
    expect(hasButtonRule()).toBe(false);
    expect(root.style.getPropertyValue('--theme-font-heading')).toBe('"Playfair Display", system-ui, sans-serif');
    expect(root.style.getPropertyValue('--theme-radius-button')).toBe('');
    // Invalid stored values read as unset.
    post({
      type: 'UPDATE_SECTIONS',
      sections,
      customizations: {
        typography: { fontFamilyArabic: { heading: 'Comic Sans', body: '' } },
        spacing: { radius: { button: '1px;}body{' } },
      },
    });
    await waitFor(() => expect(container.querySelector('[data-section-id="row1"]')).not.toBeNull());
    expect(fontLink()?.href).toBe(BASE_HREF);
    expect(buttonStyle(container)).toBeNull();
    expect(hasButtonRule()).toBe(false);
    expect(root.style.getPropertyValue('--theme-font-heading')).toBe('"Playfair Display", system-ui, sans-serif');
    expect(root.style.getPropertyValue('--theme-radius-button')).toBe('');
    unmount();
  });

  it('set: the Arabic family is appended to the font link and the stack', async () => {
    const { container, unmount } = renderPreview();
    await waitFor(() => expect(fontLink()?.href).toBe(BASE_HREF));
    post({
      type: 'UPDATE_SECTIONS',
      sections,
      customizations: { typography: { fontFamilyArabic: { heading: 'Noto Naskh Arabic', body: 'Noto Naskh Arabic' } } },
    });
    await waitFor(() =>
      expect(fontLink()?.href).toBe(
        BASE_HREF.replace('&display=swap', '&family=Noto+Naskh+Arabic:wght@400;500;600;700&display=swap'),
      ),
    );
    const root = container.querySelector('.store-root') as HTMLElement;
    expect(root.style.getPropertyValue('--theme-font-heading')).toBe(
      '"Playfair Display", "Noto Naskh Arabic", system-ui, sans-serif',
    );
    expect(root.style.getPropertyValue('--theme-font-body')).toBe('"Inter", "Noto Naskh Arabic", system-ui, sans-serif');
    // Cleared again: back to the original link.
    post({ type: 'UPDATE_SECTIONS', sections, customizations: {} });
    await waitFor(() => expect(fontLink()?.href).toBe(BASE_HREF));
    unmount();
  });

  it('set: the button radius variable and its one rule appear, and go away when cleared', async () => {
    const { container, unmount } = renderPreview();
    expect(buttonStyle(container)).toBeNull();
    post({ type: 'UPDATE_SECTIONS', sections, customizations: { spacing: { radius: { button: '0px' } } } });
    await waitFor(() => expect(buttonStyle(container)).not.toBeNull());
    const css = buttonStyle(container)!.textContent ?? '';
    expect(css).toContain('.store-root [data-section-key="hero-banner"] a,');
    expect(css).toContain('{--theme-radius-full:var(--theme-radius-button);--theme-radius-sm:var(--theme-radius-button)}');
    const root = container.querySelector('.store-root') as HTMLElement;
    expect(root.style.getPropertyValue('--theme-radius-button')).toBe('0px');
    // The theme's own pill radius is not rewritten on the root.
    expect(root.style.getPropertyValue('--theme-radius-full')).toBe('9999px');
    post({ type: 'UPDATE_SECTIONS', sections, customizations: {} });
    await waitFor(() => expect(buttonStyle(container)).toBeNull());
    expect(root.style.getPropertyValue('--theme-radius-button')).toBe('');
    unmount();
  });

  it('the Arabic body rule is rendered only while the body slot holds a family', async () => {
    const arabicStyle = (container: HTMLElement) => container.querySelector('style[data-theme-arabic-body-css]');
    const { container, unmount } = renderPreview();
    expect(arabicStyle(container)).toBeNull();
    expect(container.textContent ?? '').not.toContain('body{font-family');
    // The heading slot alone, or an invalid body value: still no rule.
    post({
      type: 'UPDATE_SECTIONS',
      sections,
      customizations: { typography: { fontFamilyArabic: { heading: 'Noto Kufi Arabic', body: 'Comic Sans' } } },
    });
    await waitFor(() => expect(container.querySelector('[data-section-id="row1"]')).not.toBeNull());
    expect(arabicStyle(container)).toBeNull();
    post({
      type: 'UPDATE_SECTIONS',
      sections,
      customizations: { typography: { fontFamilyArabic: { body: 'Noto Naskh Arabic' } } },
    });
    await waitFor(() => expect(arabicStyle(container)).not.toBeNull());
    expect(arabicStyle(container)!.textContent).toBe(
      `body{font-family:'Inter',"Noto Naskh Arabic",system-ui,-apple-system,sans-serif}`,
    );
    post({ type: 'UPDATE_SECTIONS', sections, customizations: {} });
    await waitFor(() => expect(arabicStyle(container)).toBeNull());
    unmount();
  });
});
