import { describe, expect, it } from 'vitest';
import type { CartItem } from '@/hooks/useCart';
import {
  addGuestLine,
  createGuestCartMover,
  GUEST_CART_KEY,
  guestCartFromStorageEvent,
  parseStoredGuestCart,
  safeStorageWrite,
  guestLineToServerBody,
  isMigrationDropError,
  mergeHandoffLines,
  migrateGuestLines,
  newGuestLineId,
  remainingGuestLines,
} from './guestCart';

const fixedId = () => 'local_1';

function line(over: Partial<CartItem>): CartItem {
  return { id: 'x', productId: 'p1', price: 10, quantity: 1, bundleOfferId: null, ...over };
}

describe('addGuestLine (line key, M4.0 §1.2)', () => {
  it('same personalization merges into one line and sums quantities', () => {
    let cart = addGuestLine([], 'p1', null, 1, { f1: 'ANNA', f2: 'OLLE' }, { price: 10 }, fixedId);
    cart = addGuestLine(cart, 'p1', null, 2, { f2: 'OLLE', f1: 'ANNA' }, { price: 10 }, fixedId);
    expect(cart).toHaveLength(1);
    expect(cart[0]!.quantity).toBe(3);
  });

  it('different personalization stays on separate lines', () => {
    let cart = addGuestLine([], 'p1', null, 1, { f1: 'ANNA' }, { price: 10 }, fixedId);
    cart = addGuestLine(cart, 'p1', null, 1, { f1: 'EVA❤' }, { price: 10 }, () => 'local_2');
    expect(cart.map((i) => i.customFields)).toEqual([{ f1: 'ANNA' }, { f1: 'EVA❤' }]);
  });

  it('trimmed / NFC-equal values merge (same key as the server)', () => {
    let cart = addGuestLine([], 'p1', null, 1, { f1: 'Anna ' }, undefined, fixedId);
    cart = addGuestLine(cart, 'p1', null, 1, { f1: 'Anna' }, undefined, fixedId);
    expect(cart).toHaveLength(1);
    expect(cart[0]!.customFields).toEqual({ f1: 'Anna' });
  });

  it('stores normalized values', () => {
    const cart = addGuestLine([], 'p1', null, 1, { f1: '  José ', f2: '', f3: null }, undefined, fixedId);
    expect(cart[0]!.customFields).toEqual({ f1: 'José' });
  });

  it('a personalized line never merges with an unpersonalized one', () => {
    let cart = addGuestLine([], 'p1', null, 1, undefined, undefined, fixedId);
    cart = addGuestLine(cart, 'p1', null, 1, { f1: 'ANNA' }, undefined, fixedId);
    expect(cart).toHaveLength(2);
  });

  it('G0: no custom fields keeps the exact pre-M4.0 line shape and merge', () => {
    const meta = { title: 'Mug', price: 99, imageUrl: '/i.webp', currency: 'SEK' };
    const first = addGuestLine([], 'p1', 'v1', 1, undefined, meta, fixedId);
    expect(first).toEqual([
      {
        id: 'local_1',
        productId: 'p1',
        variantId: 'v1',
        customProductId: undefined,
        title: 'Mug',
        price: 99,
        quantity: 1,
        imageUrl: '/i.webp',
        variant: undefined,
        customerFile: undefined,
        currency: 'SEK',
        customFields: undefined,
        customFieldDisplay: undefined,
        bundleOfferId: null,
        bundleOriginalUnitPrice: null,
        bundleTitle: null,
        bundleLabel: null,
        bundleStickerText: null,
        bundleCartQuantity: null,
      },
    ]);
    expect(JSON.stringify(first[0])).not.toContain('taxRateBp');
    // AddToCartMagic sends {} (kept as {}) and merges with an undefined line.
    const magic = addGuestLine([], 'p1', 'v1', 1, {}, meta, fixedId);
    expect(magic[0]!.customFields).toEqual({});
    const merged = addGuestLine(first, 'p1', 'v1', 2, {}, meta, fixedId);
    expect(merged).toHaveLength(1);
    expect(merged[0]!.quantity).toBe(3);
  });

  it('variant and bundle still split lines', () => {
    let cart = addGuestLine([], 'p1', 'v1', 1, { f1: 'A' }, undefined, fixedId);
    cart = addGuestLine(cart, 'p1', 'v2', 1, { f1: 'A' }, undefined, fixedId);
    cart = addGuestLine(cart, 'p1', 'v1', 1, { f1: 'A' }, { bundleOfferId: 'b1' }, fixedId);
    expect(cart).toHaveLength(3);
  });
});

