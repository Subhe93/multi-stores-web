import { describe, expect, it } from 'vitest';
import { compileAllowedChars, lineKey, truncateChars, type PFieldDef, type POptionConfig } from '@/lib/personalization';
import { filterAllowedChars } from '@/lib/personalization/form';
import { addGuestLine } from '@/lib/guestCart';
import {
  activeOptionValues,
  cardMeta,
  cardPrice,
  DEFAULT_BADGE_COLOR,
  DEFAULT_PERSONALIZATION_SETTINGS,
  displayLength,
  errorKey,
  errorMessages,
  evaluateForm,
  fieldKey,
  fieldText,
  formContext,
  freeShippingReached,
  groupHeading,
  hasAdvancedFields,
  linesToDisplay,
  needsPersonalization,
  placementOf,
  pruneHidden,
  readApiPersonalizationErrors,
  readPersonalizationSettings,
  readProductPersonalization,
  repeaterItems,
  splitDisplay,
  summaryMessages,
  textLimits,
  visibleFieldsAt,
  withChildValue,
} from './model';

// ── Fixtures (namez presets P1, P3, P4, P5 in storefront tree shape) ──────

const t = (key: string, params?: Record<string, string | number>) =>
  params ? `${key}${JSON.stringify(params)}` : key;

const name1: PFieldDef = {
  id: 'n1',
  name: 'name_1',
  type: 'TEXT',
  is_required: true,
  sort_order: 0,
  validation_rules: { max_length: 11, allowed_chars: 'A-Za-z❤' },
  ui: { placement: 'before_variants', transform: 'uppercase', counter: true },
  translations: [
    {
      locale: 'sv',
      label: 'Första texten',
      placeholder: 'KRISTOFER',
      sublabel: 'Använd texten med flest bokstäver här',
      help_text: 'Exempel:\nPATRIK',
      messages: { required: 'Ange ett värde för Första texten.' },
    },
    { locale: 'en', label: 'First text', help_image_url: '/uploads/imports/left.jpg' },
  ],
};
const name2: PFieldDef = {
  id: 'n2',
  name: 'name_2',
  type: 'TEXT',
  is_required: true,
  sort_order: 1,
  validation_rules: { max_length: 11, allowed_chars: 'A-Za-z❤' },
  linked_validation: { type: 'equal_length', target: 'name_1', fill_char: '❤' },
  ui: { placement: 'before_variants', transform: 'uppercase', counter: 'linked', insert_char: '❤', limit_to_target: true },
  translations: [
    {
      locale: 'sv',
      label: 'Andra texten',
      messages: { required: 'Ange ett värde för Andra texten.', equal_length: 'Längderna stämmer inte överens!' },
    },
  ],
};

const leadName: PFieldDef = {
  id: 'lead',
  name: 'custom_name_v3',
  type: 'TEXT',
  is_required: true,
  sort_order: 0,
  validation_rules: { max_length: 12, allowed_chars: 'A-Za-zÅÄÖåäö0-9' },
  ui: { placement: 'after_variants' },
  translations: [{ locale: 'sv', label: 'Skriv namn här:', display_label: 'Namn', messages: { required: 'Vänligen skriv ett namn.' } }],
};
const repeater: PFieldDef = {
  id: 'rep',
  name: 'dnc_items',
  type: 'REPEATER',
  is_required: false,
  sort_order: 1,
  repeat: { count: { option: 'Välj antal' }, start_index: 2, max: 5, lead: { fields: ['custom_name_v3'], options: ['Färg'] } },
  ui: { placement: 'after_variants', validation_summary: true },
  translations: [{ locale: 'sv', label: 'Artikel {i}' }],
  children: [
    {
      id: 'c-color',
      name: 'color',
      type: 'COLOR_PALETTE',
      is_required: true,
      parent_id: 'rep',
      sort_order: 0,
      ui: { palette_from_option: 'Färg' },
      translations: [{ locale: 'sv', label: 'Färg', messages: { required: 'Artikel {i}: Färg måste väljas' } }],
    },
    {
      id: 'c-name',
      name: 'name',
      type: 'TEXT',
      is_required: true,
      parent_id: 'rep',
      sort_order: 1,
      validation_rules: { max_length: 12 },
      translations: [{ locale: 'sv', label: 'Skriv namn här:', display_label: 'Namn' }],
    },
  ],
};
const p3: PFieldDef[] = [leadName, repeater];
const optionConfig: POptionConfig[] = [
  { name: 'Välj antal', values: ['1 produkt', '2 produkter', '3 produkter'] },
  { name: 'Färg', values: ['Röd', 'Blå', 'Olivgrön'], colorMap: { Röd: '#dd3333', Blå: '#3333dd', Olivgrön: '#556b2f' } },
];
const ctxFor = (selections: Record<string, string>) =>
  formContext({
    selections,
    optionConfig,
    activeOptionValues: { Färg: ['Röd', 'Blå'] },
    locale: 'sv',
    primaryLocale: 'sv',
  });

