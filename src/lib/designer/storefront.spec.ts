import { describe, expect, it } from 'vitest';
import { toKustomCartLines } from '@/hooks/useKustomCheckout';
import { normalizeCartItem, readCartLineDesign, type CartItem } from '@/hooks/useCart';
import { isLineErrorCode } from '@/lib/checkoutLineErrors';
import { guestLineToServerBody, patchGuestDesignLine, replaceGuestDesignLine } from '@/lib/guestCart';
import { isInvalidLine } from '@/components/cart/InvalidPersonalizationHint';
import { designEditHref, pickButtonText } from './storefront';
import { DesignerApiError, isUploadNetworkError, uploadError } from './api';
import { missingFontKeys, payloadFontLookup } from './fonts';
import type { DesignerFont } from './api';

const line = (over: Partial<CartItem>): CartItem => ({
  id: 'local_1',
  productId: 'p1',
  price: 10,
  quantity: 2,
  ...over,
});

describe('Kustom / quote lines of designer items (M4.2 blocker)', () => {
  it('a guest designer line sends design_id + design_token and no custom_fields', () => {
    const [l] = toKustomCartLines([
      line({ designId: 'd1', designToken: 'tok', customFields: { x: 'ignored' }, variantId: 'v1' }),
    ]);
    expect(l).toEqual({ quantity: 2, product_id: 'p1', variant_id: 'v1', design_id: 'd1', design_token: 'tok' });
  });

  it('a server-cart designer line (JWT owner) sends design_id only', () => {
    const [l] = toKustomCartLines([line({ id: 'srv-1', designId: 'd1' })]);
    expect(l).toEqual({ quantity: 2, product_id: 'p1', design_id: 'd1' });
    expect(l).not.toHaveProperty('design_token');
  });

  it('other lines keep their exact shape', () => {
    expect(toKustomCartLines([line({ customFields: { a: 1 } })])[0]).toEqual({
      quantity: 2,
      product_id: 'p1',
      custom_fields: { a: 1 },
    });
    expect(toKustomCartLines([line({ customFields: {} })])[0]).toEqual({ quantity: 2, product_id: 'p1' });
  });
});

describe('checkout line errors', () => {
  it('matches the designer codes too', () => {
    expect(isLineErrorCode('DESIGNER_DESIGN_LOCKED')).toBe(true);
    expect(isLineErrorCode('DESIGNER_DESIGN_REQUIRED')).toBe(true);
    expect(isLineErrorCode('CUSTOM_FIELD_REQUIRED')).toBe(true);
    expect(isLineErrorCode('PERSONALIZATION_INVALID')).toBe(true);
    expect(isLineErrorCode('ORDER_SHIPPING_METHOD_INVALID')).toBe(false);
    expect(isLineErrorCode(undefined)).toBe(false);
  });
});

describe('cart design block (product_slug, invalid)', () => {
  it('reads the new keys only when sent', () => {
    expect(readCartLineDesign({ id: 'd1', editable: true, proof_url: null })!.design).toEqual({
      id: 'd1',
      editable: true,
      proofUrl: null,
    });
    expect(
      readCartLineDesign({ id: 'd1', editable: true, product_slug: 'mug', invalid: true, invalid_code: 'DESIGNER_STATE_INVALID' })!
        .design,
    ).toEqual({ id: 'd1', editable: true, proofUrl: null, productSlug: 'mug', invalid: true, invalidCode: 'DESIGNER_STATE_INVALID' });
  });

  it('an invalid or ordered design blocks checkout like invalid personalization', () => {
    const invalid = normalizeCartItem({ id: 'a', product_id: 'p', price: 1, quantity: 1, design: { id: 'd', editable: true, invalid: true } } as never);
    expect(isInvalidLine(invalid)).toBe(true);
    const locked = normalizeCartItem({ id: 'b', product_id: 'p', price: 1, quantity: 1, design: { id: 'd', editable: false } } as never);
    expect(isInvalidLine(locked)).toBe(true);
    const ok = normalizeCartItem({ id: 'c', product_id: 'p', price: 1, quantity: 1, design: { id: 'd', editable: true } } as never);
    expect(isInvalidLine(ok)).toBe(false);
    expect(isInvalidLine({ personalizationInvalid: true })).toBe(true);
  });
});

