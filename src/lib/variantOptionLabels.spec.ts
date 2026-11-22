import { describe, expect, it } from 'vitest';
import {
  formatOptionPairs,
  labelsForLocale,
  optionDisplayEntries,
  optionNameLabel,
  optionValueLabel,
  orderLineOptionsLabel,
  paletteValueLabel,
  readVariantOptionLabels,
  relabelOptionLines,
  type RelabelableLine,
} from './variantOptionLabels';
import { buildLineMetadata, variantLabel } from './cartLine';
import { cardSizes, cardSwatches } from './productCard/options';
import { toCardExtras } from './productCard/model';
import { normalizeFacetQuery, runFacets, toFacetRow } from './listingFilters/facetEngine';
import { pickTranslationRows } from './productPayload';
import { cardMeta } from '@/components/product/personalization/model';

// M159: option names / values in the page language (display only). Without
// labels every helper answers exactly what it answered before.

const DE = {
  names: { Färg: 'Farbe', Storlek: 'Größe' },
  values: { Färg: { Svart: 'Schwarz', Vit: 'Weiß' }, Storlek: { M: 'Mittel' } },
};
const ROWS = [
  { locale: 'sv', variant_option_labels: null },
  { locale: 'en', variant_option_labels: { names: { Färg: 'Colour' } } },
  { locale: 'de', variant_option_labels: DE },
];

describe('variantOptionLabels (mirror of the API module)', () => {
  it('parses defensively and picks exact / base-language rows only', () => {
    expect(readVariantOptionLabels({ names: { a: 1 } })).toBeNull();
    expect(labelsForLocale(ROWS, 'de')).toEqual(DE);
    expect(labelsForLocale(ROWS, 'de-AT')).toEqual(DE);
    expect(labelsForLocale(ROWS, 'fr')).toBeNull();
    expect(labelsForLocale(ROWS, 'sv')).toBeNull();
  });

  it('falls back to canonical strings', () => {
    expect(optionNameLabel(DE, 'Djur')).toBe('Djur');
    expect(optionValueLabel(DE, 'Färg', 'Röd')).toBe('Röd');
    expect(optionValueLabel(null, 'Färg', 'Svart')).toBe('Svart');
  });

  it('formats pairs in map order', () => {
    expect(formatOptionPairs(optionDisplayEntries({ Färg: 'Svart', Storlek: 'L' }, DE))).toBe('Farbe: Schwarz / Größe: L');
  });

  it('reads the order display snapshot', () => {
    const snap = {
      locale: 'de',
      entries: [{ name: 'Färg', value: 'Svart', name_label: 'Farbe', value_label: 'Schwarz' }],
    };
    expect(orderLineOptionsLabel(snap)).toBe('Farbe: Schwarz');
    expect(orderLineOptionsLabel(null)).toBeNull();
    expect(orderLineOptionsLabel({ locale: 'de', entries: [] })).toBeNull();
  });

  it('relabels OPTION lines only; values and primary-locale texts stay canonical', () => {
    const line: RelabelableLine = {
      source: 'OPTION',
      label: 'Färg',
      value: 'Svart',
      display_value: 'Svart',
      field_name: 'Färg',
      meta: { option_name: 'Färg' },
      i18n: { label: { sv: 'Färg' }, display_value: { sv: 'Svart' }, group_label: null },
    };
    const field = { ...line, source: 'FIELD' };
    const [o, f] = relabelOptionLines([line, field], DE, 'de', 'sv');
    expect(o).toMatchObject({ label: 'Farbe', display_value: 'Schwarz', value: 'Svart', field_name: 'Färg' });
    expect(o.i18n?.label).toEqual({ sv: 'Färg', de: 'Farbe' });
    expect(f).toBe(field);
    expect(relabelOptionLines([line], DE, 'sv', 'sv')[0]).toBe(line);
  });
});

describe('cart line label', () => {
  it('translated with labels, exactly today without', () => {
    expect(variantLabel({ Färg: 'Svart', Storlek: 'M' }, DE)).toBe('Farbe: Schwarz / Größe: Mittel');
    expect(variantLabel({ Färg: 'Svart', Storlek: 'M' })).toBe('Färg: Svart / Storlek: M');
    const base = { title: 'Tasse', unitPrice: 10, variantOptions: { Färg: 'Svart' } };
    expect(buildLineMetadata(base)).toEqual(buildLineMetadata({ ...base, optionLabels: null }));
    expect(buildLineMetadata({ ...base, optionLabels: DE }).variant).toBe('Farbe: Schwarz');
  });
});

describe('product card swatches and sizes', () => {
  const row = {
    id: 'p1',
    variants: [
      { options: { Färg: 'Svart', Storlek: 'M' }, stock: 5 },
      { options: { Färg: 'Vit', Storlek: 'L' }, stock: 5 },
    ],
    variant_option_config: [{ name: 'Färg', style: 'color', colorMap: { Svart: '#000', Vit: '#fff' } }],
    translations: ROWS,
  };
  it('carries labels only when the value has one; keys stay canonical', () => {
    const sw = cardSwatches(row, DE)!;
    expect(sw.items.map((s) => [s.value, s.label])).toEqual([
      ['Svart', 'Schwarz'],
      ['Vit', 'Weiß'],
    ]);
    const sizes = cardSizes(row, DE)!;
    expect(sizes.items).toEqual([
      { value: 'M', available: true, label: 'Mittel' },
      { value: 'L', available: true },
    ]);
  });
  it('without labels / locale: the same model as before', () => {
    expect(toCardExtras(row)).toEqual(toCardExtras(row, 'sv'));
    expect(cardSwatches(row)!.items.every((s) => !('label' in s))).toBe(true);
    expect(toCardExtras(row, 'de').sizes!.items[0]).toMatchObject({ label: 'Mittel' });
  });
  it('custom product row: labels from the base product rows', () => {
    const custom = { ...row, translations: [{ locale: 'de', title: 'T' }] };
    expect(toCardExtras(custom, 'de').sizes!.items[0]).not.toHaveProperty('label');
    expect(toCardExtras({ ...custom, option_label_translations: [ROWS[2]] }, 'de').sizes!.items[0]).toMatchObject({
      label: 'Mittel',
    });
    expect(toCardExtras({ ...custom, product: { translations: ROWS } }, 'de').swatches!.items[0]).toMatchObject({
      label: 'Schwarz',
    });
  });
});

