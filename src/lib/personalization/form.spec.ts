import { describe, expect, it } from 'vitest';
import { compileAllowedChars } from '@multi-stores/core/personalization/rules';
import {
  buildCartPayload,
  fieldErrorFromApi,
  fieldErrorsFrom,
  filterAllowedChars,
  fillableFields,
  initialFieldValues,
  mapFormFields,
  padLinkedPair,
  prefilledValues,
  validateFormValues,
  type MessageParams,
  type PersonalizationProduct,
} from './form';

// Echoes key + params so assertions see exactly what would be translated.
const t = (key: string, params?: MessageParams) => `${key}${params ? ' ' + JSON.stringify(params) : ''}`;

const tr = (label: string, extra: Record<string, unknown> = {}) => [{ locale: 'sv', label, ...extra }];

const namez: PersonalizationProduct = {
  custom_fields: [
    {
      id: 'f1', name: 'name_1', type: 'TEXT', is_required: true, sort_order: 0,
      translations: tr('Första namnet'),
      validation_rules: { max_length: 11, allowed_chars: 'A-Za-z❤' },
    },
    {
      id: 'f2', name: 'name_2', type: 'TEXT', is_required: true, sort_order: 1,
      translations: tr('Andra namnet'),
      linked_validation: { type: 'equal_length', target: 'name_1', fill_char: '❤' },
    },
    {
      id: 'f3', name: 'color', type: 'SELECT', is_required: false, sort_order: 2,
      options: ['red', 'blue'], translations: tr('Färg', { option_labels: { red: 'Röd' } }),
    },
  ],
};

describe('mapFormFields', () => {
  it('maps labels, allowed chars and the link by target name (K3)', () => {
    const fields = mapFormFields(namez, 'sv', 'sv');
    expect(fields.map((f) => f.label)).toEqual(['Första namnet', 'Andra namnet', 'Färg']);
    expect(fields[0]).toMatchObject({ required: true, allowedChars: 'A-Za-z❤', validation: { max: 11 } });
    expect(fields[1]!.linked).toEqual({
      type: 'equal_length', targetId: 'f1', targetLabel: 'Första namnet', fillChar: '❤',
    });
    expect(fields[2]).toMatchObject({ options: ['red', 'blue'], optionLabels: { red: 'Röd' } });
  });

  it('legacy target_field_id holding a name or an id resolves too', () => {
    const byName = mapFormFields({ custom_fields: [
      { id: 'a', name: 'n1', type: 'TEXT' },
      { id: 'b', name: 'n2', type: 'TEXT', linked_validation: { type: 'equal_length', target_field_id: 'n1' } },
    ] }, 'en', 'en');
    expect(byName[1]!.linked?.targetId).toBe('a');
    const byId = mapFormFields({ custom_fields: [
      { id: 'a', name: 'n1', type: 'TEXT' },
      { id: 'b', name: 'n2', type: 'TEXT', linked_validation: { type: 'max_combined', target_field_id: 'a', max: 20 } },
    ] }, 'en', 'en');
    expect(byId[1]!.linked).toMatchObject({ targetId: 'a', type: 'max_combined', max: 20 });
  });

  it('hides creator-filled fields of custom products and keeps their values', () => {
    const product: PersonalizationProduct = {
      custom_fields: [
        { id: 'logo', name: 'logo', type: 'IMAGE', is_required: true },
        { id: 'txt', name: 'txt', type: 'TEXT' },
      ],
      field_values: [{ custom_field_id: 'logo', file_url: '/uploads/custom-fields/logo.webp' }],
    };
    expect(mapFormFields(product, 'en', 'en').map((f) => f.id)).toEqual(['txt']);
    expect(prefilledValues(product)).toEqual({ logo: '/uploads/custom-fields/logo.webp' });
    expect(initialFieldValues(product)).toEqual({ logo: '/uploads/custom-fields/logo.webp' });
    expect(validateFormValues(product, initialFieldValues(product)).ok).toBe(true);
  });

  it('no custom fields → no form fields', () => {
    expect(mapFormFields({}, 'en', 'en')).toEqual([]);
    expect(mapFormFields({ custom_fields: [] }, 'en', 'en')).toEqual([]);
  });
});

