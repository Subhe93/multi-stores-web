import { describe, expect, it } from 'vitest';
import { buildLineMetadata, variantLabel } from './cartLine';

describe('variantLabel', () => {
  it('joins options as "Name: value" pairs', () => {
    expect(variantLabel({ Color: 'Red', Size: 'M' })).toBe('Color: Red / Size: M');
  });
  it('is empty without options', () => {
    expect(variantLabel(undefined)).toBe('');
    expect(variantLabel({})).toBe('');
  });
});

describe('buildLineMetadata (shared by the product page and the theme section)', () => {
  it('omits optional keys instead of setting them to undefined (stored shape, G0)', () => {
    const meta = buildLineMetadata({ title: 'Mug', unitPrice: 10 });
    expect(meta).toEqual({ title: 'Mug', price: 10 });
    expect(Object.keys(meta)).toEqual(['title', 'price']);
  });

  it('carries variant label, currency, rate, image and custom product id', () => {
    const meta = buildLineMetadata({
      title: 'Tee',
      unitPrice: 20,
      imageUrl: 'https://cdn/x.jpg',
      variantOptions: { Size: 'L' },
      currency: 'SEK',
      taxRateBp: 2500,
      customProductId: 'cp1',
      customerFile: 'https://api/uploads/customer-previews/a.webp',
    });
    expect(meta).toEqual({
      title: 'Tee',
      price: 20,
      imageUrl: 'https://cdn/x.jpg',
      variant: 'Size: L',
      currency: 'SEK',
      taxRateBp: 2500,
      customProductId: 'cp1',
      customerFile: 'https://api/uploads/customer-previews/a.webp',
    });
  });

  it('keeps a 0 % rate (known rate) but drops null / undefined', () => {
    expect(buildLineMetadata({ title: 'A', unitPrice: 1, taxRateBp: 0 }).taxRateBp).toBe(0);
    expect('taxRateBp' in buildLineMetadata({ title: 'A', unitPrice: 1, taxRateBp: null })).toBe(false);
  });

  it('maps the chosen bundle offer', () => {
    const meta = buildLineMetadata({
      title: 'A',
      unitPrice: 8,
      bundle: { offerId: 'o1', originalUnitPrice: 10, title: 'Buy 3', label: 'Popular', cartQuantity: 3 },
    });
    expect(meta).toMatchObject({
      price: 8,
      bundleOfferId: 'o1',
      bundleOriginalUnitPrice: 10,
      bundleTitle: 'Buy 3',
      bundleLabel: 'Popular',
      bundleCartQuantity: 3,
    });
    expect('bundleStickerText' in meta).toBe(false);
  });

  it('attaches the display lines, the guest check and the design', () => {
    const display = [{ id: 'f1', label: 'Name', value: 'Anna' }];
    const check = { storeSlug: 's', locale: 'sv', market: null };
    const design = { id: 'd1', token: 't', proofUrl: null };
    expect(buildLineMetadata({ title: 'A', unitPrice: 1 }, { customFieldDisplay: display })).toMatchObject({ customFieldDisplay: display });
    expect(buildLineMetadata({ title: 'A', unitPrice: 1 }, { personalizationCheck: check })).toMatchObject({ personalizationCheck: check });
    expect(buildLineMetadata({ title: 'A', unitPrice: 1 }, { design })).toMatchObject({ design });
  });
});
