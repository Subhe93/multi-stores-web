import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import type { ProductData } from '@/components/product/ProductDetailClient';
import type { ProductContext, SectionRenderProps } from '@/themes/types';
import type { StorefrontApps } from '@/lib/storeApps';
import type { StoreTaxConfig } from '@/lib/tax';

// Coupon banner parity (campaign link ?coupon=TEST123 on namez.se): on a
// variant product (compare-at price, personalization, no variant picked
// yet) the Classic block composition must show the very banner the
// monolith `product-page` shows, from the same coupon-preview request, both
// before and after a variant pick.
//
// Edges mocked as in productParity.test.tsx, plus the cart (a pending link
// code) and the API (coupon-preview answers 10 %; every other call stays
// pending so no block depends on it).

const apiMock = vi.fn<(endpoint: string, options?: { body?: string }) => Promise<unknown>>();
const cartValue = {
  addItem: vi.fn(() => Promise.resolve()),
  items: [] as unknown[],
  coupon: null,
  pendingCouponCode: 'TEST123',
  storeId: 'store-namez',
  marketKey: undefined,
  marketPreview: false,
  removeCoupon: vi.fn(() => Promise.resolve()),
  discardPendingCoupon: vi.fn(),
};

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/products/x',
  useParams: () => ({ storeSlug: 'namez-se' }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('next-intl', () => {
  const t = Object.assign(
    (k: string, values?: Record<string, unknown>) => (values ? `${k} ${JSON.stringify(values)}` : k),
    {
      rich: (k: string, values?: Record<string, unknown>) => `${k} ${String(values?.code ?? '')}`,
      markup: (k: string) => k,
      raw: (k: string) => k,
      has: () => true,
    },
  );
  return { useLocale: () => 'sv', useTranslations: () => t };
});
vi.mock('@/hooks/useCart', () => ({ useCart: () => cartValue }));
vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, api: (endpoint: string, options?: { body?: string }) => apiMock(endpoint, options) };
});
vi.mock('@/components/StoreImage', () => ({
  StoreImage: ({ src, alt }: { src: string; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} />
  ),
}));

import { ProductDetailClient } from '@/components/product/ProductDetailClient';
import { ProductPageStateProvider } from '@/components/product/state/ProductPageState';
import { DesignerSessionProvider } from '@/components/designer/DesignerSession';
import { StoreAppsProvider } from '@/hooks/useStoreApps';
import { StoreTaxProvider } from '@/hooks/useStoreTax';
import { ProductBreadcrumbBlock } from '@/themes/minimal/sections/product/blocks/ProductBreadcrumbBlock.client';
import { ProductTitleBlock } from '@/themes/minimal/sections/product/blocks/ProductTitleBlock.client';
import { ProductPriceBlock } from '@/themes/minimal/sections/product/blocks/ProductPriceBlock.client';
import { ProductShortDescriptionBlock } from '@/themes/minimal/sections/product/blocks/ProductShortDescriptionBlock.client';
import { ProductPromotionsBlock } from '@/themes/minimal/sections/product/blocks/ProductPromotionsBlock.client';
import { ProductBundlesBlock } from '@/themes/minimal/sections/product/blocks/ProductBundlesBlock.client';
import { ProductVariantsBlock } from '@/themes/minimal/sections/product/blocks/ProductVariantsBlock.client';
import { ProductPersonalizationBlock } from '@/themes/minimal/sections/product/blocks/ProductPersonalizationBlock.client';
import { ProductBuyBlock } from '@/themes/minimal/sections/product/blocks/ProductBuyBlock.client';
import { ProductGalleryMagic } from '@/themes/minimal/sections/product/ProductGalleryMagic.client';
import { ProductTrustBlock } from '@/themes/minimal/sections/product/blocks/ProductTrustBlock.client';
import { ProductShippingBlock } from '@/themes/minimal/sections/product/blocks/ProductShippingBlock.client';
import { ProductTabsBlock } from '@/themes/minimal/sections/product/blocks/ProductTabsBlock.client';

import storeContext from '@/test/fixtures/products/namez-store-context.json';
import colourCompareAt from '@/test/fixtures/products/colour-compare-at-personalization.json';

const LOCALE = storeContext.primaryLocale;
const CURRENCY = storeContext.currency;
const APPS = storeContext.apps as unknown as StorefrontApps;
const TAX = storeContext.tax as StoreTaxConfig;
const PRODUCT = colourCompareAt as unknown as ProductData;

function StoreShell({ children }: { children: ReactNode }) {
  return (
    <StoreAppsProvider value={APPS}>
      <StoreTaxProvider value={TAX}>{children}</StoreTaxProvider>
    </StoreAppsProvider>
  );
}

function renderMonolith() {
  return render(
    <StoreShell>
      <ProductDetailClient
        product={PRODUCT}
        locale={LOCALE}
        primaryLocale={LOCALE}
        currency={CURRENCY}
        options={{ trustBadges: [], showShipping: true, showTabs: true }}
      />
    </StoreShell>,
  );
}

