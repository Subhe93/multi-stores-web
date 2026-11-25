import { describe, expect, it } from 'vitest';
import type { ProductContext } from '../../../types';
import { resolveDynamicImage } from './dynamicSource';

// M170 A: the dynamic product image sources resolve the alt of the page
// locale (locale alt -> base-language alt -> default alt -> product title).

const product = (images: ProductContext['images']): ProductContext =>
  ({
    id: 'p1',
    base_price: 100,
    translations: [
      { locale: 'sv', title: 'Dalahäst', slug: 'dalahast' },
      { locale: 'de', title: 'Dalapferd', slug: 'dalapferd' },
    ],
    images,
  }) as unknown as ProductContext;

const nth = (p: ProductContext, n: number, locale: string) =>
  resolveDynamicImage('product_image_n', p, { image_index: n }, locale);

describe('resolveDynamicImage alt (M170 A)', () => {
  const p = product([
    { url: 'https://cdn.test/a.webp', alt_text: 'Röd dalahäst', alt_translations: { de: 'Rotes Dalapferd' } },
    { url: 'https://cdn.test/b.webp', alt_text: ' Blå häst ' },
    { url: 'https://cdn.test/c.webp', alt_text: null },
    { url: 'https://cdn.test/d.webp', alt_text: '   ', alt_translations: null },
  ]);

  it('uses the alt of the page locale, with the base-language fallback', () => {
    expect(nth(p, 1, 'de')?.alt).toBe('Rotes Dalapferd');
    expect(nth(p, 1, 'de-AT')?.alt).toBe('Rotes Dalapferd');
  });

  it('a locale without an alt uses the default alt', () => {
    expect(nth(p, 1, 'sv')?.alt).toBe('Röd dalahäst');
    expect(nth(p, 1, 'fr')?.alt).toBe('Röd dalahäst');
  });

  it('images without a map resolve as before: trimmed default alt, else the title', () => {
    expect(nth(p, 2, 'de')?.alt).toBe('Blå häst');
    expect(nth(p, 3, 'de')?.alt).toBe('Dalapferd');
    expect(nth(p, 3, 'sv')?.alt).toBe('Dalahäst');
    expect(nth(p, 4, 'sv')?.alt).toBe('Dalahäst');
  });
});