describe('mergeHandoffLines', () => {
  it('merges only lines with the same key and re-prices them', () => {
    const prev = [line({ id: 'a', customFields: { f1: 'ANNA' } })];
    const next = mergeHandoffLines(prev, [
      line({ id: 'b', customFields: { f1: 'ANNA' }, quantity: 2, price: 12 }),
      line({ id: 'c', customFields: { f1: 'OLLE' } }),
    ]);
    expect(next).toHaveLength(2);
    expect(next[0]).toMatchObject({ id: 'a', quantity: 3, price: 12 });
    expect(next[1]).toMatchObject({ id: 'c' });
  });

  it('lines without personalization merge as before', () => {
    const next = mergeHandoffLines([line({ id: 'a' })], [line({ id: 'b', quantity: 4, price: 8 })]);
    expect(next).toEqual([line({ id: 'a', quantity: 5, price: 8 })]);
  });
});

describe('newGuestLineId', () => {
  it('two ids in the same millisecond differ', () => {
    const ids = new Set(Array.from({ length: 50 }, () => newGuestLineId()));
    expect(ids.size).toBe(50);
  });
});

describe('guest → login migration', () => {
  const coded = (status: number, code?: string) => Object.assign(new Error('x'), { status, code });

  it('counts 4xx personalization rejections only', () => {
    expect(isMigrationDropError(coded(400, 'CUSTOM_FIELD_REQUIRED'))).toBe(true);
    expect(isMigrationDropError(coded(400, 'CUSTOMER_UPLOAD_EXPIRED'))).toBe(true);
    expect(isMigrationDropError(coded(400, 'PERSONALIZATION_INVALID'))).toBe(true);
    expect(isMigrationDropError(coded(404, 'DESIGNER_DESIGN_NOT_FOUND'))).toBe(true);
    expect(isMigrationDropError(coded(400, 'CART_ITEM_NOT_FOUND'))).toBe(false);
    expect(isMigrationDropError(coded(500, 'CUSTOM_FIELD_REQUIRED'))).toBe(false);
    expect(isMigrationDropError(new TypeError('Failed to fetch'))).toBe(false);
  });

  it('posts every line with the pre-M4.0 body and sorts moved / dropped / failed', async () => {
    const items = [
      line({ id: 'a', productId: 'p1', variantId: 'v1', customFields: { f1: 'ANNA' }, quantity: 2 }),
      line({ id: 'b', productId: 'c1', customProductId: 'c1', customFields: { f1: 'X' } }),
      line({ id: 'c', productId: 'p2' }),
      line({ id: 'd', productId: 'p3' }),
    ];
    const bodies: unknown[] = [];
    const tooLong = coded(400, 'CUSTOM_FIELD_TOO_LONG');
    const result = await migrateGuestLines(items, async (body) => {
      bodies.push(body);
      if (body.custom_product_id === 'c1') throw tooLong;
      if (body.product_id === 'p3') throw coded(503, 'SERVICE_UNAVAILABLE');
      return {};
    });
    expect(result.moved.map((i) => i.id)).toEqual(['a', 'c']);
    // The dropped line keeps its coded error for the "not moved" reason.
    expect(result.dropped).toEqual([{ item: items[1], error: tooLong }]);
    expect(result.failed.map((i) => i.id)).toEqual(['d']);
    expect(bodies).toEqual([
      { product_id: 'p1', custom_product_id: undefined, variant_id: 'v1', bundle_offer_id: undefined, quantity: 2, custom_fields: { f1: 'ANNA' } },
      { product_id: null, custom_product_id: 'c1', variant_id: null, bundle_offer_id: undefined, quantity: 1, custom_fields: { f1: 'X' } },
      { product_id: 'p2', custom_product_id: undefined, variant_id: null, bundle_offer_id: undefined, quantity: 1, custom_fields: undefined },
      { product_id: 'p3', custom_product_id: undefined, variant_id: null, bundle_offer_id: undefined, quantity: 1, custom_fields: undefined },
    ]);
    expect(JSON.stringify(guestLineToServerBody(items[2]!))).toBe('{"product_id":"p2","variant_id":null,"quantity":1}');
  });

  it('an all-good cart moves every line and drops none', async () => {
    const items = [line({ id: 'a' }), line({ id: 'b', productId: 'p2' })];
    const result = await migrateGuestLines(items, async () => ({}));
    expect(result).toEqual({ moved: items, dropped: [], failed: [] });
  });

  it('only the moved lines leave the local cart; rejected and new lines stay', async () => {
    const items = [
      line({ id: 'a', productId: 'p1' }),
      line({ id: 'b', productId: 'p2', customFields: { f1: 'X'.repeat(99) } }),
    ];
    const result = await migrateGuestLines(items, async (body) => {
      if (body.product_id === 'p2') throw coded(400, 'CUSTOMER_UPLOAD_EXPIRED');
      return {};
    });
    // A line added while the migration ran is kept as well.
    const added = line({ id: 'c', productId: 'p3' });
    const rest = remainingGuestLines([...items, added], result.moved);
    expect(rest.map((i) => i.id)).toEqual(['b', 'c']);
    expect(result.dropped).toHaveLength(1);
    expect((result.dropped[0]!.error as { code?: string }).code).toBe('CUSTOMER_UPLOAD_EXPIRED');
  });

  it('remainingGuestLines keeps the same array when nothing moved', () => {
    const cart = [line({ id: 'a' })];
    expect(remainingGuestLines(cart, [])).toBe(cart);
    expect(remainingGuestLines(cart, cart)).toEqual([]);
  });
});

