import { describe, expect, it } from 'vitest';
import { resolvePalette, type PFieldDef, type POptionConfig } from '@multi-stores/core/personalization';

// COLOR_PALETTE drawn from an image-style product option (namez "Djur"):
// every entry carries the option's swatch picture so pieces 2..N show the
// same animal tiles as piece 1 instead of grey discs.
const field = (ui: Record<string, unknown>, options: string[] | null = null) =>
  ({ id: 'f', name: 'animal', type: 'COLOR_PALETTE', is_required: true, options, ui } as unknown as PFieldDef);

const optionConfig: POptionConfig[] = [
  {
    name: 'Djur',
    style: 'image',
    values: ['Zebra', 'Anka', 'Elefant'],
    swatchMap: { Zebra: '/uploads/z-swatch.webp', Anka: '/uploads/a-swatch.webp' },
    imageMap: { Zebra: '/uploads/z.webp', Anka: '/uploads/a.webp', Elefant: '/uploads/e.webp' },
  },
  { name: 'Färg', style: 'color', values: ['Röd', 'Blå'], colorMap: { Röd: '#ff0000' } },
];

describe('resolvePalette images', () => {
  it('image option: swatch picture first, then the value image, hex stays null', () => {
    const entries = resolvePalette(field({ palette_from_option: 'Djur' }), { optionConfig });
    expect(entries).toEqual([
      { value: 'Zebra', hex: null, image: '/uploads/z-swatch.webp' },
      { value: 'Anka', hex: null, image: '/uploads/a-swatch.webp' },
      { value: 'Elefant', hex: null, image: '/uploads/e.webp' },
    ]);
  });
  it('colour option and static lists carry no image', () => {
    expect(resolvePalette(field({ palette_from_option: 'Färg' }), { optionConfig })).toEqual([
      { value: 'Röd', hex: '#ff0000', image: null },
      { value: 'Blå', hex: null, image: null },
    ]);
    expect(resolvePalette(field({ palette_hex: { Guld: '#ffd700' } }, ['Guld']), { optionConfig })).toEqual([
      { value: 'Guld', hex: '#ffd700', image: null },
    ]);
  });
  it('only values on active variants remain', () => {
    const entries = resolvePalette(field({ palette_from_option: 'Djur' }), {
      optionConfig,
      activeOptionValues: { Djur: ['Anka'] },
    });
    expect(entries.map((e) => e.value)).toEqual(['Anka']);
  });
});