describe('buildCartPayload (identical to the pre-M4.0 inline code)', () => {
  // The code ProductDetailClient ran before M4.0, kept here as the oracle.
  function legacy(values: Record<string, unknown>, fields: ReturnType<typeof mapFormFields>) {
    const out =
      Object.keys(values).length > 0
        ? Object.fromEntries(Object.entries(values).filter(([, v]) => v !== '' && v != null))
        : undefined;
    const display = out
      ? Object.entries(out).map(([fieldId, value]) => {
          const def = fields.find((f) => f.id === fieldId);
          return {
            id: fieldId,
            label: def?.label || fieldId,
            value,
            display: typeof value === 'string' && def?.optionLabels ? def.optionLabels[value] ?? null : null,
          };
        })
      : undefined;
    return { fields: out, display };
  }

  it.each([
    ['no values', {}],
    ['values with blanks', { f1: 'ANNA', f2: '', f3: 'red', x: null }],
    ['only blanks', { f1: '' }],
    ['unknown and prefilled keys', { logo: '/uploads/custom-fields/a.webp', f2: 'OLLE' }],
  ])('%s', (_n, values) => {
    const fields = mapFormFields(namez, 'sv', 'sv');
    const ours = buildCartPayload(values as Record<string, unknown>, fields);
    const old = legacy(values as Record<string, unknown>, fields);
    expect(ours.fields).toEqual(old.fields);
    expect(ours.display).toEqual(old.display);
  });
});

describe('validation messages (errors.CUSTOM_FIELD_*)', () => {
  it('required, too long and length mismatch with localized labels', () => {
    const res = validateFormValues(namez, { f1: 'ABCDEFGHIJKL', f2: '' });
    const msgs = fieldErrorsFrom(res.issues, namez, 'sv', 'sv', t);
    expect(msgs.f1).toBe('errors.CUSTOM_FIELD_TOO_LONG {"max":11,"label":"Första namnet"}');
    expect(msgs.f2).toBe('errors.CUSTOM_FIELD_REQUIRED {"label":"Andra namnet"}');

    // 'ANNA❤️' counts 5 like 'KARIN'; 'ANNA' (4) does not.
    expect(validateFormValues(namez, { f1: 'ANNA❤️', f2: 'KARIN' }).ok).toBe(true);
    const mismatch = validateFormValues(namez, { f1: 'ANNA', f2: 'KARIN' });
    expect(fieldErrorsFrom(mismatch.issues, namez, 'sv', 'sv', t).f2).toBe(
      'errors.CUSTOM_FIELD_LENGTH_MISMATCH {"length":4,"target":"Första namnet","label":"Andra namnet"}',
    );
  });

  it('code points after VS removal: a phone heart counts 1 (K4)', () => {
    expect(validateFormValues(namez, { f1: 'EVA❤️', f2: 'BOBS' }).ok).toBe(true);
  });

  it('allowed_chars rejects other characters', () => {
    const res = validateFormValues(namez, { f1: 'ANNA1', f2: 'OLLE1' });
    expect(res.issues[0]).toMatchObject({ code: 'CUSTOM_FIELD_INVALID_CHARS', field_id: 'f1' });
  });

  it('a no-field product always validates', () => {
    expect(validateFormValues({}, {}).ok).toBe(true);
  });
});

