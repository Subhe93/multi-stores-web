import { describe, expect, it } from 'vitest';
import { buildProductJsonLd, MAX_LD_VARIANTS, optionProperty, shippingDetailsLd, type LdProduct, type ProductJsonLdInput } from './productJsonLd';

const CANONICAL = 'https://namez.shop/de-de/products/abschlussschild-mit-goldschrift';
const ORG = 'https://namez.shop/#organization';

function input(product: Partial<LdProduct>, extra: Partial<ProductJsonLdInput> = {}): ProductJsonLdInput {
  return {
    product: { id: 'p1', base_price: 390, ...product },
    name: 'Halsband',
    descriptionHtml: '<p>Fint&nbsp;halsband</p>',
    locale: 'de',
    canonical: CANONICAL,
    images: ['https://api.example.com/uploads/a.webp'],
    brand: 'Namez',
    sellerId: ORG,
    currency: 'SEK',
    resolveMedia: (u) => `https://api.example.com${u}`,
    ...extra,
  };
}

const variant = (id: string, price: number, options: Record<string, string>, more: Record<string, unknown> = {}) => ({
  id,
  price,
  stock: 5,
  options,
  is_active: true,
  ...more,
});

describe('buildProductJsonLd simple product', () => {
  it('Product with url = offers.url = canonical, seller, decoded description', () => {
    const ld = buildProductJsonLd(input({}));
    expect(ld['@type']).toBe('Product');
    expect(ld.url).toBe(CANONICAL);
    expect(ld.description).toBe('Fint halsband');
    expect(ld.brand).toEqual({ '@type': 'Brand', name: 'Namez' });
    const offers = ld.offers as Record<string, unknown>;
    expect(offers.url).toBe(CANONICAL);
    expect(offers.price).toBe('390.00');
    expect(offers.seller).toEqual({ '@id': ORG });
    expect(offers).not.toHaveProperty('shippingDetails');
    expect(ld).not.toHaveProperty('sku');
  });

  it('sku only when set, never the id', () => {
    expect(buildProductJsonLd(input({ sku: 'NZ-1' })).sku).toBe('NZ-1');
    expect(buildProductJsonLd(input({ sku: '  ' }))).not.toHaveProperty('sku');
  });

  it('one active variant stays a Product', () => {
    const ld = buildProductJsonLd(
      input({ variants: [variant('v1', 390, { Färg: 'Guld' }), variant('v2', 450, { Färg: 'Silver' }, { is_active: false })] }),
    );
    expect(ld['@type']).toBe('Product');
  });
});

describe('buildProductJsonLd variants', () => {
  const product: Partial<LdProduct> = {
    variants: [
      variant('v1', 390, { Färg: 'Guld', Djur: 'Katt' }, { sku: 'NZ-G' }),
      variant('v2', 510, { Färg: 'Silver', Djur: 'Hund' }, { stock: 0, images: [{ url: '/uploads/v2.webp' }] }),
      variant('v3', 999, { Färg: 'Rosé', Djur: 'Häst' }, { is_active: false }),
    ],
    variant_option_config: [{ name: 'Färg', imageMap: { Guld: '/uploads/guld.webp' } }],
    translations: [
      {
        locale: 'de',
        variant_option_labels: {
          names: { Färg: 'Farbe', Djur: 'Tier' },
          values: { Färg: { Guld: 'Gold' }, Djur: { Katt: 'Katze' } },
        },
      },
    ],
  };

  it('ProductGroup with per-variant price, sku, availability, image and labels', () => {
    const ld = buildProductJsonLd(input(product));
    expect(ld['@type']).toBe('ProductGroup');
    expect(ld['@id']).toBe(`${CANONICAL}#product`);
    expect(ld.url).toBe(CANONICAL);
    expect(ld.productGroupID).toBe('p1');
    expect(ld.variesBy).toEqual(['https://schema.org/color']);
    const vs = ld.hasVariant as Record<string, unknown>[];
    // The inactive variant is skipped.
    expect(vs).toHaveLength(2);
    expect(vs[0]).toMatchObject({
      '@type': 'Product',
      name: 'Halsband – Gold / Katze',
      sku: 'NZ-G',
      color: 'Gold',
      image: 'https://api.example.com/uploads/guld.webp',
      additionalProperty: [{ '@type': 'PropertyValue', name: 'Tier', value: 'Katze' }],
      offers: {
        '@type': 'Offer',
        url: CANONICAL,
        price: '390.00',
        priceCurrency: 'SEK',
        availability: 'https://schema.org/InStock',
        seller: { '@id': ORG },
      },
    });
    expect(vs[1]).toMatchObject({
      name: 'Halsband – Silver / Hund',
      color: 'Silver',
      image: 'https://api.example.com/uploads/v2.webp',
      offers: { price: '510.00', availability: 'https://schema.org/OutOfStock' },
    });
    expect(vs[1]).not.toHaveProperty('sku');
  });

  it('productGroupID is the product sku when set', () => {
    expect(buildProductJsonLd(input({ ...product, sku: 'NZ' })).productGroupID).toBe('NZ');
  });

  it('variant without its own or a mapped image: the gallery image', () => {
    const ld = buildProductJsonLd(input({ variants: [variant('a', 1, { Antal: '1' }), variant('b', 2, { Antal: '2' })] }));
    for (const v of ld.hasVariant as Record<string, unknown>[]) {
      expect(v.image).toBe('https://api.example.com/uploads/a.webp');
    }
  });

  it('no mapped option: no variesBy', () => {
    const ld = buildProductJsonLd(input({ variants: [variant('a', 1, { Antal: '1' }), variant('b', 2, { Antal: '2' })] }));
    expect(ld).not.toHaveProperty('variesBy');
  });

  it(`more than ${MAX_LD_VARIANTS} variants: AggregateOffer`, () => {
    const many = Array.from({ length: MAX_LD_VARIANTS + 1 }, (_, i) => variant(`v${i}`, 100 + i, { Storlek: String(i) }));
    const ld = buildProductJsonLd(input({ variants: many }));
    expect(ld['@type']).toBe('Product');
    expect(ld.offers).toEqual({
      '@type': 'AggregateOffer',
      lowPrice: '100.00',
      highPrice: `${100 + MAX_LD_VARIANTS}.00`,
      offerCount: MAX_LD_VARIANTS + 1,
      priceCurrency: 'SEK',
      availability: 'https://schema.org/InStock',
    });
  });
});

