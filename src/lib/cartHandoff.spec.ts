import { describe, expect, it } from 'vitest';
import {
  CART_HANDOFF_MAX_BYTES,
  appendHandoffParam,
  decodeGuestCart,
  encodeGuestCart,
  sanitizeHandoffLine,
} from './cartHandoff';
import type { CartItem } from '@/hooks/useCart';

function b64url(obj: unknown): string {
  return Buffer.from(JSON.stringify(obj), 'utf8').toString('base64url');
}

const item = (over: Partial<CartItem> = {}): CartItem => ({
  id: 'local_1', productId: 'prod-1', price: 10, quantity: 2, title: 'Metal card', ...over,
});

describe('encodeGuestCart / decodeGuestCart round trip', () => {
  it('carries ids, quantity, custom fields and display hints', () => {
    const { param, dropped } = encodeGuestCart([
      item({ variantId: 'var-1', customFields: { color: 'red', qty: 2, gift: true }, imageUrl: '/uploads/a.png', variant: 'Red' }),
      item({ id: 'local_2', productId: 'cp-1', customProductId: 'cp-1', bundleOfferId: 'b-1' }),
    ]);
    expect(dropped).toBe(0);
    expect(decodeGuestCart(param)).toEqual([
      { q: 2, p: 'prod-1', v: 'var-1', t: 'Metal card', i: '/uploads/a.png', l: 'Red', f: { color: 'red', qty: 2, gift: true } },
      { q: 2, c: 'cp-1', b: 'b-1', t: 'Metal card' },
    ]);
  });

  it('drops trailing lines until the payload fits 4 KB and reports the count', () => {
    const big = Array.from({ length: 60 }, (_, i) =>
      item({ id: `l${i}`, productId: `prod-${i}`, title: 'x'.repeat(120), imageUrl: 'https://cdn.example.com/' + 'y'.repeat(200) }),
    );
    const { param, dropped } = encodeGuestCart(big);
    expect(param!.length).toBeLessThanOrEqual(CART_HANDOFF_MAX_BYTES);
    expect(dropped).toBeGreaterThan(0);
    expect(decodeGuestCart(param)).toHaveLength(60 - dropped);
    expect(encodeGuestCart([])).toEqual({ param: null, dropped: 0 });
  });
});

describe('decodeGuestCart validation', () => {
  it('rejects malformed containers', () => {
    expect(decodeGuestCart(null)).toEqual([]);
    expect(decodeGuestCart('***')).toEqual([]);
    expect(decodeGuestCart(b64url({ q: 1, p: 'x' }))).toEqual([]);
    expect(decodeGuestCart(b64url('[]'))).toEqual([]);
    expect(decodeGuestCart('a'.repeat(CART_HANDOFF_MAX_BYTES + 1))).toEqual([]);
  });

  it('drops lines with a bad quantity or missing / oversized ids', () => {
    expect(decodeGuestCart(b64url([
      { q: 0, p: 'a' }, { q: 1.5, p: 'a' }, { q: 1000, p: 'a' }, { q: '2', p: 'a' }, { q: -1, p: 'a' },
      { q: 1 }, { q: 1, p: '' }, { q: 1, p: 'x'.repeat(65) }, { q: 1, p: 123 }, { q: 1, p: 'ok', v: 'y'.repeat(65) },
      null, 'str', [], { q: 999, p: 'kept' },
    ]))).toEqual([{ q: 999, p: 'kept' }]);
  });

  it('caps titles/labels and only keeps safe image urls', () => {
    expect(sanitizeHandoffLine({ q: 1, p: 'a', t: 'x'.repeat(121) })).toBeNull();
    expect(sanitizeHandoffLine({ q: 1, p: 'a', l: 'x'.repeat(81) })).toBeNull();
    expect(sanitizeHandoffLine({ q: 1, p: 'a', i: 'javascript:alert(1)' })).toEqual({ q: 1, p: 'a' });
    expect(sanitizeHandoffLine({ q: 1, p: 'a', i: '//evil.example/x.png' })).toEqual({ q: 1, p: 'a' });
    expect(sanitizeHandoffLine({ q: 1, p: 'a', i: 'data:image/png;base64,AAAA' })).toEqual({ q: 1, p: 'a' });
    expect(sanitizeHandoffLine({ q: 1, p: 'a', i: 'https://cdn.example.com/x.png' })).toEqual({ q: 1, p: 'a', i: 'https://cdn.example.com/x.png' });
    expect(sanitizeHandoffLine({ q: 1, p: 'a', i: '/uploads/x.png' })).toEqual({ q: 1, p: 'a', i: '/uploads/x.png' });
  });

  it('sanitises custom fields to a depth-1 plain object of primitives', () => {
    expect(sanitizeHandoffLine({ q: 1, p: 'a', f: ['x'] })).toEqual({ q: 1, p: 'a' });
    expect(sanitizeHandoffLine({ q: 1, p: 'a', f: 'x' })).toEqual({ q: 1, p: 'a' });
    expect(sanitizeHandoffLine({ q: 1, p: 'a', f: { nested: { a: 1 }, arr: [1], fn: null, ok: 'v', n: 2, b: false } }))
      .toEqual({ q: 1, p: 'a', f: { ok: 'v', n: 2, b: false } });
    expect(sanitizeHandoffLine({ q: 1, p: 'a', f: JSON.parse('{"__proto__": {"polluted": 1}, "k": "v"}') }))
      .toEqual({ q: 1, p: 'a', f: { k: 'v' } });
    expect(sanitizeHandoffLine({ q: 1, p: 'a', f: { long: 'x'.repeat(2049) } })).toEqual({ q: 1, p: 'a' });
  });

  it('prefers the custom product id and ignores unknown keys', () => {
    expect(sanitizeHandoffLine({ q: 1, p: 'a', c: 'cp', evil: 'x' })).toEqual({ q: 1, c: 'cp' });
  });
});

describe('appendHandoffParam', () => {
  it('joins with ? or & and adds the dropped count', () => {
    expect(appendHandoffParam('https://x.test/p', 'abc')).toBe('https://x.test/p?c=abc');
    expect(appendHandoffParam('https://x.test/p?sort=1', 'abc', 2)).toBe('https://x.test/p?sort=1&c=abc&cd=2');
    expect(appendHandoffParam('https://x.test/p', null, 3)).toBe('https://x.test/p?cd=3');
    expect(appendHandoffParam('https://x.test/p', null)).toBe('https://x.test/p');
  });
});