describe('createGuestCartMover (login effect + checkout sync)', () => {
  const coded = (status: number, code?: string) => Object.assign(new Error('x'), { status, code });
  function memoryStore(initial: CartItem[]) {
    let stored = initial;
    return { load: () => stored, save: (next: CartItem[]) => { stored = next; }, get: () => stored };
  }

  it('keeps rejected lines stored (nothing cleared up front) and clears only moved ones', async () => {
    const store = memoryStore([line({ id: 'a' }), line({ id: 'b', productId: 'p2' })]);
    const move = createGuestCartMover(store);
    let storedDuringPost: string[] = [];
    const result = await move(async (body) => {
      storedDuringPost = store.get().map((i) => i.id);
      if (body.product_id === 'p2') throw coded(400, 'CUSTOM_FIELD_REQUIRED');
      return {};
    });
    expect(storedDuringPost).toEqual(['a', 'b']);
    expect(result.dropped.map((d) => d.item.id)).toEqual(['b']);
    expect(store.get().map((i) => i.id)).toEqual(['b']);
  });

  it('concurrent calls share one run: every line is posted once', async () => {
    const store = memoryStore([line({ id: 'a' }), line({ id: 'b', productId: 'p2' })]);
    const move = createGuestCartMover(store);
    const posted: unknown[] = [];
    const post = async (body: unknown) => { posted.push(body); return {}; };
    const [r1, r2] = await Promise.all([move(post), move(post)]);
    expect(r1).toBe(r2);
    expect(posted).toHaveLength(2);
    expect(store.get()).toEqual([]);
  });

  it('a later run retries only what is still stored', async () => {
    const store = memoryStore([line({ id: 'a' }), line({ id: 'b', productId: 'p2' })]);
    const move = createGuestCartMover(store);
    const reject = async (body: { product_id: string | null }) => {
      if (body.product_id === 'p2') throw coded(400, 'CUSTOM_FIELD_REQUIRED');
      return {};
    };
    await move(reject);
    const posted: unknown[] = [];
    const again = await move(async (body) => { posted.push(body); return reject(body); });
    expect(posted).toHaveLength(1);
    expect(again.dropped).toHaveLength(1);
  });

  it('an empty store posts nothing', async () => {
    const move = createGuestCartMover(memoryStore([]));
    let calls = 0;
    const result = await move(async () => { calls += 1; return {}; });
    expect(calls).toBe(0);
    expect(result).toEqual({ moved: [], dropped: [], failed: [] });
  });
});

describe('guest cart storage (M5 D1 / D12)', () => {
  function fakeStorage(opts: { throwOnSet?: boolean } = {}) {
    const map = new Map<string, string>();
    return {
      map,
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => {
        if (opts.throwOnSet) throw new Error('QuotaExceededError');
        map.set(k, v);
      },
      removeItem: (k: string) => { map.delete(k); },
    };
  }

  it('safeStorageWrite stores, removes on null and reports success', () => {
    const s = fakeStorage();
    expect(safeStorageWrite(s, GUEST_CART_KEY, '[]')).toBe(true);
    expect(s.map.get(GUEST_CART_KEY)).toBe('[]');
    expect(safeStorageWrite(s, GUEST_CART_KEY, null)).toBe(true);
    expect(s.map.has(GUEST_CART_KEY)).toBe(false);
  });

  it('safeStorageWrite never throws on a full or missing storage', () => {
    expect(safeStorageWrite(fakeStorage({ throwOnSet: true }), GUEST_CART_KEY, '[1]')).toBe(false);
    expect(safeStorageWrite(null, GUEST_CART_KEY, '[1]')).toBe(false);
  });

  it('parseStoredGuestCart tolerates garbage', () => {
    expect(parseStoredGuestCart(null)).toEqual([]);
    expect(parseStoredGuestCart('{not json')).toEqual([]);
    expect(parseStoredGuestCart('{"a":1}')).toEqual([]);
    expect(parseStoredGuestCart(JSON.stringify([line({ id: 'l1' })]))).toEqual([line({ id: 'l1' })]);
  });

  it('guestCartFromStorageEvent reads only the cart key', () => {
    const lines = [line({ id: 'l1', quantity: 2 })];
    expect(guestCartFromStorageEvent({ key: GUEST_CART_KEY, newValue: JSON.stringify(lines) })).toEqual(lines);
    expect(guestCartFromStorageEvent({ key: GUEST_CART_KEY, newValue: null })).toEqual([]);
    expect(guestCartFromStorageEvent({ key: 'guest_coupon', newValue: '{}' })).toBeNull();
    expect(guestCartFromStorageEvent({ key: null, newValue: null })).toBeNull();
  });
});
