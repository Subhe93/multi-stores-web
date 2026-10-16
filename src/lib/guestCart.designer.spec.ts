import { describe, expect, it, vi } from 'vitest';
import {
  addGuestLine,
  createGuestCartMover,
  guestLineKey,
  guestLineToServerBody,
  isSameGuestLine,
} from './guestCart';
import { encodeGuestCart, decodeGuestCart } from './cartHandoff';
import { lineKey } from './personalization';
import { normalizeCartItem, readCartLineDesign, type CartItem } from '@/hooks/useCart';

let n = 0;
const makeId = () => `local_test_${++n}`;
const design = (id: string, token = `tok-${id}`) => ({ design: { id, token, proofUrl: '/api/designer/files/p' } });

describe('line key with a design (M4.2, C11)', () => {
  it('a design id makes its own line key; no design keeps the old key', () => {
    expect(guestLineKey({ customFields: undefined })).toBe('');
    expect(guestLineKey({ customFields: undefined, designId: 'd1' })).toBe(lineKey(undefined, 'd1'));
    expect(guestLineKey({ customFields: undefined, designId: 'd1' })).not.toBe(guestLineKey({ customFields: undefined, designId: 'd2' }));
    expect(
      isSameGuestLine(
        { productId: 'p', designId: 'd1', customFields: undefined },
        { productId: 'p', designId: undefined, customFields: undefined },
      ),
    ).toBe(false);
  });

  it('the same design merges into one line; another design is a new line', () => {
    let cart: CartItem[] = [];
    cart = addGuestLine(cart, 'p1', null, 1, undefined, { price: 10, ...design('d1') }, makeId);
    cart = addGuestLine(cart, 'p1', null, 2, undefined, { price: 10, ...design('d1') }, makeId);
    cart = addGuestLine(cart, 'p1', null, 1, undefined, { price: 10, ...design('d2') }, makeId);
    expect(cart).toHaveLength(2);
    expect(cart[0]).toMatchObject({ designId: 'd1', designToken: 'tok-d1', quantity: 3 });
    expect(cart[0]!.design).toEqual({ id: 'd1', editable: true, proofUrl: '/api/designer/files/p' });
    expect(cart[1]).toMatchObject({ designId: 'd2', quantity: 1 });
  });

  it('designer lines carry no field values; other lines keep their exact shape', () => {
    const [designed] = addGuestLine([], 'p1', null, 1, { name: 'Anna' }, { ...design('d1') }, makeId);
    expect(designed!.customFields).toBeUndefined();
    const [plain] = addGuestLine([], 'p2', null, 1, undefined, { price: 5 }, makeId);
    expect(plain).not.toHaveProperty('designId');
    expect(plain).not.toHaveProperty('designToken');
    expect(plain).not.toHaveProperty('design');
  });
});

describe('guest → login migration with a design', () => {
  it('posts design_id + design_token (claims the design) and no custom_fields', () => {
    const [line] = addGuestLine([], 'p1', 'v1', 2, undefined, { ...design('d1', 'secret') }, makeId);
    expect(guestLineToServerBody(line!)).toEqual({
      product_id: 'p1',
      custom_product_id: undefined,
      variant_id: 'v1',
      bundle_offer_id: undefined,
      quantity: 2,
      design_id: 'd1',
      design_token: 'secret',
    });
  });

  it('a line without a design posts exactly the old body', () => {
    const [line] = addGuestLine([], 'p1', null, 1, { f1: 'x' }, {}, makeId);
    const body = guestLineToServerBody(line!);
    expect(body).not.toHaveProperty('design_id');
    expect(body).not.toHaveProperty('design_token');
    expect((body as { custom_fields?: unknown }).custom_fields).toEqual({ f1: 'x' });
  });

  it('the mover sends the token and keeps rejected designer lines locally', async () => {
    let stored: CartItem[] = [];
    stored = addGuestLine(stored, 'p1', null, 1, undefined, { ...design('ok', 't-ok') }, makeId);
    stored = addGuestLine(stored, 'p1', null, 1, undefined, { ...design('gone', 't-gone') }, makeId);
    const move = createGuestCartMover({ load: () => stored, save: (items) => void (stored = items) });
    const post = vi.fn(async (body: ReturnType<typeof guestLineToServerBody>) => {
      if ('design_id' in body && body.design_id === 'gone') {
        throw Object.assign(new Error('x'), { status: 404, code: 'DESIGNER_DESIGN_NOT_FOUND' });
      }
      return {};
    });
    const result = await move(post);
    expect(post.mock.calls.map(([b]) => (b as { design_token?: string }).design_token)).toEqual(['t-ok', 't-gone']);
    expect(result.moved.map((i) => i.designId)).toEqual(['ok']);
    expect(result.dropped.map((d) => d.item.designId)).toEqual(['gone']);
    expect(stored.map((i) => i.designId)).toEqual(['gone']);
  });
});

describe('cross-domain hand-off', () => {
  it('drops designer lines (their token must not travel in a URL) and counts them', () => {
    let cart: CartItem[] = [];
    cart = addGuestLine(cart, 'p1', null, 1, undefined, { ...design('d1', 'secret') }, makeId);
    cart = addGuestLine(cart, 'p2', null, 2, undefined, { title: 'Mug' }, makeId);
    const { param, dropped } = encodeGuestCart(cart);
    expect(dropped).toBe(1);
    expect(param).not.toBeNull();
    expect(param).not.toContain('secret');
    expect(decodeGuestCart(param)).toEqual([{ p: 'p2', q: 2, t: 'Mug' }]);
    expect(encodeGuestCart([cart[0]!])).toEqual({ param: null, dropped: 1 });
  });
});

describe('GET /cart designer rows', () => {
  it('reads the design block and shows its text values', () => {
    const item = normalizeCartItem({
      id: 'c1',
      productId: 'p1',
      price: 10,
      quantity: 1,
      imageUrl: '/api/designer/files/proof',
      customFieldDisplay: [],
      design: {
        id: 'd1',
        editable: true,
        proof_url: '/api/designer/files/proof',
        text_values: [
          { element_id: 'name', label: 'Namn', value: 'Anna' },
          { element_id: 'class', label: 'Klass', value: '' },
        ],
      },
    });
    expect(item.designId).toBe('d1');
    expect(item.design).toEqual({ id: 'd1', editable: true, proofUrl: '/api/designer/files/proof' });
    expect(item.customFieldDisplay).toEqual([{ id: 'name', label: 'Namn', value: 'Anna' }]);
  });

  it('rows without a design keep the old shape', () => {
    const item = normalizeCartItem({ id: 'c2', productId: 'p1', price: 1, quantity: 1 });
    expect(item).not.toHaveProperty('designId');
    expect(item).not.toHaveProperty('design');
    expect(readCartLineDesign(null)).toBeNull();
    expect(readCartLineDesign({ id: '' })).toBeNull();
  });
});