describe('guest designer lines after an edit / a duplicate', () => {
  const cart = [
    line({ id: 'local_a', designId: 'd1', designToken: 't1', design: { id: 'd1', editable: true, proofUrl: '/old' } }),
    line({ id: 'local_b', productId: 'p2' }),
  ];

  it('patches the display and proof of the edited design only', () => {
    const next = patchGuestDesignLine(cart, 'd1', { display: [{ id: 'name', label: 'Name', value: 'Anna' }], proofUrl: '/new' });
    expect(next[0]!.customFieldDisplay).toEqual([{ id: 'name', label: 'Name', value: 'Anna' }]);
    expect(next[0]!.design!.proofUrl).toBe('/new');
    expect(next[1]).toBe(cart[1]);
    expect(patchGuestDesignLine(cart, 'other', { proofUrl: null })).toBe(cart);
  });

  it('moves a locked design line to its copy and drops the old token', () => {
    const next = replaceGuestDesignLine(cart, 'd1', { id: 'd2', token: 't2', proofUrl: null, productSlug: 'mug' });
    expect(next[0]).toMatchObject({ id: 'local_a', productId: 'p1', quantity: 2, designId: 'd2', designToken: 't2' });
    expect(next[0]!.design).toEqual({ id: 'd2', editable: true, proofUrl: null, productSlug: 'mug' });
    const noToken = replaceGuestDesignLine(cart, 'd1', { id: 'd3' });
    expect(noToken[0]).not.toHaveProperty('designToken');
    expect(replaceGuestDesignLine(cart, 'zzz', { id: 'd3' })).toBe(cart);
  });

  it('the server body of a replaced server line uses the new design', () => {
    expect(guestLineToServerBody(line({ id: 'srv', designId: 'd2', designToken: 't2' }))).toMatchObject({
      product_id: 'p1',
      design_id: 'd2',
      design_token: 't2',
    });
  });
});

describe('shop button text', () => {
  const raw = { sv: 'Designa din mugg', en: 'Design your mug', de: '' };
  it('uses the exact locale, else the primary locale, else nothing', () => {
    expect(pickButtonText(raw, 'en', 'sv')).toBe('Design your mug');
    expect(pickButtonText(raw, 'de', 'sv')).toBe('Designa din mugg');
    expect(pickButtonText(raw, 'fr', 'ar')).toBe('');
    expect(pickButtonText(raw, 'fr')).toBe('');
    expect(pickButtonText({}, 'en', 'sv')).toBe('');
    expect(pickButtonText('legacy', 'en')).toBe('');
  });
});

describe('edit link', () => {
  const lp = (p: string) => `/sv${p}`;
  it('prefers the product slug, falls back to the stored path', () => {
    expect(designEditHref('d1', 'mug one', '/old/path', lp)).toBe('/sv/products/mug%20one?design=d1');
    expect(designEditHref('d1', null, '/products/x', lp)).toBe('/products/x?design=d1');
    expect(designEditHref('d1', undefined, null, lp)).toBeNull();
  });
});

describe('upload errors', () => {
  it('maps a body-less 413 to DESIGNER_UPLOAD_TOO_LARGE and keeps coded errors', () => {
    expect(uploadError(413, null).code).toBe('DESIGNER_UPLOAD_TOO_LARGE');
    expect(uploadError(413, { code: 'DESIGNER_UPLOAD_DIMENSIONS' }).code).toBe('DESIGNER_UPLOAD_DIMENSIONS');
    expect(uploadError(429, { code: 'DESIGNER_UPLOAD_QUOTA' }).code).toBe('DESIGNER_UPLOAD_QUOTA');
    expect(uploadError(500, null).code).toBeUndefined();
  });

  it('a network failure has no code (client-only message)', () => {
    expect(isUploadNetworkError(new DesignerApiError(0, null))).toBe(true);
    expect(isUploadNetworkError(new DesignerApiError(413, { code: 'DESIGNER_UPLOAD_TOO_LARGE' }))).toBe(false);
    expect(isUploadNetworkError(new Error('x'))).toBe(false);
  });
});

describe('font lookup of the editor canvas', () => {
  const fonts: DesignerFont[] = [{ family: 'Brand', weight: 700, style: 'normal', url: '/f.woff2' }];
  const none = { has: () => false };
  const all = { has: () => true };

  it('a payload face counts only once loaded; other faces are left to the browser', () => {
    expect(payloadFontLookup(fonts, none).has('Brand', 700, 'normal')).toBe(false);
    expect(payloadFontLookup(fonts, all).has('Brand', 700, 'normal')).toBe(true);
    expect(payloadFontLookup(fonts, none).has('Arial', 400, 'normal')).toBe(true);
  });

  it('lists the faces still missing', () => {
    expect(missingFontKeys(fonts, none)).toEqual(['Brand|700|normal']);
    expect(missingFontKeys(fonts, all)).toEqual([]);
    expect(missingFontKeys([], none)).toEqual([]);
  });
});
