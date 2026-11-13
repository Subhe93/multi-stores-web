import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { ProductContext, SectionRenderProps } from '../../types';

// The variant-image island reads the shared product state; tests drive it
// through this stub. The lazy wrapper is replaced by the island itself
// (next/dynamic does not resolve in renderToStaticMarkup).
let leadImage: { url: string; alt: string } | null = null;
vi.mock('@/components/product/state/ProductPageState', () => ({
  useOptionalProductPageState: () => (leadImage ? { galleryImages: [{ id: 'lead', ...leadImage }] } : null),
}));
vi.mock('./_shared/lazyDynamic', async () => import('./_shared/DynamicProductImage.client'));

import { imageWithTextSection } from './ImageWithText';
import { singleImageSection } from './SingleImage';

const ImageWithText = imageWithTextSection.Component;

function html(props: Partial<SectionRenderProps> & { settings: Record<string, unknown>; content?: Record<string, unknown> }) {
  return renderToStaticMarkup(
    <ImageWithText locale="sv" primaryLocale="sv" storeSlug="namez-se" content={{}} {...props} />,
  );
}

const CONTENT = { eyebrow: 'Nyhet', heading: 'Gravyr', body: 'Text om gravyr', cta_text: 'Läs mer' };

// Settings as stored today (no image_source key). Snapshots were recorded
// before ImageWithText.tsx was edited and must stay byte-identical.
const STATIC_CASES: Array<[string, Record<string, unknown>, Record<string, unknown>]> = [
  ['palette defaults without an image', { ...imageWithTextSection.defaultSettings }, CONTENT],
  ['uploaded image on the left', { image: '/uploads/pages/a.jpg', image_position: 'left', aspect: 'portrait', cta_url: '/products' }, CONTENT],
  ['absolute image on the right with colours', {
    image: 'https://cdn.example.com/b.svg', image_position: 'right', aspect: 'wide',
    heading_color: '#111111', cta_bg_color: '#ff0000', cta_border_width: 2, cta_border_radius: 4,
  }, CONTENT],
  ['nothing set', {}, {}],
];

describe('image-with-text static output (unchanged)', () => {
  for (const [name, settings, content] of STATIC_CASES) {
    it(name, () => {
      expect(html({ settings, content })).toMatchSnapshot();
    });
    it(`${name} with an explicit static source matches`, () => {
      expect(html({ settings: { ...settings, image_source: 'static' }, content })).toBe(html({ settings, content }));
    });
  }
});

// ── Dynamic image source (PRODUCT_TEMPLATE) ─────────────────────────────

const PRODUCT: ProductContext = {
  id: 'p1',
  base_price: 100,
  translations: [{ locale: 'sv', title: 'Mugg' }],
  images: [
    { url: '/uploads/products/one.jpg', alt_text: 'Framsida' },
    { url: '/uploads/products/two.jpg' },
  ],
};

const imgSrcs = (out: string) => [...out.matchAll(/<img[^>]*?src="([^"]+)"/g)].map((m) => decodeURIComponent(m[1]));
const imgAlts = (out: string) => [...out.matchAll(/<img[^>]*?alt="([^"]*)"/g)].map((m) => m[1]);

