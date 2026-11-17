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
import { classTokens, hrefs, physicalClasses } from './_shared/testHelpers';

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

// ── Edge-to-edge style, second button, alt text ──────────────────────────

const BLEED_SETTINGS = { image_style: 'bleed', image: '/uploads/pages/a.jpg', cta_url: '/products' };

describe('image-with-text new keys', () => {
  it('image_style framed and cta_tone primary equal unset', () => {
    for (const [, settings, content] of STATIC_CASES) {
      const base = html({ settings, content });
      expect(html({ settings: { ...settings, image_style: 'framed' }, content })).toBe(base);
      expect(html({ settings: { ...settings, cta_tone: 'primary' }, content })).toBe(base);
    }
  });

  it('second button only when it has a text', () => {
    const settings = { image: '/uploads/pages/a.jpg', cta_url: '/products', cta_secondary_url: '/about' };
    const one = html({ settings, content: CONTENT });
    expect(hrefs(one)).toEqual(['/products']);
    expect(one).not.toContain('flex flex-wrap gap-3');
    const two = html({ settings, content: { ...CONTENT, cta_secondary_text: 'Om oss' } });
    expect(hrefs(two)).toEqual(['/products', '/about']);
    expect(two).toContain('flex flex-wrap gap-3');
    expect(two).toContain('Om oss');
    // Alone, without a first button.
    const only = html({ settings, content: { heading: 'Gravyr', cta_secondary_text: 'Om oss' } });
    expect(hrefs(only)).toEqual(['/about']);
  });

  it('second button: outlined by default, overridable, localized on a secondary locale', () => {
    const settings = { image: '/uploads/pages/a.jpg', cta_secondary_url: '/about', cta_secondary_bg_color: '#00ff00' };
    const out = html({ settings, content: { ...CONTENT, cta_secondary_text: 'Om oss' }, locale: 'ar' });
    expect(hrefs(out)).toEqual(['#', '/ar/about']);
    expect(out).toContain('background-color:#00ff00');
    expect(out).toContain('border:1.5px solid var(--theme-colors-border)');
  });

  it('accent button colour', () => {
    const out = html({ settings: { image: '/uploads/pages/a.jpg', cta_tone: 'accent' }, content: CONTENT });
    expect(out).toContain('background-color:var(--theme-colors-accent);color:var(--theme-colors-accentContrast, #fff)');
  });

  it('alt text of the static image in both styles; empty by default', () => {
    expect(imgAlts(html({ settings: { image: '/uploads/pages/a.jpg' }, content: CONTENT }))).toEqual(['']);
    expect(imgAlts(html({ settings: { image: '/uploads/pages/a.jpg' }, content: { ...CONTENT, alt: 'Graverad ring' } }))).toEqual(['Graverad ring']);
    expect(imgAlts(html({ settings: BLEED_SETTINGS, content: { ...CONTENT, alt: 'Graverad ring' } }))).toEqual(['Graverad ring']);
    expect(imgAlts(html({ settings: BLEED_SETTINGS, content: CONTENT }))).toEqual(['']);
  });

  it('bleed: escapes to the viewport, no radius or shadow on the image', () => {
    const out = html({ settings: BLEED_SETTINGS, content: CONTENT });
    expect(out).toContain('data-bleed-split="bleed"');
    expect(out).toContain('width:100vw');
    expect(out).not.toContain('var(--theme-radius-lg)');
    expect(out).not.toContain('var(--theme-shadow-md)');
    expect(out).not.toContain('data-reveal');
    expect(out).toMatch(/<h2[^>]*>Gravyr<\/h2>/);
    // Hard edge and no tone by default.
    expect(out).not.toContain('linear-gradient');
    expect(out).toContain('background-color:transparent');
    expect(classTokens(out)).toEqual(expect.arrayContaining(['aspect-square', 'md:min-h-[480px]']));
    expect(physicalClasses(out)).toEqual([]);
  });

  it('bleed: position, min height, tone, soft edge and focus', () => {
    const out = html({
      settings: {
        ...BLEED_SETTINGS, image_position: 'right', aspect: 'landscape', min_height: 'lg',
        tone: 'surface', edge: 'soft', image_focus: 'top',
      },
      content: CONTENT,
    });
    expect(classTokens(out)).toEqual(expect.arrayContaining(['md:order-2', 'aspect-[4/3]', 'md:min-h-[600px]']));
    expect(out).toContain('background-color:var(--theme-colors-surface)');
    expect(out).toContain('linear-gradient(to right, var(--theme-colors-surface), transparent)');
    expect(out).toContain('object-position:center top');
    expect(classTokens(html({ settings: { ...BLEED_SETTINGS, min_height: 'sm' }, content: CONTENT }))).toContain('md:min-h-[360px]');
    expect(classTokens(html({ settings: BLEED_SETTINGS, content: CONTENT }))).not.toContain('md:order-2');
  });

  it('bleed: one or two buttons with localized links', () => {
    const settings = { ...BLEED_SETTINGS, cta_secondary_url: '/' };
    const content = { ...CONTENT, cta_secondary_text: 'Om oss' };
    expect(hrefs(html({ settings, content, locale: 'ar' }))).toEqual(['/ar/products', '/ar']);
    expect(hrefs(html({ settings, content }))).toEqual(['/products', '/']);
    expect(hrefs(html({ settings, content: CONTENT }))).toEqual(['/products']);
  });

  it('bleed is ignored with a dynamic image source', () => {
    const settings = { image_source: 'product_featured', image: '/uploads/pages/static.jpg' };
    const framed = html({ settings, content: CONTENT, product: PRODUCT, builderPreview: false });
    const bleed = html({ settings: { ...settings, image_style: 'bleed' }, content: CONTENT, product: PRODUCT, builderPreview: false });
    expect(bleed).toBe(framed);
    expect(bleed).not.toContain('data-bleed-split');
    expect(bleed).not.toContain('width:100vw');
  });

  it('bleed without an image: one contained text column; with nothing at all the framed upload box', () => {
    const out = html({ settings: { image_style: 'bleed' }, content: CONTENT });
    expect(out).toContain('data-bleed-split="contained"');
    expect(out).not.toContain('100vw');
    expect(out).not.toContain('Upload an image');
    expect(html({ settings: { image_style: 'bleed' }, content: {} })).toBe(html({ settings: {}, content: {} }));
  });

  it('bleed without an image in the builder: the image half stays as a placeholder box', () => {
    const out = html({ settings: { image_style: 'bleed' }, content: CONTENT, builderPreview: true });
    expect(out).toContain('data-bleed-split="bleed"');
    expect(out).toContain('data-bleed-placeholder');
    expect(out).not.toContain('<img');
    // Never on the live store, and never once an image is set.
    expect(html({ settings: { image_style: 'bleed' }, content: CONTENT, builderPreview: false })).not.toContain('data-bleed-placeholder');
    expect(html({ settings: BLEED_SETTINGS, content: CONTENT, builderPreview: true })).not.toContain('data-bleed-placeholder');
    // The framed style ignores the flag for a static image.
    for (const [, settings, content] of STATIC_CASES) {
      expect(html({ settings, content, builderPreview: true })).toBe(html({ settings, content }));
      expect(html({ settings, content, builderPreview: false })).toBe(html({ settings, content }));
    }
    expect(imageWithTextSection.needsBuilderPreview).toBe(true);
  });

  it('bleed eyebrow: letter-spacing is dropped in right-to-left; framed is untouched', () => {
    const tokens = classTokens(html({ settings: BLEED_SETTINGS, content: CONTENT }));
    expect(tokens).toContain('tracking-[0.2em]');
    expect(tokens).toContain('rtl:tracking-normal');
    expect(classTokens(html({ settings: { image: '/uploads/pages/a.jpg' }, content: CONTENT }))).not.toContain('rtl:tracking-normal');
  });

  it('schema: translatable keys, defaults and the new fields', () => {
    expect(imageWithTextSection.schema.translatable).toEqual(['eyebrow', 'heading', 'body', 'cta_text', 'cta_secondary_text', 'alt']);
    expect(imageWithTextSection.defaultSettings).toEqual({ image_position: 'left', aspect: 'square' });
    const fields = imageWithTextSection.schema.schema;
    const keys = fields.map((f) => f.key);
    expect(keys.indexOf('alt')).toBe(keys.indexOf('image') + 1);
    expect(keys.indexOf('image_style')).toBe(keys.indexOf('image_position') + 1);
    expect(keys.slice(-5)).toEqual([
      'cta_secondary_bg_color', 'cta_secondary_text_color', 'cta_secondary_border_color',
      'cta_secondary_border_width', 'cta_secondary_border_radius',
    ]);
    for (const key of ['min_height', 'image_focus', 'tone', 'bg_color', 'edge']) {
      expect(fields.find((f) => f.key === key)?.showIf, key).toEqual({ key: 'image_style', in: ['bleed'] });
    }
    // Stored values of the position are kept.
    expect(fields.find((f) => f.key === 'image_position')?.options?.map((o) => o.value)).toEqual(['left', 'right']);
  });
});