const plainField: PFieldDef = {
  id: 'plain',
  name: 'note',
  type: 'TEXT',
  is_required: false,
  sort_order: 0,
  translations: [{ locale: 'en', label: 'Note' }],
};

// ── Payload blocks ─────────────────────────────────────────────────────────

describe('payload readers', () => {
  it('reads product.personalization only when enabled', () => {
    expect(readProductPersonalization(undefined)).toBeNull();
    expect(readProductPersonalization({ enabled: false })).toBeNull();
    expect(readProductPersonalization({ enabled: true, free_shipping_threshold: 499, currency: 'SEK' })).toEqual({
      enabled: true,
      free_shipping_threshold: 499,
      currency: 'SEK',
    });
    expect(readProductPersonalization({ enabled: true, free_shipping_threshold: null })?.free_shipping_threshold).toBeNull();
    expect(readProductPersonalization({ enabled: true, free_shipping_threshold: -1 })?.free_shipping_threshold).toBeNull();
  });

  it('reads settings leniently with defaults', () => {
    expect(readPersonalizationSettings(undefined)).toEqual(DEFAULT_PERSONALIZATION_SETTINGS);
    expect(
      readPersonalizationSettings({
        free_shipping_badge: false,
        card_price_mode: 'from',
        validation_summary: false,
        url_prefill: { name1: 'name_1', color: 'option:Färg', bad: 3, '': 'x' },
        listing_cta: 'personalize',
      }),
    ).toEqual({
      free_shipping_badge: false,
      card_price_mode: 'from',
      validation_summary: false,
      url_prefill: { name1: 'name_1', color: 'option:Färg' },
      listing_cta: 'personalize',
    });
    expect(readPersonalizationSettings({ card_price_mode: 'weird' }).card_price_mode).toBe('selection');
  });

  it('needsPersonalization requires the block and fields', () => {
    expect(needsPersonalization({ personalization: { enabled: true }, custom_fields: [leadName] })).toBe(true);
    expect(needsPersonalization({ personalization: { enabled: true }, custom_fields: [] })).toBe(false);
    expect(needsPersonalization({ custom_fields: [leadName] })).toBe(false);
  });
});

describe('field tree', () => {
  it('detects M4.1 features (app form only for them)', () => {
    expect(hasAdvancedFields([plainField])).toBe(false);
    expect(hasAdvancedFields([])).toBe(false);
    expect(hasAdvancedFields(null)).toBe(false);
    expect(hasAdvancedFields([plainField, leadName])).toBe(true);
    expect(hasAdvancedFields([{ ...plainField, children: [{ ...plainField, id: 'c' }] }])).toBe(true);
  });

  it('placement defaults to after the variants', () => {
    expect(placementOf(name1)).toBe('before_variants');
    expect(placementOf(plainField)).toBe('after_variants');
    expect(visibleFieldsAt([name1, name2, plainField], ['n1', 'n2', 'plain'], 'before_variants').map((d) => d.id)).toEqual([
      'n1',
      'n2',
    ]);
  });

  it('keys repeater children by item index', () => {
    expect(fieldKey('rep', 2, 'c-name')).toBe('rep#2#c-name');
    expect(fieldKey('n1')).toBe('n1');
    expect(errorKey({ field_id: 'rep', group_index: 3, child_id: 'c-color' })).toBe('rep#3#c-color');
    expect(errorKey({ field_id: '' })).toBe('_form');
  });

  it('collects option values of active variants', () => {
    expect(
      activeOptionValues([
        { options: { Färg: 'Röd', Storlek: 'S' } },
        { options: { Färg: 'Blå', Storlek: 'S' } },
        { options: { Färg: 'Olivgrön', Storlek: 'M' }, is_active: false },
      ]),
    ).toEqual({ Färg: ['Röd', 'Blå'], Storlek: ['S'] });
  });
});

