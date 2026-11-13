import { act, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import type { ProductData } from '@/components/product/ProductDetailClient';
import type { ProductContext, SectionRenderProps } from '../../types';

// `variant_image` dynamic source against the real ProductPageStateProvider:
// picking an option or a variant must swap the section's image, exactly like
// the gallery block (ImageWithText.test.tsx only stubs the state).

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/en/products/x',
  useParams: () => ({ storeSlug: 'demo' }),
}));
vi.mock('next-intl', () => ({
  useLocale: () => 'en',
  useTranslations: () => (k: string) => k,
}));
vi.mock('@/hooks/useCart', () => ({ useCart: () => ({ addItem: vi.fn(() => Promise.resolve()) }) }));
// Plain <img> instead of next/image so the src can be asserted.
vi.mock('@/components/StoreImage', () => ({
  // eslint-disable-next-line @next/next/no-img-element
  StoreImage: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
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
// next/dynamic does not resolve synchronously in tests: use the island itself.
vi.mock('./_shared/lazyDynamic', async () => import('./_shared/DynamicProductImage.client'));

import { ProductPageStateProvider, useProductPageState } from '@/components/product/state/ProductPageState';
import { imageWithTextSection } from './ImageWithText';
import { singleImageSection } from './SingleImage';

const IMG = (name: string) => `https://cdn.test/${name}.jpg`;

const PRODUCT: ProductData = {
  id: 'p1',
  base_price: 100,
  translations: [{ locale: 'en', title: 'Mug', slug: 'mug' }],
  images: [{ id: 'i1', url: IMG('base-1') }],
  variants: [
    { id: 'v-red', sku: 'MUG-RED', price: 120, stock: 5, options: { Color: 'Red' }, images: [{ url: IMG('red-variant') }] },
    { id: 'v-green', sku: 'MUG-GREEN', price: 110, stock: 3, options: { Color: 'Green' } },
  ],
  variant_option_config: [{ name: 'Color', style: 'color', values: ['Red', 'Green'], imageMap: { Green: IMG('green-value') } }],
} as unknown as ProductData;

let api: ReturnType<typeof useProductPageState> | null = null;
function Capture() {
  api = useProductPageState();
  return null;
}

function mount(node: ReactNode) {
  return render(
    <ProductPageStateProvider product={PRODUCT} locale="en" primaryLocale="en" currency="SEK">
      <Capture />
      {node}
    </ProductPageStateProvider>,
  );
}

function sectionProps(settings: Record<string, unknown>, content: Record<string, unknown> = {}): SectionRenderProps {
  return {
    settings,
    content,
    locale: 'en',
    primaryLocale: 'en',
    storeSlug: 'demo',
    product: PRODUCT as unknown as ProductContext,
    builderPreview: false,
  };
}

const srcOf = (container: HTMLElement) => container.querySelector('[data-dynamic-image="variant_image"] img')?.getAttribute('src');

describe('variant_image follows the real product state', () => {
  it('image-with-text swaps to the option image, then the variant image', () => {
    const ImageWithText = imageWithTextSection.Component;
    const { container } = mount(<ImageWithText {...sectionProps({ image_source: 'variant_image' }, { heading: 'Hi' })} />);
    expect(srcOf(container)).toBe(IMG('base-1'));

    act(() => api!.setOptionSelections({ Color: 'Green' }));
    expect(srcOf(container)).toBe(IMG('green-value'));

    act(() => {
      api!.setOptionSelections({ Color: 'Red' });
      api!.setSelectedVariantId('v-red');
    });
    expect(srcOf(container)).toBe(IMG('red-variant'));
  });

  it('single-image follows the variant and keeps the owner alt text', () => {
    const SingleImage = singleImageSection.Component;
    const { container } = mount(<SingleImage {...sectionProps({ image_source: 'variant_image', aspect: 'square' }, { alt: 'Owner alt' })} />);
    const img = () => container.querySelector('[data-dynamic-image="variant_image"] img');
    expect(img()?.getAttribute('alt')).toBe('Owner alt');

    act(() => {
      api!.setOptionSelections({ Color: 'Red' });
      api!.setSelectedVariantId('v-red');
    });
    expect(img()?.getAttribute('src')).toBe(IMG('red-variant'));
    expect(img()?.getAttribute('alt')).toBe('Owner alt');
  });

  it('without owner alt text the gallery alt is used', () => {
    const SingleImage = singleImageSection.Component;
    const { container } = mount(<SingleImage {...sectionProps({ image_source: 'variant_image', aspect: 'square' })} />);
    expect(container.querySelector('[data-dynamic-image="variant_image"] img')?.getAttribute('alt')).toBe('Mug');
  });
});