/** The Classic preset as the live namez.se template: Row[ gallery | summary blocks ], tabs below. */
function renderClassicBlocks() {
  const p = (settings: Record<string, unknown> = {}): SectionRenderProps => ({
    settings,
    content: {},
    locale: LOCALE,
    primaryLocale: LOCALE,
    storeSlug: 'namez-se',
    currency: CURRENCY,
    product: PRODUCT as unknown as ProductContext,
    builderPreview: false,
  });
  // The live price block settings: show_coupon unset (defaults to on).
  const livePrice = { show_sku: true, show_savings: true, show_compare_at: true, show_unit_price: true };
  return render(
    <StoreShell>
      <DesignerSessionProvider designer={PRODUCT.designer} productId={PRODUCT.id} locale={LOCALE}>
        <ProductPageStateProvider product={PRODUCT} locale={LOCALE} primaryLocale={LOCALE} currency={CURRENCY}>
          <div className="grid grid-cols-1 md:grid-cols-2">
            <div>
              <ProductGalleryMagic {...p({ layout: 'classic' })} />
            </div>
            <div className="flex flex-col gap-5">
              <ProductBreadcrumbBlock {...p()} />
              <ProductTitleBlock {...p()} />
              <ProductPriceBlock {...p(livePrice)} />
              <ProductShortDescriptionBlock {...p()} />
              <ProductPromotionsBlock {...p()} />
              <ProductBundlesBlock {...p()} />
              <ProductPersonalizationBlock {...p({ placement: 'before_variants' })} />
              <ProductVariantsBlock {...p()} />
              <ProductPersonalizationBlock {...p({ placement: 'after_variants' })} />
              <ProductBuyBlock {...p()} />
              <ProductTrustBlock {...p()} />
              <ProductShippingBlock {...p()} />
            </div>
          </div>
          <ProductTabsBlock {...p()} />
        </ProductPageStateProvider>
      </DesignerSessionProvider>
    </StoreShell>,
  );
}

const previewCalls = () => apiMock.mock.calls.filter((c) => c[0] === '/promotions/coupon-preview');
const previewBodies = () => previewCalls().map((c) => JSON.parse(String(c[1]?.body)) as Record<string, unknown>);

interface BannerView {
  banner: string | null;
  price: string | null;
  regular: string | null;
  lastBody: Record<string, unknown> | undefined;
}

function bannerView(root: HTMLElement): BannerView {
  const banner = root.querySelector('[data-testid="coupon-banner"]');
  return {
    banner: banner?.textContent?.trim() ?? null,
    price: root.querySelector('[data-testid="coupon-banner-price"]')?.textContent?.trim() ?? null,
    regular: banner?.querySelector('.line-through')?.textContent?.trim() ?? null,
    lastBody: previewBodies().at(-1),
  };
}

/** Clicks one colour swatch of the variant picker. */
function pickColour(root: HTMLElement, value: string) {
  const target = root.querySelector<HTMLButtonElement>(`button[title="${value}"]`);
  expect(target, `swatch ${value}`).toBeTruthy();
  act(() => {
    fireEvent.click(target!);
  });
}

/** Renders one composition, reads the banner, picks a colour, reads it again. */
async function run(renderPage: () => ReturnType<typeof render>): Promise<{ initial: BannerView; picked: BannerView }> {
  const { container } = renderPage();
  await waitFor(() => expect(container.querySelector('[data-testid="coupon-banner-price"]')).toBeTruthy());
  const initial = bannerView(container);
  const before = previewCalls().length;
  pickColour(container, 'Röd');
  await waitFor(() => {
    expect(previewCalls().length).toBeGreaterThan(before);
    expect(container.querySelector('[data-testid="coupon-banner-price"]')).toBeTruthy();
  });
  const picked = bannerView(container);
  cleanup();
  return { initial, picked };
}

beforeEach(() => {
  // jsdom has no scrollIntoView (the gallery scrolls its active thumbnail).
  Element.prototype.scrollIntoView = () => undefined;
  sessionStorage.clear();
  localStorage.clear();
  apiMock.mockReset();
  apiMock.mockImplementation((endpoint, options) => {
    if (endpoint !== '/promotions/coupon-preview') return new Promise(() => {});
    const body = JSON.parse(String(options?.body)) as { line_amount: number };
    const discount = Math.round(body.line_amount * 10) / 100;
    return Promise.resolve({
      code: 'TEST123',
      discount_kind: 'percentage',
      percent: 10,
      amount: null,
      free_shipping: false,
      applies: true,
      min_amount: null,
      min_quantity: null,
      min_met: true,
      discount_amount: discount,
    });
  });
});
afterEach(() => {
  cleanup();
});

describe('coupon banner parity: monolith vs Classic block composition (variant product)', () => {
  it('shows the same banner from the same request, before and after a variant pick', async () => {
    const monolith = await run(renderMonolith);
    sessionStorage.clear();
    apiMock.mockClear();
    const blocks = await run(renderClassicBlocks);

    // Not vacuous: a pending-link banner with the 10 % price of the 275 kr line.
    expect(monolith.initial.banner).toContain('product.couponPendingCheckout TEST123');
    expect(monolith.initial.lastBody).toMatchObject({
      coupon_code: 'TEST123',
      product_id: PRODUCT.id,
      line_amount: 275,
      quantity: 1,
    });
    // No variant picked yet: the request carries no variant id.
    expect(monolith.initial.lastBody).not.toHaveProperty('variant_id');
    expect(monolith.picked.lastBody).toMatchObject({ variant_id: 'dd4a555e-20fb-46b1-b580-fbea37a01f89' });

    expect(blocks.initial).toEqual(monolith.initial);
    expect(blocks.picked).toEqual(monolith.picked);
  });
});