describe('dev listing facets (parity with the API)', () => {
  const src = {
    kind: 'p' as const,
    id: 'p1',
    created_at: new Date(0),
    price: 10,
    category_id: null,
    links: [],
    track_inventory: false,
    stock_quantity: null,
    variants: [{ options: { Färg: 'Svart', Storlek: 'M' }, stock_quantity: 1 }],
    variant_option_config: null,
  };
  it('translated labels, canonical values', () => {
    const r = toFacetRow({ ...src, optionLabels: DE });
    expect([...r.colorLabels]).toEqual([['svart', 'Schwarz']]);
    expect(r.variants[0]).toMatchObject({ color: 'svart', size: 'm' });
    expect(toFacetRow(src)).toEqual(toFacetRow({ ...src, optionLabels: null }));
  });
  it('merged rows: a translated label wins whatever the list order', () => {
    const plain = toFacetRow({ ...src, id: 'p0' });
    const labelled = toFacetRow({ ...src, optionLabels: DE });
    const run = (rows: ReturnType<typeof toFacetRow>[]) =>
      runFacets({ rows, filters: normalizeFacetQuery({}).filters, collections: [], categories: [] }, true).facets!;
    for (const rows of [
      [plain, labelled],
      [labelled, plain],
    ]) {
      expect(run(rows).color).toEqual([expect.objectContaining({ value: 'svart', label: 'Schwarz' })]);
      expect(run(rows).size).toEqual([expect.objectContaining({ value: 'm', label: 'Mittel' })]);
    }
    expect(run([plain]).color[0]!.label).toBe('Svart');
  });
});

describe('palette field from a product option (pieces 2..N)', () => {
  const def = (ownDe?: Record<string, string>) => ({
    id: 'c-color',
    type: 'COLOR_PALETTE',
    ui: { palette_from_option: 'Färg' },
    translations: ownDe ? [{ locale: 'de', option_labels: ownDe }] : [],
  });
  const line: RelabelableLine = {
    source: 'FIELD',
    field_id: 'c-color',
    label: 'Färg',
    value: 'Svart',
    display_value: 'Svart',
    field_name: 'Färg',
    meta: null,
    i18n: { label: null, display_value: null, group_label: null },
  };
  it('uses the option label unless the field has its own', () => {
    expect(paletteValueLabel(def(), DE, 'de', 'Svart')).toBe('Schwarz');
    expect(paletteValueLabel(def({ Svart: 'Tief' }), DE, 'de', 'Svart')).toBeNull();
    expect(paletteValueLabel({ ...def(), ui: {} }, DE, 'de', 'Svart')).toBeNull();
    expect(paletteValueLabel(def(), DE, 'de', 'Röd')).toBeNull();
  });
  it('relabels the FIELD line like the API; value stays canonical', () => {
    const [l] = relabelOptionLines([line], DE, 'de', 'sv', [def()]);
    expect(l).toMatchObject({ value: 'Svart', display_value: 'Schwarz' });
    expect(l!.i18n?.display_value).toEqual({ sv: 'Svart', de: 'Schwarz' });
    expect(relabelOptionLines([line], DE, 'de', 'sv')[0]).toBe(line);
  });
});

describe('client payload keeps the labels', () => {
  it('the translation row keeps variant_option_labels and the base-language row', () => {
    const rows = [
      { id: 't1', product_id: 'p', locale: 'sv', title: 'A', variant_option_labels: null },
      { id: 't2', product_id: 'p', locale: 'de', title: 'B', variant_option_labels: DE },
    ];
    const kept = pickTranslationRows(rows, 'de-AT', 'sv') as Record<string, unknown>[];
    expect(kept.map((r) => r.locale)).toEqual(['sv', 'de']);
    expect(kept[1].variant_option_labels).toEqual(DE);
    expect('id' in kept[1]).toBe(false);
  });
});

describe('variation card label chain', () => {
  const config = {
    name: 'Välj antal',
    style: 'card',
    valueMeta: {
      '1 produkt': { label: '1 st', i18n: { fr: { label: '1 pièce' } } },
    },
  };
  it('locale card label > option label > primary card label > value', () => {
    expect(cardMeta(config as never, '1 produkt', 'fr', 'sv', '1 produit').label).toBe('1 pièce');
    expect(cardMeta(config as never, '1 produkt', 'de', 'sv', '1 Produkt').label).toBe('1 Produkt');
    expect(cardMeta(config as never, '1 produkt', 'de', 'sv', '1 produkt').label).toBe('1 st');
    expect(cardMeta(config as never, '1 produkt', 'de', 'sv').label).toBe('1 st');
    expect(cardMeta(config as never, '1 produkt', 'sv', 'sv', 'x').label).toBe('1 st');
  });
});
