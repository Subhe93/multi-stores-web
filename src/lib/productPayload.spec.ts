import { describe, expect, it } from 'vitest';
import { pickFieldTranslation } from '@multi-stores/core/personalization';
import { collectionDisplayName, resolvePrimaryCollectionPath } from './collectionPath';
import { pickTranslationRows, projectProductForClient } from './productPayload';

const rows = (...locales: string[]) =>
  locales.map((locale) => ({ id: `t-${locale}`, field_id: 'f1', locale, label: `label-${locale}` }));

// Client fallback chains (locale → primary → en → first) as the components use them.
const chain = (t: Array<{ locale: string }>, locale: string, primary: string) =>
  t.find((r) => r.locale === locale) || t.find((r) => r.locale === primary) || t.find((r) => r.locale === 'en') || t[0];
const chainNoPrimary = (t: Array<{ locale: string }>, locale: string) =>
  t.find((r) => r.locale === locale) || t.find((r) => r.locale === 'en') || t[0];
const chainFirst = (t: Array<{ locale: string }>, locale: string) => t.find((r) => r.locale === locale) || t[0];

describe('pickTranslationRows', () => {
  it('keeps locale, primary, en and the first row in order, without ids', () => {
    const out = pickTranslationRows(rows('de', 'en', 'sv', 'ar', 'fr'), 'fr', 'sv');
    expect(out.map((r) => r.locale)).toEqual(['de', 'en', 'sv', 'fr']);
    expect(out[0]).toEqual({ locale: 'de', label: 'label-de' });
  });

  it('every client fallback chain resolves to the same row', () => {
    const cases: Array<[string[], string, string]> = [
      [['en', 'sv', 'ar', 'de', 'fr', 'tr'], 'sv', 'sv'],
      [['en', 'sv', 'ar'], 'de', 'sv'],
      [['ar', 'tr'], 'de', 'sv'],
      [['tr', 'en'], 'de', 'sv'],
      [['sv'], 'en', 'sv'],
    ];
    for (const [locales, locale, primary] of cases) {
      const full = rows(...locales);
      const slim = pickTranslationRows(full, locale, primary);
      for (const pick of [
        (t: typeof full) => chain(t, locale, primary),
        (t: typeof full) => chainNoPrimary(t, locale),
        (t: typeof full) => chainFirst(t, locale),
        (t: typeof full) => pickFieldTranslation(t, locale, primary),
      ]) {
        expect(pick(slim)?.locale).toBe(pick(full)?.locale);
      }
    }
  });

  it('leaves non-array input untouched', () => {
    const map = { en: 'Home', sv: 'Hem' };
    expect(pickTranslationRows(map, 'sv', 'sv')).toBe(map);
    expect(pickTranslationRows(undefined, 'sv', 'sv')).toBeUndefined();
  });
});