describe('fieldErrorFromApi (K2 inline errors)', () => {
  const has = () => true;
  it('maps a coded field error onto the field with its local label', () => {
    const err = Object.assign(new Error('x'), {
      code: 'CUSTOM_FIELD_TOO_LONG', field_id: 'f1', field_name: 'name_1', params: { max: 11, label: 'Server label' },
    });
    expect(fieldErrorFromApi(err, namez, 'sv', 'sv', t, has)).toEqual({
      code: 'CUSTOM_FIELD_TOO_LONG',
      fieldId: 'f1',
      message: 'errors.CUSTOM_FIELD_TOO_LONG {"max":11,"label":"Första namnet"}',
    });
  });

  it('customer upload expiry maps too; unrelated errors do not', () => {
    const expired = { code: 'CUSTOMER_UPLOAD_EXPIRED', field_id: 'f3', params: { label: 'x' } };
    expect(fieldErrorFromApi(expired, namez, 'sv', 'sv', t, has)?.fieldId).toBe('f3');
    expect(fieldErrorFromApi({ code: 'CART_ITEM_NOT_FOUND' }, namez, 'sv', 'sv', t, has)).toBeNull();
    expect(fieldErrorFromApi({ code: 'CUSTOM_FIELD_REQUIRED', field_id: 'other' }, namez, 'sv', 'sv', t, has)).toBeNull();
    expect(fieldErrorFromApi({ code: 'CUSTOM_FIELD_REQUIRED', field_id: 'f1' }, namez, 'sv', 'sv', t, () => false)).toBeNull();
  });
});

describe('allowed chars input filter', () => {
  it('drops rejected characters, keeps variation selectors', () => {
    const re = compileAllowedChars('A-Za-z❤');
    expect(filterAllowedChars('EVA 1❤️!', re)).toBe('EVA❤️');
    expect(filterAllowedChars('anything', null)).toBe('anything');
  });

  it('arabic preset body with \\s works per character', () => {
    const re = compileAllowedChars('؀-ۿ\\s');
    expect(filterAllowedChars('سلام abc', re)).toBe('سلام ');
  });
});

describe('fill with <char> (equal_length)', () => {
  const fields = mapFormFields(namez, 'sv', 'sv');

  it('offers the fill only when both texts are set and lengths differ', () => {
    expect(fillableFields(fields, { f1: 'ANNA', f2: 'BO' }, {})).toEqual({ f2: '❤' });
    expect(fillableFields(fields, { f1: 'ANNA', f2: 'OLLE' }, {})).toEqual({});
    expect(fillableFields(fields, { f1: 'ANNA', f2: '' }, {})).toEqual({});
  });

  it('pads the shorter text to the other length', () => {
    expect(padLinkedPair(fields[1]!, { f1: 'ANNA', f2: 'BO' })).toEqual({ f2: 'BO❤❤' });
    expect(padLinkedPair(fields[1]!, { f1: 'EVA', f2: 'KARIN' })).toEqual({ f1: 'EVA❤❤' });
    const padded = { f1: 'EVA❤❤', f2: 'KARIN' };
    expect(validateFormValues(namez, padded).ok).toBe(true);
  });

  // `fields[1]` with another fill char on its link.
  const withFill = (fillChar: string) => {
    const f = fields[1]!;
    return { ...f, linked: { ...f.linked!, fillChar } } as typeof f;
  };

  it('a single grapheme with VS16 (U+2764 U+FE0F) pads one counted char per repeat', () => {
    const heart = '\u2764\uFE0F';
    const field = withFill(heart);
    expect(fillableFields([fields[0]!, field], { f1: 'ANNA', f2: 'BO' }, {})).toEqual({ f2: heart });
    expect(padLinkedPair(field, { f1: 'ANNA', f2: 'BO' })).toEqual({ f2: `BO${heart}${heart}` });
  });

  it('a fill char of more than one counted char is not offered', () => {
    const field = withFill('ab');
    expect(fillableFields([fields[0]!, field], { f1: 'ANNA', f2: 'BO' }, {})).toEqual({});
    expect(padLinkedPair(field, { f1: 'ANNA', f2: 'BO' })).toEqual({});
  });
});
