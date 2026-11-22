import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CartItem } from '@/hooks/useCart';
import {
  applyCartDisplay,
  buildCartDisplayBody,
  displayKey,
  normalizeCartDisplay,
  readCachedDisplay,
  resetCartDisplayCache,
  staleLines,
  writeCachedDisplay,
} from './cartDisplay';

const line = (over: Partial<CartItem> = {}): CartItem => ({
  id: 'l1', productId: 'p1', title: 'Cheval', price: 10, quantity: 1, ...over,
});

describe('displayKey', () => {
  it('own product vs custom product, with and without a variant', () => {
    expect(displayKey(line())).toBe('p:p1|');
    expect(displayKey(line({ variantId: 'v1' }))).toBe('p:p1|v1');
    expect(displayKey(line({ productId: 'cp1', customProductId: 'cp1', variantId: 'v2' }))).toBe('cp:cp1|v2');
  });
});

describe('staleLines', () => {
  it('skips lines captured in the page locale, keeps missing / other locales, dedupes', () => {
    const items = [
      line({ id: 'a', displayLocale: 'de' }),
      line({ id: 'b', productId: 'p2' }),
      line({ id: 'c', productId: 'p2' }),
      line({ id: 'd', productId: 'p3', displayLocale: 'fr' }),
      line({ id: 'e', productId: '' }),
    ];
    expect(staleLines(items, 'de').map((i) => i.id)).toEqual(['b', 'd']);
  });
});

describe('buildCartDisplayBody', () => {
  it('sends ids only, custom products by their own id', () => {
    const body = buildCartDisplayBody(
      [line({ variantId: 'v1' }), line({ productId: 'cp1', customProductId: 'cp1' })],
      'de',
    );
    expect(body).toEqual({
      locale: 'de',
      lines: [{ product_id: 'p1', variant_id: 'v1' }, { custom_product_id: 'cp1' }],
    });
  });

  it('caps at 50 lines', () => {
    const many = Array.from({ length: 60 }, (_, i) => line({ productId: `p${i}` }));
    expect(buildCartDisplayBody(many, 'de').lines).toHaveLength(50);
  });
});

describe('normalizeCartDisplay', () => {
  it('pads to the requested length and drops junk', () => {
    expect(normalizeCartDisplay({ items: [{ title: 'Pferd', variant: '' }, null, 5] }, 4)).toEqual([
      { title: 'Pferd', variant: null },
      null,
      null,
      null,
    ]);
    expect(normalizeCartDisplay(null, 1)).toEqual([null]);
  });
});

describe('applyCartDisplay', () => {
  it('replaces the title; the variant only on lines with a variant', () => {
    const items = [line({ variantId: 'v1', variant: 'Couleur: Argent' }), line({ id: 'l2', productId: 'p2', variant: 'x' })];
    const out = applyCartDisplay(items, (key) =>
      key === 'p:p1|v1'
        ? { title: 'Pferd', variant: 'Farbe: Silber' }
        : key === 'p:p2|'
          ? { title: 'Tasse', variant: 'Farbe: Rot' }
          : undefined,
    );
    expect(out[0]).toMatchObject({ title: 'Pferd', variant: 'Farbe: Silber' });
    expect(out[1]).toMatchObject({ title: 'Tasse', variant: 'x' });
  });

  it('keeps the stored text for null entries / empty titles and returns the same array when unchanged', () => {
    const items = [line(), line({ id: 'l2', productId: 'p2' })];
    expect(applyCartDisplay(items, () => null)).toBe(items);
    expect(applyCartDisplay(items, () => ({ title: null, variant: null }))).toBe(items);
    expect(applyCartDisplay(items, () => ({ title: 'Cheval', variant: null }))).toBe(items);
  });
});

describe('display cache', () => {
  beforeEach(() => resetCartDisplayCache());
  afterEach(() => vi.unstubAllGlobals());

  it('remembers entries in memory; unknown keys are undefined', () => {
    writeCachedDisplay('s', 'de', { 'p:p1|': { title: 'Pferd', variant: null }, 'p:x|': null });
    expect(readCachedDisplay('s', 'de', 'p:p1|')).toEqual({ title: 'Pferd', variant: null });
    expect(readCachedDisplay('s', 'de', 'p:x|')).toBeNull();
    expect(readCachedDisplay('s', 'en', 'p:p1|')).toBeUndefined();
  });

  it('mirrors non-null entries to sessionStorage and reads them back', () => {
    const data = new Map<string, string>();
    vi.stubGlobal('window', {
      sessionStorage: {
        getItem: (k: string) => data.get(k) ?? null,
        setItem: (k: string, v: string) => void data.set(k, v),
      },
    });
    writeCachedDisplay('s', 'de', { 'p:p1|': { title: 'Pferd', variant: null }, 'p:x|': null });
    expect(JSON.parse(data.get('cart_display:s:de')!)).toEqual({ 'p:p1|': { title: 'Pferd', variant: null } });
    resetCartDisplayCache();
    expect(readCachedDisplay('s', 'de', 'p:p1|')).toEqual({ title: 'Pferd', variant: null });
    expect(readCachedDisplay('s', 'de', 'p:x|')).toBeUndefined();
  });

  it('a throwing sessionStorage never breaks the cache', () => {
    vi.stubGlobal('window', {
      get sessionStorage(): Storage {
        throw new Error('SecurityError');
      },
    });
    writeCachedDisplay('s', 'de', { 'p:p1|': { title: 'Pferd', variant: null } });
    expect(readCachedDisplay('s', 'de', 'p:p1|')).toEqual({ title: 'Pferd', variant: null });

    resetCartDisplayCache();
    vi.stubGlobal('window', {
      sessionStorage: {
        getItem: () => {
          throw new Error('denied');
        },
        setItem: () => {
          throw new Error('quota');
        },
      },
    });
    writeCachedDisplay('s', 'de', { 'p:p1|': { title: 'Pferd', variant: null } });
    expect(readCachedDisplay('s', 'de', 'p:p1|')).toEqual({ title: 'Pferd', variant: null });
  });
});