describe('projectProductForClient', () => {
  const node = (slug: string, locales: string[]) => ({
    id: `c-${slug}`,
    slug,
    is_active: true,
    created_at: 'x',
    updated_at: 'x',
    visibility: 'PUBLIC',
    path: [slug],
    translations: locales.map((locale) => ({
      id: `ct-${locale}`,
      creator_category_id: `c-${slug}`,
      locale,
      name: `${slug}-${locale}`,
      meta_title: 'seo',
      meta_desc: 'seo',
    })),
  });
  const product = {
    id: 'p1',
    base_price: 199,
    created_at: 'x',
    creator_id: 'u1',
    tax_exempt: false,
    sku: 'SKU',
    designer: { template: { id: 'd1' } },
    translations: [
      { id: 'pt1', product_id: 'p1', locale: 'sv', title: 'Titel', meta_title: 'seo', slug: 'titel' },
      { id: 'pt2', product_id: 'p1', locale: 'en', title: 'Title', meta_title: 'seo', slug: 'title' },
      { id: 'pt3', product_id: 'p1', locale: 'de', title: 'Titel DE', slug: 'titel-de' },
    ],
    variants: [
      { id: 'v1', product_id: 'p1', price_adjustment: '0', stock_quantity: null, price: 199, stock: 999, is_active: true, options: { Färg: 'Röd' }, images: [] },
    ],
    custom_fields: [
      {
        id: 'f1',
        name: 'lead',
        type: 'TEXT',
        validation_rules: { max_length: 12 },
        translations: rows('en', 'sv', 'ar', 'de', 'fr', 'tr'),
        children: [{ id: 'f2', name: 'child', translations: rows('en', 'sv', 'tr') }],
      },
    ],
    faqs: [{ id: 'q1', translations: [{ locale: 'sv', question: 'Q', answer: 'A' }, { locale: 'tr', question: 'Q', answer: 'A' }] }],
    category: { translations: [{ locale: 'en', name: 'Gifts' }, { locale: 'ar', name: 'هدايا' }] },
    primary_collection_path: [node('root', ['sv', 'de']), node('leaf', ['sv'])],
    creator_categories: [node('a', ['sv']), node('b', ['sv'])],
    bundles: [{ id: 'b1', translations: rows('sv', 'de'), offers: [{ id: 'o1', translations: rows('de', 'sv') }] }],
    attributes: [{ id: 'a1', value: 'x', template: { translations: rows('sv', 'fr') } }],
    unknown_extra: { kept: true },
  };

  const out = projectProductForClient(product, 'sv', 'sv') as typeof product;

  it('does not mutate the input', () => {
    expect(product.translations).toHaveLength(3);
    expect(product.variants[0]).toHaveProperty('product_id');
  });

  it('drops unread top-level columns and keeps the rest (incl. unknown keys)', () => {
    expect(out).not.toHaveProperty('created_at');
    expect(out).not.toHaveProperty('creator_id');
    expect(out).not.toHaveProperty('tax_exempt');
    expect(out.sku).toBe('SKU');
    expect(out.unknown_extra).toEqual({ kept: true });
    expect(out.designer).toBe(product.designer);
  });

  it('prunes product translation rows to the render locales', () => {
    expect(out.translations).toEqual([
      { locale: 'sv', title: 'Titel', slug: 'titel' },
      { locale: 'en', title: 'Title', slug: 'title' },
    ]);
  });

  it('slims variants to the read columns', () => {
    expect(out.variants[0]).toEqual({ id: 'v1', price: 199, stock: 999, is_active: true, options: { Färg: 'Röd' }, images: [] });
  });

  it('prunes custom field rows recursively and keeps the definitions', () => {
    const f = out.custom_fields[0]!;
    expect(f.translations.map((t) => t.locale)).toEqual(['en', 'sv']);
    expect(f.validation_rules).toEqual({ max_length: 12 });
    expect(f.children[0]!.translations.map((t) => t.locale)).toEqual(['en', 'sv']);
  });

  it('prunes faqs, bundles, offers, attributes and category rows', () => {
    expect(out.faqs[0]!.translations.map((t) => t.locale)).toEqual(['sv']);
    expect(out.bundles[0]!.translations.map((t) => t.locale)).toEqual(['sv']);
    expect(out.bundles[0]!.offers[0]!.translations.map((t) => t.locale)).toEqual(['de', 'sv']);
    expect(out.attributes[0]!.template.translations.map((t) => t.locale)).toEqual(['sv']);
    expect(out.category.translations.map((t) => t.locale)).toEqual(['en']);
  });

  it('keeps the breadcrumb identical', () => {
    const names = (p: typeof product) => resolvePrimaryCollectionPath(p).map((n) => collectionDisplayName(n, 'sv'));
    expect(names(out)).toEqual(names(product));
    const noPath = { ...product, primary_collection_path: [] };
    expect(names(projectProductForClient(noPath, 'sv', 'sv'))).toEqual(names(noPath));
    expect(out.creator_categories).toHaveLength(1);
    expect(out.primary_collection_path[0]).not.toHaveProperty('created_at');
    expect(out.primary_collection_path[0]!.translations[0]).toEqual({ locale: 'sv', name: 'root-sv' });
  });
});
