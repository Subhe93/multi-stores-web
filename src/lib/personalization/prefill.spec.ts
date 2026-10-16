import { describe, expect, it } from 'vitest';
import { matchOptionValue, PREFILL_MAX_CHARS, readPrefill, readPrefillAliases } from './prefill';

const fields = [
  { id: 'n1', name: 'name_1', type: 'TEXT' },
  { id: 'n2', name: 'name_2', type: 'TEXT' },
  { id: 'mt', name: 'model_text', type: 'TEXT' },
  { id: 'up', name: 'photo', type: 'IMAGE' },
  { id: 'cb', name: 'details', type: 'CHECKBOX_GROUP' },
];
const options = [
  { name: 'Färg', values: ['Röd', 'Blå', 'Svart'] },
  { name: 'Välj antal', values: ['1 produkt', '2 produkter'] },
];
// namez A L14-32: ?name1=&name2=&model_text=&color=
const namez = { name1: 'name_1', name2: 'name_2', model_text: 'model_text', color: 'option:Färg' };

describe('readPrefill', () => {
  it('maps the store aliases to fields and options', () => {
    expect(readPrefill('?name1=Kristofer&name2=%E2%9D%A4Karin%E2%9D%A4&model_text=F%C3%B6r+alltid&color=r%C3%B6d', namez, fields, options)).toEqual({
      fields: { n1: 'Kristofer', n2: '❤Karin❤', mt: 'För alltid' },
      options: { Färg: 'Röd' },
    });
  });

  it('reads cf[name] for any prefillable top-level field; cf wins over an alias', () => {
    const r = readPrefill(new URLSearchParams('name1=A&cf[name_1]=B&cf[model_text]=Hej'), namez, fields, options);
    expect(r.fields).toEqual({ n1: 'B', mt: 'Hej' });
  });

  it('ignores unknown fields, file/checkbox fields, empty values and unknown option values', () => {
    const r = readPrefill('cf[nope]=x&cf[photo]=http://x&cf[details]=a&name2=++&color=Lila', namez, fields, options);
    expect(r).toEqual({ fields: {}, options: {} });
  });

  it('fills a priced field through a configured alias only, never through cf[name]', () => {
    const priced = [...fields, { id: 'gx', name: 'gift_text', type: 'TEXT', priced: true }];
    expect(readPrefill('cf[gift_text]=Hej', {}, priced, options).fields).toEqual({});
    expect(readPrefill('gift=Hej', { gift: 'gift_text' }, priced, options).fields).toEqual({ gx: 'Hej' });
    // An explicit cf[] cannot override the alias value of a priced field.
    expect(readPrefill('gift=Hej&cf[gift_text]=Nej', { gift: 'gift_text' }, priced, options).fields).toEqual({ gx: 'Hej' });
  });

  it('works without aliases and cuts long values', () => {
    const long = 'A'.repeat(PREFILL_MAX_CHARS + 50);
    const r = readPrefill(`cf[name_1]=${long}`, {}, fields, options);
    expect(Array.from(r.fields.n1!)).toHaveLength(PREFILL_MAX_CHARS);
    expect(readPrefill('', {}, fields, options)).toEqual({ fields: {}, options: {} });
  });
});

describe('helpers', () => {
  it('matches option values exactly first, then case-insensitively', () => {
    expect(matchOptionValue(['Röd', 'röd'], 'röd')).toBe('röd');
    expect(matchOptionValue(['Röd'], 'RÖD')).toBe('Röd');
    expect(matchOptionValue(['Röd'], '  ')).toBeNull();
  });

  it('reads aliases leniently', () => {
    expect(readPrefillAliases({ a: 'x', b: 2, ' ': 'y', c: ' option:Färg ' })).toEqual({ a: 'x', c: 'option:Färg' });
    expect(readPrefillAliases(null)).toEqual({});
    expect(readPrefillAliases(['x'])).toEqual({});
  });
});
