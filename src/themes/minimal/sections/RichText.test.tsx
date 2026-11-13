import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { ProductContext, SectionRenderProps } from '../../types';
import { richTextSection } from './RichText';

const RichText = richTextSection.Component;

function html(props: Partial<SectionRenderProps> & { settings: Record<string, unknown>; content?: Record<string, unknown> }) {
  return renderToStaticMarkup(
    <RichText locale="sv" primaryLocale="sv" storeSlug="namez-se" content={{}} {...props} />,
  );
}

const CONTENT = {
  eyebrow: 'Om oss',
  heading: 'Personliga presenter',
  html: '<p>Vi gör <a href="/kontakta-oss">unika</a> presenter.</p>',
};

// Settings as stored today (no content_source key). The output of these
// must stay byte-identical across the dynamic-source change: the snapshots
// were recorded before RichText.tsx was edited.
const STATIC_CASES: Array<[string, Record<string, unknown>, Record<string, unknown>]> = [
  ['empty settings', {}, CONTENT],
  ['palette defaults', { ...richTextSection.defaultSettings }, CONTENT],
  ['product template text (full width, no padding)', { width: 'full', alignment: 'left', padding: 'none', surface: false }, CONTENT],
  ['centered card with heading levels', { width: 'narrow', alignment: 'center', padding: 'large', surface: true, heading_level: 'h3', eyebrow_tag: 'h4' }, CONTENT],
  ['body only', { width: 'wide', padding: 'small' }, { html: '<p>Bara text</p>' }],
  ['nothing set', {}, {}],
];

describe('rich-text static output (unchanged)', () => {
  for (const [name, settings, content] of STATIC_CASES) {
    it(name, () => {
      expect(html({ settings, content })).toMatchSnapshot();
    });
    it(`${name} with an explicit static source matches`, () => {
      expect(html({ settings: { ...settings, content_source: 'static' }, content })).toBe(html({ settings, content }));
    });
  }
});

// ── Dynamic content source (PRODUCT_TEMPLATE) ───────────────────────────

const PRODUCT: ProductContext = {
  id: 'p1',
  base_price: 100,
  translations: [
    { locale: 'sv', title: 'Mugg <med namn>', description: '<p>Beskrivning <strong>sv</strong></p>', short_description: '<p>Kort sv</p>' },
    { locale: 'en', title: 'Mug', description: '<p>Description en</p>', short_description: '' },
  ],
  images: [],
  attributes: [
    { id: 'a1', value: 'Keramik', template: { name: 'material', type: 'TEXT', translations: [{ locale: 'sv', label: 'Material' }] } },
    { id: 'a2', value: true, template: { name: 'dishwasher', type: 'BOOLEAN', translations: [{ locale: 'en', label: 'Dishwasher safe' }] } },
    { id: 'a3', value: 330, template: { name: 'volume', type: 'NUMBER', unit: 'ml', translations: [] } },
  ],
};

function dyn(source: string, extra: Partial<SectionRenderProps> = {}, settings: Record<string, unknown> = {}) {
  return html({ settings: { content_source: source, ...settings }, content: { heading: 'Rubrik' }, product: PRODUCT, builderPreview: false, ...extra });
}

describe('rich-text dynamic content source', () => {
  it('renders the product description of the page locale', () => {
    const out = dyn('product_description');
    expect(out).toContain('<p>Beskrivning <strong>sv</strong></p>');
    expect(out).toContain('data-dynamic-source="product_description"');
    expect(out).toContain('Rubrik');
    expect(out).not.toContain('Om oss');
  });

  it('falls back to the first translation for a locale without a row', () => {
    expect(dyn('product_description', { locale: 'de' })).toContain('Beskrivning');
  });

  it('renders the short description', () => {
    expect(dyn('product_short_description')).toContain('<p>Kort sv</p>');
  });

  it('renders the title as text, never as HTML', () => {
    const out = dyn('product_title');
    expect(out).toContain('Mugg &lt;med namn&gt;');
    expect(out).not.toContain('<med namn>');
  });

  it('renders the specifications table with labels and formatted values', () => {
    const out = dyn('product_specifications');
    expect(out).toContain('<table');
    expect(out).toContain('Material');
    expect(out).toContain('Keramik');
    expect(out).toContain('Dishwasher safe');
    expect(out).toContain('>Ja<');
    expect(out).toContain('330 ml');
    expect(out).toContain('volume');
  });

  it('renders one attribute by name or label', () => {
    expect(dyn('product_attribute', {}, { attribute_key: 'Material' })).toContain('Keramik');
    expect(dyn('product_attribute', {}, { attribute_key: 'volume' })).toContain('330 ml');
  });

  it('ignores the static html when a source is set', () => {
    const out = html({
      settings: { content_source: 'product_description' },
      content: { html: '<p>STATIC</p>' },
      product: PRODUCT,
      builderPreview: false,
    });
    expect(out).not.toContain('STATIC');
  });

  it('live store, missing field: keeps the heading and no empty body', () => {
    const out = dyn('product_short_description', { locale: 'en', product: { ...PRODUCT, translations: [PRODUCT.translations[1]] } });
    expect(out).toContain('Rubrik');
    expect(out).not.toContain('data-dynamic-source');
    expect(out).not.toContain('data-dynamic-source-hint');
  });

  it('live store, missing field and no heading: renders nothing', () => {
    expect(
      html({ settings: { content_source: 'product_attribute', attribute_key: 'nope' }, product: PRODUCT, builderPreview: false }),
    ).toBe('');
    // Placed outside a product page (no product).
    expect(html({ settings: { content_source: 'product_description' }, builderPreview: false })).toBe('');
    // A direct render without the builder flag counts as the live store.
    expect(html({ settings: { content_source: 'product_description' } })).toBe('');
  });

  it('builder preview, missing field: shows a hint', () => {
    const out = html({ settings: { content_source: 'product_attribute', attribute_key: 'nope' }, product: PRODUCT, builderPreview: true });
    expect(out).toContain('data-dynamic-source-hint="product_attribute"');
    expect(out).toContain('Dynamic: product attribute');
    const ar = html({ locale: 'ar', settings: { content_source: 'product_description' }, builderPreview: true });
    expect(ar).toContain('ديناميكي: وصف المنتج');
  });

  it('treats an unknown source as static', () => {
    const settings = { content_source: 'bogus' };
    expect(html({ settings, content: CONTENT })).toBe(html({ settings: {}, content: CONTENT }));
  });
});

describe('rich-text schema', () => {
  const fields = richTextSection.schema.schema;
  it('offers the source fields on the product template only, as settings', () => {
    for (const key of ['content_source', 'attribute_key']) {
      const f = fields.find((x) => x.key === key);
      expect(f?.pageTypes, key).toEqual(['PRODUCT_TEMPLATE']);
      expect(richTextSection.schema.translatable).not.toContain(key);
    }
    expect(fields.find((x) => x.key === 'html')?.showIf).toEqual({ key: 'content_source', in: ['', 'static'] });
    expect(richTextSection.defaultSettings).not.toHaveProperty('content_source');
  });
});
