import { describe, expect, it } from 'vitest';
import { isColorOptionKey, isSizeOptionKey } from '@/lib/optionKeys';
import { resolveColor, swatchConfiguredImage, swatchCssColor } from '@/lib/swatches';
import { cardSizes, cardSwatches } from './options';
import type { CardSourceRow } from './model';

const v = (options: Record<string, string>, stock = 5, is_active = true) => ({ options, stock, is_active });

describe('option keys', () => {
  it('recognises size options in the supported languages', () => {
    for (const k of ['Size', 'Storlek', 'Größe', 'Taille', 'Beden', 'المقاس', 'قياس']) expect(isSizeOptionKey(k)).toBe(true);
    expect(isSizeOptionKey('Color')).toBe(false);
  });
  it('keeps the colour keywords of the product page picker', () => {
    for (const k of ['Color', 'Colour', 'اللون', 'Farbe', 'Couleur', 'Renk']) expect(isColorOptionKey(k)).toBe(true);
    expect(isColorOptionKey('Size')).toBe(false);
  });
});

describe('swatch helpers', () => {
  it('resolves names and literals', () => {
    expect(resolveColor('Black')).toBe('#000000');
    expect(resolveColor('#abc')).toBe('#abc');
    expect(resolveColor('rgb(1,2,3)')).toBe('rgb(1,2,3)');
    expect(resolveColor('Sand')).toBeNull();
  });
  it('prefers the seller colour and the swatch image', () => {
    expect(swatchCssColor({ colorMap: { Black: '#111111' } }, 'Black')).toBe('#111111');
    expect(swatchConfiguredImage({ swatchMap: { A: 's.png' }, imageMap: { A: 'i.png', B: 'b.png' } }, 'A')).toBe('s.png');
    expect(swatchConfiguredImage({ imageMap: { B: 'b.png' } }, 'B')).toBe('b.png');
  });
});

describe('cardSwatches', () => {
  it('is null without variants or without a colour option', () => {
    expect(cardSwatches({ id: 'p' })).toBeNull();
    expect(cardSwatches({ id: 'p', variants: [v({ Size: 'S' })] })).toBeNull();
  });

  it('reads the colour option in the seller order with the seller colours', () => {
    const row: CardSourceRow = {
      id: 'p',
      variants: [v({ Color: 'Black', Size: 'S' }), v({ Color: 'Sand', Size: 'S' }), v({ Color: 'Duo', Size: 'M' })],
      variant_option_config: [
        {
          name: 'Color',
          style: 'color',
          values: ['Sand', 'Duo', 'Black'],
          colorMap: { Sand: '#d8c7a8' },
          dualColorMap: { Duo: ['#111111', '#ffffff'] },
        },
      ],
    };
    expect(cardSwatches(row)).toEqual({
      items: [
        { value: 'Sand', css: '#d8c7a8' },
        { value: 'Duo', css: '#111111', css2: '#ffffff' },
        { value: 'Black', css: '#000000' },
      ],
      more: 0,
      total: 3,
    });
  });

  it('caps the dots at five and counts the rest', () => {
    const names = ['Black', 'White', 'Red', 'Blue', 'Green', 'Pink', 'Navy'];
    const out = cardSwatches({ id: 'p', variants: names.map((n) => v({ Colour: n })) });
    expect(out?.items).toHaveLength(5);
    expect(out?.more).toBe(2);
    expect(out?.total).toBe(7);
  });

  it('gives no dots when one value has no colour ("N colours")', () => {
    expect(cardSwatches({ id: 'p', variants: [v({ Color: 'Black' }), v({ Color: 'Dune' })] })).toEqual({
      items: [],
      more: 0,
      total: 2,
    });
  });

  it('uses the swatch image of an image-styled colour option', () => {
    const out = cardSwatches({
      id: 'p',
      variants: [v({ Color: 'Dune' }), v({ Color: 'Black' })],
      variant_option_config: [{ name: 'Color', style: 'image', swatchMap: { Dune: '/uploads/dune.jpg' } }],
    });
    expect(out?.items).toEqual([
      { value: 'Dune', image: '/uploads/dune.jpg' },
      { value: 'Black', css: '#000000' },
    ]);
  });

  it('takes an option styled as colour whatever its name, reads a keyed config and skips hidden variants', () => {
    const out = cardSwatches({
      id: 'p',
      variants: [v({ Shade: 'Red' }), v({ Shade: 'Blue' }, 3, false)],
      variant_option_config: { Shade: { style: 'color' } },
    });
    expect(out).toEqual({ items: [{ value: 'Red', css: '#ef4444' }], more: 0, total: 1 });
  });
});

describe('cardSizes', () => {
  it('is null without a size option', () => {
    expect(cardSizes({ id: 'p' })).toBeNull();
    expect(cardSizes({ id: 'p', variants: [v({ Color: 'Black' })] })).toBeNull();
  });

  it('keeps the seller order and marks sizes without stock', () => {
    const row: CardSourceRow = {
      id: 'p',
      variants: [
        v({ Size: 'M', Color: 'Black' }, 0),
        v({ Size: 'S', Color: 'Black' }, 2),
        v({ Size: 'L', Color: 'Black' }, 0),
        v({ Size: 'L', Color: 'Sand' }, 1),
        v({ Size: 'XL', Color: 'Sand' }, 4, false),
      ],
      variant_option_config: [{ name: 'Size', style: 'text', values: ['S', 'M', 'L', 'XL'] }],
    };
    expect(cardSizes(row)).toEqual({
      items: [
        { value: 'S', available: true },
        { value: 'M', available: false },
        { value: 'L', available: true },
      ],
      more: 0,
    });
  });

  it('counts unknown stock as available and caps at eight', () => {
    const variants = Array.from({ length: 10 }, (_, i) => ({ options: { Storlek: String(36 + i) } }));
    const out = cardSizes({ id: 'p', variants });
    expect(out?.items).toHaveLength(8);
    expect(out?.items.every((s) => s.available)).toBe(true);
    expect(out?.more).toBe(2);
  });
});
