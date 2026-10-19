import { describe, expect, it } from 'vitest';
import { checkoutCountryOptions } from './checkoutCountries';

const legacy = [
  { code: 'DE', name: 'Germany' },
  { code: 'NO', name: 'Norway' },
  { code: 'SE', name: 'Sweden' },
];

const se = { key: 'se', is_default: true, countries: ['SE'] };
const eu = { key: 'eu', is_default: false, countries: ['fi', 'DE', 'BE', 'xx1'] };

describe('checkoutCountryOptions', () => {
  it('returns the legacy list without a market', () => {
    expect(checkoutCountryOptions(legacy, null, [], 'en')).toEqual(legacy);
    expect(checkoutCountryOptions(legacy, undefined, null, 'en')).toEqual(legacy);
  });

  it('keeps the legacy list for a market without countries', () => {
    expect(
      checkoutCountryOptions(legacy, { key: 'eu', is_default: false, countries: [] }, [], 'en'),
    ).toEqual(legacy);
    expect(
      checkoutCountryOptions(legacy, { key: 'se', is_default: true, countries: [] }, [], 'en'),
    ).toEqual(legacy);
  });

  it("offers exactly a non-default market's countries, named and sorted in the locale", () => {
    const out = checkoutCountryOptions(legacy, eu, [se, eu], 'en');
    expect(out.map((c) => c.code)).toEqual(['BE', 'FI', 'DE']);
    expect(out.map((c) => c.name)).toEqual(['Belgium', 'Finland', 'Germany']);
  });

  it('lets the default market serve every country no other market claims', () => {
    const out = checkoutCountryOptions(legacy, se, [se, eu], 'en');
    // DE belongs to `eu`; NO is claimed by no market and stays.
    expect(out.map((c) => c.code)).toEqual(['NO', 'SE']);
  });

  it('adds the default market countries missing from the legacy list', () => {
    const out = checkoutCountryOptions(
      legacy,
      { key: 'se', is_default: true, countries: ['SE', 'IS'] },
      [],
      'en',
    );
    expect(out.map((c) => c.code).sort()).toEqual(['DE', 'IS', 'NO', 'SE']);
  });

  it('keeps the current form value selectable', () => {
    const out = checkoutCountryOptions(legacy, { ...eu, countries: ['DE'] }, [], 'en', 'se');
    expect(out.map((c) => c.code).sort()).toEqual(['DE', 'SE']);
  });
});