describe('image-with-text dynamic image source', () => {
  it('featured image with its alt text', () => {
    const out = html({ settings: { image_source: 'product_featured', image: '/uploads/pages/static.jpg' }, content: CONTENT, product: PRODUCT, builderPreview: false });
    expect(imgSrcs(out).join()).toContain('one.jpg');
    expect(out).not.toContain('static.jpg');
    expect(imgAlts(out)).toEqual(['Framsida']);
  });

  it('Nth image falls back to the product title as alt', () => {
    const out = html({ settings: { image_source: 'product_image_n', image_index: 2 }, content: CONTENT, product: PRODUCT, builderPreview: false });
    expect(imgSrcs(out).join()).toContain('two.jpg');
    expect(imgAlts(out)).toEqual(['Mugg']);
  });

  it('live store, missing image: text only, no empty box', () => {
    const out = html({ settings: { image_source: 'product_image_n', image_index: 7 }, content: CONTENT, product: PRODUCT, builderPreview: false });
    expect(out).not.toContain('<img');
    expect(out).not.toContain('Upload an image');
    expect(out).not.toContain('md:grid-cols-2');
    expect(out).toContain('Gravyr');
    expect(html({ settings: { image_source: 'product_featured' }, content: {}, builderPreview: false })).toBe('');
  });

  it('builder preview, missing image: hint', () => {
    const out = html({ settings: { image_source: 'product_featured' }, content: CONTENT, builderPreview: true });
    expect(out).toContain('data-dynamic-source-hint="product_featured"');
  });

  it('variant image follows the shared product state', () => {
    leadImage = { url: 'https://cdn.test/red.jpg', alt: 'Mugg - Röd' };
    const out = html({ settings: { image_source: 'variant_image' }, content: CONTENT, product: PRODUCT, builderPreview: false });
    leadImage = null;
    expect(imgSrcs(out).join()).toContain('red.jpg');
    expect(imgAlts(out)).toEqual(['Mugg - Röd']);
  });

  it('variant image without a provider shows the featured image', () => {
    const out = html({ settings: { image_source: 'variant_image' }, content: CONTENT, product: PRODUCT, builderPreview: false });
    expect(imgSrcs(out).join()).toContain('one.jpg');
  });

  it('variant images only, no featured image: text only live, island in the builder', () => {
    const variantOnly: ProductContext = {
      ...PRODUCT,
      images: [],
      variants: [{ id: 'v1', price: 100, options: { Color: 'Red' }, images: [{ url: '/uploads/products/red.jpg' }] }],
    } as unknown as ProductContext;
    const live = html({ settings: { image_source: 'variant_image' }, content: CONTENT, product: variantOnly, builderPreview: false });
    expect(live).not.toContain('md:grid-cols-2');
    expect(live).toContain('Gravyr');
    const preview = html({ settings: { image_source: 'variant_image' }, content: CONTENT, product: variantOnly, builderPreview: true });
    expect(preview).toContain('md:grid-cols-2');
    expect(preview).toContain('data-dynamic-source-hint="variant_image"');
  });

  it('variant image outside a product page renders text only on the live store', () => {
    const out = html({ settings: { image_source: 'variant_image' }, content: CONTENT, builderPreview: false });
    expect(out).not.toContain('<img');
    expect(out).toContain('Gravyr');
  });
});

describe('single-image section', () => {
  const SingleImage = singleImageSection.Component;
  const one = (props: Partial<SectionRenderProps> & { settings: Record<string, unknown> }) =>
    renderToStaticMarkup(<SingleImage locale="sv" primaryLocale="sv" storeSlug="demo" content={{}} {...props} />);

  it('static image with alt and link', () => {
    const out = one({ settings: { image: '/uploads/pages/a.jpg', link_url: '/products' }, content: { alt: 'Bild' } });
    expect(out).toContain('href="/products"');
    expect(imgAlts(out)).toEqual(['Bild']);
  });

  it('empty: nothing on the live store, upload box in the builder', () => {
    expect(one({ settings: {}, builderPreview: false })).toBe('');
    expect(one({ settings: {}, builderPreview: true })).toContain('Upload an image');
  });

  it('variant image from the shared state', () => {
    leadImage = { url: 'https://cdn.test/blue.jpg', alt: 'Blå' };
    const out = one({ settings: { image_source: 'variant_image', aspect: 'square' }, product: PRODUCT, builderPreview: false });
    leadImage = null;
    expect(imgSrcs(out).join()).toContain('blue.jpg');
  });

  it('variant image keeps the owner alt text over the gallery alt', () => {
    leadImage = { url: 'https://cdn.test/blue.jpg', alt: 'Blå' };
    const out = one({ settings: { image_source: 'variant_image', aspect: 'square' }, content: { alt: 'Egen text' }, product: PRODUCT, builderPreview: false });
    leadImage = null;
    expect(imgAlts(out)).toEqual(['Egen text']);
  });

  it('missing product image: nothing live, hint in the builder', () => {
    const settings = { image_source: 'product_image_n', image_index: 5 };
    expect(one({ settings, product: PRODUCT, builderPreview: false })).toBe('');
    expect(one({ settings, product: PRODUCT, builderPreview: true })).toContain('data-dynamic-source-hint');
  });

  it('schema keeps source fields product-template only', () => {
    const f = singleImageSection.schema.schema.find((x) => x.key === 'image_source');
    expect(f?.pageTypes).toEqual(['PRODUCT_TEMPLATE']);
    expect(singleImageSection.needsBuilderPreview).toBe(true);
  });
});

describe('image-with-text schema', () => {
  it('offers the source fields on the product template only, as settings', () => {
    const fields = imageWithTextSection.schema.schema;
    for (const key of ['image_source', 'image_index']) {
      expect(fields.find((x) => x.key === key)?.pageTypes, key).toEqual(['PRODUCT_TEMPLATE']);
      expect(imageWithTextSection.schema.translatable).not.toContain(key);
    }
    expect(fields.find((x) => x.key === 'image')?.showIf).toEqual({ key: 'image_source', in: ['', 'static'] });
    expect(imageWithTextSection.defaultSettings).not.toHaveProperty('image_source');
  });
});