describe('optionProperty', () => {
  it('maps keys and localized names', () => {
    expect(optionProperty('Färg')).toBe('color');
    expect(optionProperty('Variant', 'Größe')).toBe('size');
    expect(optionProperty('Mönster')).toBe('pattern');
    expect(optionProperty('Djur', 'Tier')).toBeNull();
  });
});

describe('shippingDetails', () => {
  const shipping = {
    requires_shipping: true,
    currency: 'EUR',
    rates: [
      { country: 'DE', cost: 9.9, min_days: 3, max_days: 6 },
      { country: 'AT', cost: 0, min_days: null, max_days: null },
    ],
  };

  it('shape: transitTime from days, no handlingTime', () => {
    const list = shippingDetailsLd(shipping) as Record<string, unknown>[];
    expect(list[0]).toEqual({
      '@type': 'OfferShippingDetails',
      shippingRate: { '@type': 'MonetaryAmount', value: 9.9, currency: 'EUR' },
      shippingDestination: { '@type': 'DefinedRegion', addressCountry: 'DE' },
      deliveryTime: {
        '@type': 'ShippingDeliveryTime',
        transitTime: { '@type': 'QuantitativeValue', minValue: 3, maxValue: 6, unitCode: 'DAY' },
      },
    });
    expect(JSON.stringify(list)).not.toContain('handlingTime');
    // deliveryTime is required by Google: a rate without days is left out.
    expect(list).toHaveLength(1);
  });

  it('requires_shipping false or no data: none', () => {
    expect(shippingDetailsLd({ ...shipping, requires_shipping: false })).toEqual([]);
    expect(shippingDetailsLd(null)).toEqual([]);
  });

  it('goes on the Offer and on every variant Offer', () => {
    const simple = buildProductJsonLd(input({}, { shipping }));
    expect((simple.offers as Record<string, unknown>).shippingDetails).toHaveLength(1);
    const group = buildProductJsonLd(
      input({ variants: [variant('a', 1, { Färg: 'A' }), variant('b', 2, { Färg: 'B' })] }, { shipping }),
    );
    for (const v of group.hasVariant as { offers: Record<string, unknown> }[]) {
      expect(v.offers.shippingDetails).toHaveLength(1);
    }
  });
});

describe('shippingRateCountries', () => {
  it('slot country, else market countries, else home country', async () => {
    const { NAMEZ_EU, NAMEZ_SE } = await import('./localePaths.fixtures');
    const { shippingRateCountries } = await import('./productJsonLd');
    expect(shippingRateCountries(NAMEZ_EU, '/de-at', 'SE')).toEqual(['AT']);
    expect(shippingRateCountries(NAMEZ_EU, '', 'SE')).toEqual(NAMEZ_EU.countries);
    expect(shippingRateCountries(NAMEZ_SE, undefined, null)).toEqual(['SE']);
    expect(shippingRateCountries(null, undefined, 'se')).toEqual(['SE']);
    expect(shippingRateCountries(null, undefined, null)).toEqual([]);
  });
});
