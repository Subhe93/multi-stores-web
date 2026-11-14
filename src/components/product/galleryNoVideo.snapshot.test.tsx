import { describe, expect, it, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import type { ReactElement, ReactNode } from 'react';
import type { ProductData } from '@/components/product/ProductDetailClient';
import type { ProductContext, SectionRenderProps } from '@/themes/types';
import type { StorefrontApps } from '@/lib/storeApps';
import type { StoreTaxConfig } from '@/lib/tax';

// Product video, Namez guard (contract sections 0 and 7): for products
// WITHOUT video the server-rendered markup of the monolith product page and
// of every product-gallery block layout must stay byte-identical to the
// markup before the video feature. The files under
// __snapshots__/gallery-no-video/ were written from the pre-video galleries
// (ProductGallery.tsx / ProductGalleryMagic.client.tsx at HEAD) and must
// never be regenerated to make this test pass. The raw HTML is compared:
// no difference is accepted (the block layouts' full-screen button exists
// only for products with videos).

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/products/x',
  useParams: () => ({ storeSlug: 'namez-se' }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('next-intl', () => {
  const t = Object.assign(
    (k: string, values?: Record<string, unknown>) => (values ? `${k} ${JSON.stringify(values)}` : k),
    { rich: (k: string) => k, markup: (k: string) => k, raw: (k: string) => k, has: () => true },
  );
  return { useLocale: () => 'sv', useTranslations: () => t };
});
vi.mock('@/hooks/useCart', () => ({ useCart: () => ({ addItem: vi.fn() }) }));
// The monolith's add-to-cart button renders busy (disabled + spinner) until
// it hydrates (QA 2026-11-14 #8, covered by ProductDetailClient.hydration
// test). This guard is about the video feature only, so it renders the
// hydrated button and keeps comparing against the untouched snapshots.
vi.mock('@/hooks/useHydrated', () => ({ useHydrated: () => true }));

import { ProductDetailClient } from '@/components/product/ProductDetailClient';
import { ProductGallery } from '@/components/product/ProductGallery';
import { ProductPageStateProvider } from '@/components/product/state/ProductPageState';
import { DesignerSessionProvider } from '@/components/designer/DesignerSession';
import { StoreAppsProvider } from '@/hooks/useStoreApps';
import { StoreTaxProvider } from '@/hooks/useStoreTax';
import { ProductGalleryMagic } from '@/themes/minimal/sections/product/ProductGalleryMagic.client';

import storeContext from '@/test/fixtures/products/namez-store-context.json';
import simpleDalahast from '@/test/fixtures/products/simple-dalahast.json';
import colourCompareAt from '@/test/fixtures/products/colour-compare-at-personalization.json';
import imageMapBottle from '@/test/fixtures/products/imagemap-multi-piece-bottle.json';
import derivedBundles from '@/test/fixtures/products/derived-bundles-sku.json';
import variantCompareAt from '@/test/fixtures/products/variant-compare-at.json';

const LOCALE = storeContext.primaryLocale;
const CURRENCY = storeContext.currency;
const APPS = storeContext.apps as unknown as StorefrontApps;
const TAX = storeContext.tax as StoreTaxConfig;

const FIXTURES: Record<string, ProductData> = {
  'simple-dalahast': simpleDalahast as unknown as ProductData,
  'colour-compare-at-personalization': colourCompareAt as unknown as ProductData,
  'imagemap-multi-piece-bottle': imageMapBottle as unknown as ProductData,
  'derived-bundles-sku': derivedBundles as unknown as ProductData,
  'variant-compare-at': variantCompareAt as unknown as ProductData,
};

const LAYOUTS = ['classic', 'main-thumbnails', 'grid', 'stacked', 'carousel'] as const;

const SNAP_DIR = './__snapshots__/gallery-no-video';

function Shell({ children }: { children: ReactNode }) {
  return (
    <StoreAppsProvider value={APPS}>
      <StoreTaxProvider value={TAX}>{children}</StoreTaxProvider>
    </StoreAppsProvider>
  );
}

function ssr(el: ReactElement): string {
  return renderToString(<Shell>{el}</Shell>);
}

function blockProps(product: ProductData, settings: Record<string, unknown>): SectionRenderProps {
  return {
    settings,
    content: {},
    locale: LOCALE,
    primaryLocale: LOCALE,
    storeSlug: 'namez-se',
    currency: CURRENCY,
    product: product as unknown as ProductContext,
    builderPreview: false,
  };
}

describe('no-video products: server markup unchanged by the video feature', () => {
  for (const [name, product] of Object.entries(FIXTURES)) {
    it(`monolith product page: ${name}`, async () => {
      expect(product.videos).toBeUndefined();
      const html = ssr(
        <ProductDetailClient
          product={product}
          locale={LOCALE}
          primaryLocale={LOCALE}
          currency={CURRENCY}
          options={{ trustBadges: [], showShipping: true, showTabs: true }}
        />,
      );
      await expect(html).toMatchFileSnapshot(`${SNAP_DIR}/monolith-${name}.html`);
    });

    for (const layout of LAYOUTS) {
      it(`product-gallery block, layout ${layout}: ${name}`, async () => {
        const html = ssr(
          <DesignerSessionProvider designer={product.designer} productId={product.id} locale={LOCALE}>
            <ProductPageStateProvider product={product} locale={LOCALE} primaryLocale={LOCALE} currency={CURRENCY}>
              <ProductGalleryMagic {...blockProps(product, { layout, aspect: 'square', enable_zoom: true })} />
            </ProductPageStateProvider>
          </DesignerSessionProvider>,
        );
        await expect(html).toMatchFileSnapshot(`${SNAP_DIR}/block-${layout}-${name}.html`);
      });
    }
  }

  it('standalone ProductGallery: empty, single and multi image, every aspect', async () => {
    const images = [
      { id: 'a', url: 'https://api.example.com/uploads/products/a.webp', alt: 'A' },
      { id: 'b', url: 'https://api.example.com/uploads/products/b.webp', alt: 'B' },
      { id: 'c', url: 'https://api.example.com/uploads/products/c.svg' },
    ];
    const html = [
      ssr(<ProductGallery images={[]} />),
      ssr(<ProductGallery images={images.slice(0, 1)} />),
      ssr(<ProductGallery images={images} />),
      ssr(<ProductGallery images={images} activeIndex={1} aspect="portrait" />),
      ssr(<ProductGallery images={images} aspect="landscape" />),
    ].join('\n');
    await expect(html).toMatchFileSnapshot(`${SNAP_DIR}/standalone-gallery.html`);
  });
});
