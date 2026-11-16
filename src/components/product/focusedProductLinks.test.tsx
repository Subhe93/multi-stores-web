import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { CheckoutSettingsProvider } from '@/hooks/useCheckoutSettings';
import { normalizeCheckoutSettings, type CheckoutSettings } from '@/lib/checkoutSettings';
import type { ProductData } from '@/components/product/ProductDetailClient';
import type { ProductContext, SectionRenderProps } from '@/themes/types';

// Focused storefront: the product page keeps its content but loses every
// link into a listing (home, collections, the product listing all redirect
// to the external site). Covered here on every surface that renders such a
// link: the monolith product page, the product-page section and the
// product-title / product-breadcrumb blocks. A store with a site but without
// the flag renders the links exactly as before.

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/products/mug',
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
vi.mock('@/hooks/useCart', () => ({ useCart: () => ({ addItem: vi.fn(() => Promise.resolve()) }) }));
vi.mock('@/components/StoreImage', () => ({
  StoreImage: ({ src, alt }: { src: string; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} />
  ),
}));

import { ProductDetailClient } from '@/components/product/ProductDetailClient';
import { ProductPageStateProvider } from '@/components/product/state/ProductPageState';
import { ProductPageMagic } from '@/themes/minimal/sections/product/ProductPageMagic.client';
import { ProductTitleBlock } from '@/themes/minimal/sections/product/blocks/ProductTitleBlock.client';
import { ProductBreadcrumbBlock } from '@/themes/minimal/sections/product/blocks/ProductBreadcrumbBlock.client';

const SITE = 'https://mollstrands.example/';
const FOCUSED = normalizeCheckoutSettings({ external_site_url: SITE, external_focus: true });
const SITE_ONLY = normalizeCheckoutSettings({ external_site_url: SITE });

const product: ProductData = {
  id: 'p1',
  base_price: 100,
  translations: [{ locale: 'en', title: 'Mug', slug: 'mug', description: '<p>Long text</p>' }],
  images: [],
  variants: [],
  vendor: { company_name: 'Acme' },
  primary_collection_path: [
    { id: 'c0', slug: 'kitchen', path: ['kitchen'], translations: [{ locale: 'en', name: 'Kitchen' }] },
    { id: 'c1', slug: 'mugs', path: ['kitchen', 'mugs'], translations: [{ locale: 'en', name: 'Mugs' }] },
  ],
} as ProductData;

function sectionProps(settings: Record<string, unknown> = {}): SectionRenderProps {
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

function PageState({ children }: { children: ReactNode }) {
  return (
    <ProductPageStateProvider product={product} locale="en" primaryLocale="en" currency="SEK">
      {children}
    </ProductPageStateProvider>
  );
}

const surfaces: Array<[string, () => ReactNode]> = [
  [
    'monolith product page (ProductDetailClient)',
    () => (
      <ProductDetailClient
        product={product}
        locale="en"
        primaryLocale="en"
        currency="SEK"
        options={{ trustBadges: [], showShipping: false, showTabs: false }}
      />
    ),
  ],
  ['product-page section (ProductPageMagic)', () => <ProductPageMagic {...sectionProps()} />],
  ['product-title block', () => <PageState><ProductTitleBlock {...sectionProps()} /></PageState>],
  ['product-breadcrumb block', () => <PageState><ProductBreadcrumbBlock {...sectionProps()} /></PageState>],
];

/** Hrefs of every in-page link that leads into a redirected browsing page. */
function listingLinks(container: HTMLElement): string[] {
  return [...container.querySelectorAll('a[href]')]
    .map((a) => a.getAttribute('href') ?? '')
    .filter((href) => href === '/' || href === '/products' || href.startsWith('/collections'));
}

function renderWith(settings: CheckoutSettings | null, node: ReactNode) {
  return render(<CheckoutSettingsProvider value={settings}>{node}</CheckoutSettingsProvider>);
}

afterEach(cleanup);

describe('focused storefront: product page links', () => {
  it.each(surfaces)('%s: no link into a listing', (_label, build) => {
    const { container } = renderWith(FOCUSED, build());
    expect(listingLinks(container)).toEqual([]);
    expect(container.querySelector('nav[aria-label="Breadcrumb"]')).toBeNull();
  });

  it.each(surfaces)('%s: a site WITHOUT the flag keeps its links', (_label, build) => {
    const withSite = renderWith(SITE_ONLY, build());
    const links = listingLinks(withSite.container);
    expect(links.length).toBeGreaterThan(0);
    expect(links.some((href) => href.startsWith('/collections/kitchen'))).toBe(true);
    const html = withSite.container.innerHTML;
    withSite.unmount();
    // Same markup as a store without any setting at all.
    const plain = renderWith(null, build());
    expect(plain.container.innerHTML).toBe(html);
  });

  it('the collection name stays visible as plain text above the title', () => {
    const monolith = renderWith(
      FOCUSED,
      <ProductDetailClient
        product={product}
        locale="en"
        primaryLocale="en"
        currency="SEK"
        options={{ trustBadges: [], showShipping: false, showTabs: false }}
      />,
    );
    const label = [...monolith.container.querySelectorAll('span')].find((el) => el.textContent === 'Mugs');
    expect(label).toBeDefined();
    expect(label?.closest('a')).toBeNull();
    monolith.unmount();

    const block = renderWith(FOCUSED, <PageState><ProductTitleBlock {...sectionProps()} /></PageState>);
    const blockLabel = [...block.container.querySelectorAll('span')].find((el) => el.textContent === 'Mugs');
    expect(blockLabel?.closest('a')).toBeNull();
    expect(block.container.querySelector('h1')?.textContent).toBe('Mug');
    // The vendor line is plain text (never a link into the store).
    expect(block.container.textContent).toContain('Acme');
  });

  it('the product content itself is unchanged (title, add to cart)', () => {
    const focused = renderWith(FOCUSED, <ProductPageMagic {...sectionProps()} />);
    expect(focused.container.querySelector('h1')?.textContent).toBe('Mug');
    const buttons = focused.container.querySelectorAll('button').length;
    focused.unmount();
    const plain = renderWith(null, <ProductPageMagic {...sectionProps()} />);
    expect(plain.container.querySelectorAll('button').length).toBe(buttons);
  });
});
