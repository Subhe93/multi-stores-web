import { afterEach, describe, expect, it, vi } from 'vitest';
import { VARIANT_QUERY_PARAM, variantFromQuery, variantUrl, withoutVariantLinkParam, writeVariantParam } from './variantParam';
import { readPrefill } from './personalization/prefill';

const RED = '3f6c1c1e-0b7e-4a57-9a53-2f1a8f1d2c11';
const BLUE = '9a1b2c3d-4e5f-4a6b-8c7d-0e1f2a3b4c5d';
const OFF = '11111111-2222-4333-8444-555555555555';
const OTHER = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';

const variants = [
  { id: RED },
  { id: BLUE, is_active: true },
  { id: OFF, is_active: false },
];

describe('variantFromQuery', () => {
  it('accepts the id of an active variant of the rendered product', () => {
    expect(variantFromQuery(RED, variants)).toBe(RED);
    expect(variantFromQuery(BLUE, variants)).toBe(BLUE);
  });

  it('trims and lower-cases before the lookup', () => {
    expect(variantFromQuery(`  ${RED.toUpperCase()} `, variants)).toBe(RED);
  });

  it.each([
    ['missing', undefined],
    ['empty', ''],
    ['blank', '   '],
    ['not a uuid', 'zzz'],
    ['a number', '12'],
    ['uuid with a suffix', `${RED}x`],
    ['uuid inside other text', `x ${RED}`],
    ['repeated parameter', [RED, BLUE]],
    ['repeated parameter with one value', [RED]],
    ['unknown id / id of another product', OTHER],
    ['inactive variant', OFF],
  ])('ignores: %s', (_label, value) => {
    expect(variantFromQuery(value as string | string[] | undefined, variants)).toBeUndefined();
  });

  it('ignores every value for a product without variants', () => {
    expect(variantFromQuery(RED, [])).toBeUndefined();
    expect(variantFromQuery(RED, null)).toBeUndefined();
    expect(variantFromQuery(RED, undefined)).toBeUndefined();
  });

  it('a variant hidden in the market is not in the payload, so it is ignored', () => {
    expect(variantFromQuery(BLUE, [{ id: RED }])).toBeUndefined();
  });
});

describe('variantUrl', () => {
  it('appends the parameter to the canonical', () => {
    const canonical = 'https://namez.shop/de-de/products/dalapferd';
    expect(canonical).not.toMatch(/[?#]/);
    expect(variantUrl(canonical, RED)).toBe(`${canonical}?variant=${RED}`);
    expect(VARIANT_QUERY_PARAM).toBe('variant');
  });
});

describe('writeVariantParam', () => {
  afterEach(() => vi.unstubAllGlobals());

  function stubWindow(href: string) {
    const replaceState = vi.fn();
    vi.stubGlobal('window', { location: { href }, history: { replaceState } });
    return replaceState;
  }

  it('does nothing on the server', () => {
    expect(() => writeVariantParam(RED)).not.toThrow();
  });

  it('sets the parameter with a null state and keeps the other parameters and the hash', () => {
    const replaceState = stubWindow('https://namez.shop/de-de/products/x?utm_source=g&design=abc#reviews');
    writeVariantParam(RED);
    expect(replaceState).toHaveBeenCalledTimes(1);
    expect(replaceState).toHaveBeenCalledWith(
      null,
      '',
      `https://namez.shop/de-de/products/x?utm_source=g&design=abc&variant=${RED}#reviews`,
    );
  });

  it('replaces a previous value in place', () => {
    const replaceState = stubWindow(`https://shop.test/products/x?variant=${BLUE}&gclid=1`);
    writeVariantParam(RED);
    expect(replaceState).toHaveBeenCalledWith(null, '', `https://shop.test/products/x?variant=${RED}&gclid=1`);
  });

  it('replaces an invalid or repeated value', () => {
    const replaceState = stubWindow(`https://shop.test/products/x?variant=zzz&variant=${RED}`);
    writeVariantParam(RED);
    expect(replaceState).toHaveBeenCalledWith(null, '', `https://shop.test/products/x?variant=${RED}`);
  });

  it('removes the parameter and keeps the rest', () => {
    const replaceState = stubWindow(`https://shop.test/products/x?back=%2Fsite&variant=${RED}#top`);
    writeVariantParam(undefined);
    expect(replaceState).toHaveBeenCalledWith(null, '', 'https://shop.test/products/x?back=%2Fsite#top');
  });

  it('is a no-op when the URL already says the same', () => {
    const same = stubWindow(`https://shop.test/products/x?variant=${RED}`);
    writeVariantParam(RED);
    expect(same).not.toHaveBeenCalled();
    const none = stubWindow('https://shop.test/products/x?utm=1');
    writeVariantParam(undefined);
    expect(none).not.toHaveBeenCalled();
  });

  it('survives a throwing replaceState', () => {
    const replaceState = stubWindow('https://shop.test/products/x');
    replaceState.mockImplementation(() => {
      throw new Error('SecurityError');
    });
    expect(() => writeVariantParam(RED)).not.toThrow();
  });
});

describe('withoutVariantLinkParam (personalization URL prefill)', () => {
  const fields = [{ id: 'f1', name: 'engraving', type: 'TEXT' }];
  const aliases = { variant: 'engraving', name1: 'engraving' };

  it('a variant link never reaches an alias named variant', () => {
    // Without the guard the raw id would be typed into the text field.
    expect(readPrefill(`?variant=${RED}`, aliases, fields, []).fields).toEqual({ f1: RED });
    expect(readPrefill(withoutVariantLinkParam(`?variant=${RED}`), aliases, fields, []).fields).toEqual({});
    expect(readPrefill(withoutVariantLinkParam(`?variant=%20${RED.toUpperCase()}%20`), aliases, fields, []).fields).toEqual({});
    // A stale link (the id names no variant of this product) is dropped too.
    expect(readPrefill(withoutVariantLinkParam(`?variant=${OTHER}`), aliases, fields, []).fields).toEqual({});
  });

  it('any other value of that alias keeps working', () => {
    expect(readPrefill(withoutVariantLinkParam('?variant=Karin'), aliases, fields, []).fields).toEqual({ f1: 'Karin' });
  });

  it('keeps every other parameter, repeated ones and their order', () => {
    const out = withoutVariantLinkParam(`?name1=A&variant=${RED}&cf[engraving]=B&utm_source=x&variant=red&name1=C`);
    expect([...out.entries()]).toEqual([
      ['name1', 'A'],
      ['cf[engraving]', 'B'],
      ['utm_source', 'x'],
      ['variant', 'red'],
      ['name1', 'C'],
    ]);
  });

  it('accepts a URLSearchParams and does not mutate it', () => {
    const input = new URLSearchParams(`variant=${RED}&a=1`);
    expect(withoutVariantLinkParam(input).toString()).toBe('a=1');
    expect(input.get('variant')).toBe(RED);
  });

  it('a store without that alias reads the same prefill with or without the guard', () => {
    const search = `?name1=Karin&variant=${RED}`;
    const plain = { name1: 'engraving' };
    expect(readPrefill(withoutVariantLinkParam(search), plain, fields, [])).toEqual(readPrefill(search, plain, fields, []));
  });
});