describe('texts', () => {
  it('uses one translation row; the help image falls back through the chain', () => {
    const sv = fieldText(name1, 'sv', 'sv');
    expect(sv.label).toBe('Första texten');
    expect(sv.sublabel).toBe('Använd texten med flest bokstäver här');
    expect(sv.helpText).toBe('Exempel:\nPATRIK');
    expect(sv.helpImageUrl).toBe('/uploads/imports/left.jpg');
    expect(fieldText(name1, 'en', 'sv').label).toBe('First text');
    expect(fieldText(plainField, 'de', 'fr').label).toBe('Note');
  });

  it('item heading from the repeater label template, else i18n', () => {
    expect(groupHeading(repeater, 3, 'sv', 'sv', t)).toBe('Artikel 3');
    expect(groupHeading({ ...repeater, translations: [] }, 2, 'sv', 'sv', t)).toBe('personalization.itemN{"i":2}');
  });
});

// ── TextField rules ────────────────────────────────────────────────────────

describe('text limits (TextField)', () => {
  it('own counter, max and uppercase for name_1', () => {
    const l = textLimits(name1, [name1, name2], {});
    expect(l).toMatchObject({ max: 11, counter: 'own', uppercase: true, insertChar: null, targetLength: null });
  });

  it('name_2: max = length of name_1, linked counter, ❤ button', () => {
    const l = textLimits(name2, [name1, name2], { n1: 'kristofer' });
    expect(l).toMatchObject({ max: 9, targetLength: 9, counter: 'linked', insertChar: '❤' });
    // No target value yet: the field's own max.
    expect(textLimits(name2, [name1, name2], {}).max).toBe(11);
  });

  it('sanitises with allowed_chars and cuts at the max in code points', () => {
    const l = textLimits(name1, [name1], {});
    const kept = filterAllowedChars('Kåre 1❤️x', l.allowed);
    expect(kept).toBe('Kre❤️x');
    expect(truncateChars('❤❤KARIN❤❤XX', 9)).toBe('❤❤KARIN❤❤');
    expect(displayLength('  ❤️ab ')).toBe(3);
    expect(compileAllowedChars('A-Za-z❤')?.test('❤')).toBe(true);
  });
});

// ── Evaluation, errors, pruning ────────────────────────────────────────────

