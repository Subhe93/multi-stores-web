import { describe, expect, it } from 'vitest';
import {
  checkoutCountryOptions, checkoutPrefillCountry, normalizeShippableCountries, restrictToShippable,
} from './checkoutCountries';

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

describe('normalizeShippableCountries', () => {
  it('reads the API answer and drops junk codes', () => {
    expect(normalizeShippableCountries({ restricted: true, countries: ['se', 'NO', 'Sweden', 3] }))
      .toEqual({ restricted: true, countries: ['SE', 'NO'] });
    expect(normalizeShippableCountries({ restricted: false })).toEqual({ restricted: false, countries: [] });
  });

  it('is null for an unusable answer', () => {
    expect(normalizeShippableCountries(null)).toBeNull();
    expect(normalizeShippableCountries({ countries: ['SE'] })).toBeNull();
    expect(normalizeShippableCountries('x')).toBeNull();
  });
});

describe('restrictToShippable', () => {
  const noMarket = { locale: 'en', marketScoped: false };

  it('keeps the list when unknown or unrestricted', () => {
    expect(restrictToShippable(legacy, null, noMarket)).toEqual(legacy);
    expect(restrictToShippable(legacy, { restricted: false, countries: [] }, noMarket)).toEqual(legacy);
  });

  it('without a market offers exactly the shippable countries, named and sorted', () => {
    expect(restrictToShippable(legacy, { restricted: true, countries: ['SE', 'FI'] }, noMarket))
      .toEqual([{ code: 'FI', name: 'Finland' }, { code: 'SE', name: 'Sweden' }]);
  });

  it('keeps the current value selectable', () => {
    expect(
      restrictToShippable(legacy, { restricted: true, countries: ['SE'] }, { ...noMarket, current: 'de' })
        .map((c) => c.code),
    ).toEqual(['DE', 'SE']);
  });

  it('with a market filters its options (never re-adds other countries)', () => {
    const opts = { locale: 'en', marketScoped: true };
    expect(restrictToShippable(legacy, { restricted: true, countries: ['SE', 'FI'] }, opts))
      .toEqual([{ code: 'SE', name: 'Sweden' }]);
  });

  it('keeps the list when the restriction would leave nothing', () => {
    expect(restrictToShippable(legacy, { restricted: true, countries: [] }, noMarket)).toEqual(legacy);
    expect(
      restrictToShippable(legacy, { restricted: true, countries: ['FI'] }, { locale: 'en', marketScoped: true }),
    ).toEqual(legacy);
  });
});

describe('checkoutPrefillCountry', () => {
  const options = [{ code: 'SE', name: 'Sweden' }, { code: 'NO', name: 'Norway' }];
  const base = { defaultCountry: 'se', formCountry: '', alreadyPrefilled: false, options };

  it('pre-selects the cart quote country when the form is empty', () => {
    expect(checkoutPrefillCountry(base)).toBe('SE');
  });

  it('never overrides a chosen country or prefills twice', () => {
    expect(checkoutPrefillCountry({ ...base, formCountry: 'NO' })).toBeNull();
    expect(checkoutPrefillCountry({ ...base, alreadyPrefilled: true })).toBeNull();
  });

  it('skips an unknown default or one the list does not offer', () => {
    expect(checkoutPrefillCountry({ ...base, defaultCountry: null })).toBeNull();
    expect(checkoutPrefillCountry({ ...base, defaultCountry: 'DE' })).toBeNull();
  });
});