describe('app form evaluation (P3 name + colour per item)', () => {
  it('quantity 1 → no items, only the lead name', () => {
    const res = evaluateForm(p3, { lead: 'Åsa' }, ctxFor({ 'Välj antal': '1 produkt', Färg: 'Röd' }));
    expect(res.ok).toBe(true);
    expect(res.values).toEqual({ lead: 'Åsa' });
  });

  it('quantity 3 → items 2..3 with keyed, creator-worded errors', () => {
    const ctx = ctxFor({ 'Välj antal': '3 produkter', Färg: 'Röd' });
    const values = { lead: 'Åsa', rep: [{ 'c-color': 'Blå', 'c-name': 'Karin' }] };
    const res = evaluateForm(p3, values, ctx);
    expect(res.ok).toBe(false);
    const messages = errorMessages(res.errors, p3, 'sv', 'sv', t);
    expect(messages['rep#3#c-color']).toBe('Artikel 3: Färg måste väljas');
    // No creator message → i18n with the child's label.
    expect(messages['rep#3#c-name']).toBe('errors.CUSTOM_FIELD_REQUIRED{"label":"Skriv namn här:"}');
    const summary = summaryMessages(res.errors, p3, 'sv', 'sv', t);
    expect(summary.map((s) => s.text)).toEqual([
      'Artikel 3: Färg måste väljas',
      'Artikel 3: errors.CUSTOM_FIELD_REQUIRED{"label":"Skriv namn här:"}',
    ]);
  });

  it('a colour the product does not sell is refused (olivgrön)', () => {
    const ctx = ctxFor({ 'Välj antal': '2 produkter', Färg: 'Röd' });
    const res = evaluateForm(p3, { lead: 'Åsa', rep: [{ 'c-color': 'Olivgrön', 'c-name': 'Karin' }] }, ctx);
    expect(res.errors.map((e) => [errorKey(e), e.code])).toEqual([['rep#2#c-color', 'CUSTOM_FIELD_INVALID_OPTION']]);
  });

  it('lines → grouped cart display (lead item 1 with the option, hex)', () => {
    const ctx = ctxFor({ 'Välj antal': '2 produkter', Färg: 'Röd' });
    const res = evaluateForm(p3, { lead: 'Åsa', rep: [{ 'c-color': 'Blå', 'c-name': 'Karin' }] }, ctx);
    expect(res.ok).toBe(true);
    const display = linesToDisplay(res.lines);
    expect(display).toEqual([
      { id: 'lead#1', label: 'Namn', value: 'Åsa', display: null, source: 'FIELD', group_key: 'dnc_items', group_index: 1, group_label: 'Artikel 1' },
      {
        id: 'option:Färg#1',
        label: 'Färg',
        value: 'Röd',
        display: null,
        source: 'OPTION',
        group_key: 'dnc_items',
        group_index: 1,
        group_label: 'Artikel 1',
        hex: '#dd3333',
      },
      {
        id: 'c-color#2',
        label: 'Färg',
        value: 'Blå',
        display: null,
        source: 'FIELD',
        group_key: 'dnc_items',
        group_index: 2,
        group_label: 'Artikel 2',
        hex: '#3333dd',
      },
      { id: 'c-name#2', label: 'Namn', value: 'Karin', display: null, source: 'FIELD', group_key: 'dnc_items', group_index: 2, group_label: 'Artikel 2' },
    ]);
    const split = splitDisplay(display, (d) => String(d.value), (i) => `Item ${i}`);
    expect(split.flat).toEqual([]);
    expect(split.groups.map((g) => [g.label, g.entries.map((e) => e.value).join(' · ')])).toEqual([
      ['Artikel 1', 'Åsa · Röd'],
      ['Artikel 2', 'Blå · Karin'],
    ]);
  });

  it('prunes items beyond the count and hidden fields', () => {
    const ctx = ctxFor({ 'Välj antal': '2 produkter' });
    const values = { lead: 'Åsa', rep: [{ 'c-name': 'A' }, { 'c-name': 'B' }] };
    const res = evaluateForm(p3, values, ctx);
    expect(pruneHidden(values, p3, res, ctx)).toEqual({ lead: 'Åsa', rep: [{ 'c-name': 'A' }] });
    // Nothing to prune → null (no state update).
    const kept = { lead: 'Åsa', rep: [{ 'c-name': 'A' }] };
    expect(pruneHidden(kept, p3, evaluateForm(p3, kept, ctx), ctx)).toBeNull();

    const engraving: PFieldDef = {
      id: 'f3',
      name: 'field_3_v2',
      type: 'TEXT',
      is_required: true,
      sort_order: 0,
      conditions: { match: 'all', rules: [{ source: 'option', key: 'Antal inskriptioner', op: 'gte', value: 3 }] },
    };
    const ctx2 = formContext({ selections: { 'Antal inskriptioner': '2 Inskriptioner' }, locale: 'sv', primaryLocale: 'sv' });
    const v2 = { f3: 'HEJ' };
    const r2 = evaluateForm([engraving], v2, ctx2);
    expect(r2.values).toEqual({});
    expect(pruneHidden(v2, [engraving], r2, ctx2)).toEqual({});
  });

  it('sets a child value at an item position', () => {
    let v: Record<string, unknown> = {};
    v = withChildValue(v, 'rep', 1, 'c-name', 'B');
    expect(v).toEqual({ rep: [{}, { 'c-name': 'B' }] });
    v = withChildValue(v, 'rep', 1, 'c-name', '');
    expect(repeaterItems(v, 'rep')).toEqual([{}, {}]);
  });
});

describe('API errors', () => {
  it('reads PERSONALIZATION_INVALID {errors}', () => {
    const err = Object.assign(new Error('x'), {
      code: 'PERSONALIZATION_INVALID',
      errors: [
        { code: 'CUSTOM_FIELD_REQUIRED', field_id: 'rep', field_name: 'dnc_items', child_id: 'c-name', group_index: 2, message: '' },
        { nope: true },
      ],
    });
    expect(readApiPersonalizationErrors(err)).toEqual([
      { code: 'CUSTOM_FIELD_REQUIRED', field_id: 'rep', field_name: 'dnc_items', child_id: 'c-name', group_index: 2, message: '' },
    ]);
    expect(readApiPersonalizationErrors({ code: 'CUSTOM_FIELD_REQUIRED' })).toBeNull();
    expect(readApiPersonalizationErrors(null)).toBeNull();
  });
});

// ── Guest line key ─────────────────────────────────────────────────────────

describe('guest cart line key (canonical values)', () => {
  it('different personalization splits, identical merges', () => {
    const ctx = ctxFor({ 'Välj antal': '2 produkter', Färg: 'Röd' });
    const a = evaluateForm(p3, { rep: [{ 'c-name': 'Karin', 'c-color': 'Blå' }], lead: 'Åsa' }, ctx).values;
    const b = evaluateForm(p3, { lead: ' Åsa ', rep: [{ 'c-color': 'Blå', 'c-name': 'Karin' }] }, ctx).values;
    const c = evaluateForm(p3, { lead: 'Åsa', rep: [{ 'c-color': 'Blå', 'c-name': 'Emma' }] }, ctx).values;
    expect(lineKey(a)).toBe(lineKey(b));
    expect(lineKey(a)).not.toBe(lineKey(c));
    let cart = addGuestLine([], 'p1', 'v1', 1, a, { price: 299 }, () => 'l1');
    cart = addGuestLine(cart, 'p1', 'v1', 1, b, { price: 299 }, () => 'l2');
    cart = addGuestLine(cart, 'p1', 'v1', 1, c, { price: 299 }, () => 'l3');
    expect(cart.map((l) => [l.id, l.quantity])).toEqual([
      ['l1', 2],
      ['l3', 1],
    ]);
  });
});

// ── Variation cards ────────────────────────────────────────────────────────

describe('variation cards', () => {
  const variants = [
    { id: 'a', price: 275, options: { 'Välj antal': '1 produkt', Färg: 'Röd' } },
    { id: 'b', price: 499, options: { 'Välj antal': '2 produkter', Färg: 'Röd' } },
    { id: 'c', price: 519, options: { 'Välj antal': '2 produkter', Färg: 'Blå' } },
    { id: 'd', price: 699, options: { 'Välj antal': '3 produkter', Färg: 'Röd' }, is_active: false },
  ];
  const names = ['Välj antal', 'Färg'];

  it('price of the variant matching the other picks', () => {
    expect(cardPrice(variants, 'Välj antal', '2 produkter', { Färg: 'Blå' }, names, 'selection')).toEqual({ price: 519, from: false });
  });

  it('"from" the minimum when the other picks are open and prices differ', () => {
    expect(cardPrice(variants, 'Välj antal', '2 produkter', {}, names, 'selection')).toEqual({ price: 499, from: true });
    expect(cardPrice(variants, 'Välj antal', '1 produkt', {}, names, 'selection')).toEqual({ price: 275, from: false });
    expect(cardPrice(variants, 'Välj antal', '1 produkt', { Färg: 'Röd' }, names, 'from')).toEqual({ price: 275, from: true });
  });

  it('no active variant → no price', () => {
    expect(cardPrice(variants, 'Välj antal', '3 produkter', {}, names, 'selection')).toBeNull();
  });

  it('free shipping from the threshold (≥)', () => {
    expect(freeShippingReached(499, 499)).toBe(true);
    expect(freeShippingReached(498.99, 499)).toBe(false);
    expect(freeShippingReached(999, null)).toBe(false);
    expect(freeShippingReached(0, 0)).toBe(true);
  });

  it('card texts from valueMeta with locale overrides; default badge colour', () => {
    const cfg = {
      name: 'Välj antal',
      valueMeta: {
        '3 produkter': { label: '3 Produkter', badge: 'Mest Populärt ⭐', badge_color: '#FFD84D', i18n: { en: { label: '3 products' } } },
        '2 produkter': { badge: 'Bra', badge_color: 'red; background:url(x)' },
      },
    };
    expect(cardMeta(cfg, '3 produkter', 'sv', 'sv')).toEqual({
      label: '3 Produkter',
      sublabel: undefined,
      badge: 'Mest Populärt ⭐',
      badgeColor: '#FFD84D',
    });
    expect(cardMeta(cfg, '3 produkter', 'en', 'sv').label).toBe('3 products');
    expect(cardMeta(cfg, '2 produkter', 'sv', 'sv')).toMatchObject({ label: '2 produkter', badgeColor: DEFAULT_BADGE_COLOR });
    expect(cardMeta(null, '1 produkt', 'sv', 'sv')).toEqual({ label: '1 produkt', sublabel: undefined, badge: undefined, badgeColor: DEFAULT_BADGE_COLOR });
  });
});
