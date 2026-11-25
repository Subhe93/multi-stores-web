import { describe, expect, it } from 'vitest';
import {
  buildProductJsonLd,
  MAX_LD_VARIANTS,
  optionProperty,
  returnPolicyLd,
  shippingDetailsLd,
  type LdProduct,
  type ProductJsonLdInput,
  type ProductReturnPolicy,
  type ProductShippingRates,
} from './productJsonLd';

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
        url: `${CANONICAL}?variant=v1`,
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

describe('buildProductJsonLd variant URLs (M170 B)', () => {
  const RED = '3f6c1c1e-0b7e-4a57-9a53-2f1a8f1d2c11';
  const BLUE = '9a1b2c3d-4e5f-4a6b-8c7d-0e1f2a3b4c5d';
  const OFF = '11111111-2222-4333-8444-555555555555';

  it('each variant offer url preselects it; the group url, @id and every other url stay the canonical', () => {
    const ld = buildProductJsonLd(
      input({
        variants: [
          variant(RED, 390, { Färg: 'Röd' }),
          variant(BLUE, 410, { Färg: 'Blå' }),
          variant(OFF, 500, { Färg: 'Grön' }, { is_active: false }),
        ],
      }),
    );
    expect(ld['@type']).toBe('ProductGroup');
    expect(ld.url).toBe(CANONICAL);
    expect(ld['@id']).toBe(`${CANONICAL}#product`);
    const vs = ld.hasVariant as { offers: Record<string, unknown> }[];
    expect(vs.map((v) => v.offers.url)).toEqual([`${CANONICAL}?variant=${RED}`, `${CANONICAL}?variant=${BLUE}`]);
    // An inactive variant gets no URL anywhere in the markup.
    expect(JSON.stringify(ld)).not.toContain(OFF);
    // The only change of M170 B: the offer keys and their order are as before.
    expect(Object.keys(vs[0].offers)).toEqual(['@type', 'url', 'price', 'priceCurrency', 'availability', 'seller']);
  });

  it('simple product: the single Offer is exactly the pre-M170 output (no variant URL)', () => {
    expect(buildProductJsonLd(input({ sku: 'NZ-1' }))).toEqual({
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: 'Halsband',
      description: 'Fint halsband',
      image: ['https://api.example.com/uploads/a.webp'],
      url: CANONICAL,
      sku: 'NZ-1',
      brand: { '@type': 'Brand', name: 'Namez' },
      offers: {
        '@type': 'Offer',
        url: CANONICAL,
        price: '390.00',
        priceCurrency: 'SEK',
        availability: 'https://schema.org/InStock',
        seller: { '@id': ORG },
      },
    });
  });

  it('single active variant: still one Offer on the canonical', () => {
    const ld = buildProductJsonLd(input({ variants: [variant(RED, 390, { Färg: 'Röd' })] }));
    expect(ld['@type']).toBe('Product');
    expect((ld.offers as Record<string, unknown>).url).toBe(CANONICAL);
    expect(JSON.stringify(ld)).not.toContain('?variant=');
  });

  it('more than the group limit: the AggregateOffer product is exactly the pre-M170 output', () => {
    const many = Array.from({ length: MAX_LD_VARIANTS + 1 }, (_, i) => variant(`v${i}`, 100 + i, { Storlek: String(i) }));
    const ld = buildProductJsonLd(input({ variants: many }));
    expect(ld).toEqual({
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: 'Halsband',
      description: 'Fint halsband',
      image: ['https://api.example.com/uploads/a.webp'],
      url: CANONICAL,
      brand: { '@type': 'Brand', name: 'Namez' },
      offers: {
        '@type': 'AggregateOffer',
        lowPrice: '100.00',
        highPrice: `${100 + MAX_LD_VARIANTS}.00`,
        offerCount: MAX_LD_VARIANTS + 1,
        priceCurrency: 'SEK',
        availability: 'https://schema.org/InStock',
      },
    });
    expect(JSON.stringify(ld)).not.toContain('?variant=');
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

// M170 C: handling time + return policy, fed by the two optional keys of the
// shipping-rates read. Without them every output above stays as it is.
describe('M170 C: handlingTime', () => {
  const shipping: ProductShippingRates = {
    requires_shipping: true,
    currency: 'SEK',
    rates: [
      { country: 'SE', cost: 49, min_days: 1, max_days: 3 },
      { country: 'NO', cost: 99, min_days: null, max_days: null },
    ],
  };

  it('configured: deliveryTime carries handlingTime before transitTime', () => {
    const list = shippingDetailsLd({ ...shipping, handling_days: { min: 1, max: 2 } }) as Record<string, unknown>[];
    expect(list).toEqual([
      {
        '@type': 'OfferShippingDetails',
        shippingRate: { '@type': 'MonetaryAmount', value: 49, currency: 'SEK' },
        shippingDestination: { '@type': 'DefinedRegion', addressCountry: 'SE' },
        deliveryTime: {
          '@type': 'ShippingDeliveryTime',
          handlingTime: { '@type': 'QuantitativeValue', minValue: 1, maxValue: 2, unitCode: 'DAY' },
          transitTime: { '@type': 'QuantitativeValue', minValue: 1, maxValue: 3, unitCode: 'DAY' },
        },
      },
    ]);
    expect(Object.keys(list[0].deliveryTime as object)).toEqual(['@type', 'handlingTime', 'transitTime']);
  });

  it('a rate without a transit estimate is still left out (handling alone is no delivery time)', () => {
    const list = shippingDetailsLd({ ...shipping, handling_days: { min: 0, max: 0 } });
    expect(list).toHaveLength(1);
    expect(JSON.stringify(list)).not.toContain('"NO"');
    expect(JSON.stringify(list)).toContain('"handlingTime":{"@type":"QuantitativeValue","minValue":0,"maxValue":0');
  });

  it('not configured or not a valid range: byte-identical to the output without the key', () => {
    const plain = JSON.stringify(shippingDetailsLd(shipping));
    expect(plain).not.toContain('handlingTime');
    for (const handling_days of [
      undefined,
      null,
      {},
      { min: 2, max: 1 },
      { min: -1, max: 2 },
      { min: 1.5, max: 2 },
      { min: '1', max: '2' },
      { min: 1 },
      'soon',
    ]) {
      expect(JSON.stringify(shippingDetailsLd({ ...shipping, handling_days } as unknown as ProductShippingRates))).toBe(plain);
    }
  });
});

describe('M170 C: returnPolicyLd', () => {
  const rates = (return_policies: unknown, more: Partial<ProductShippingRates> = {}): ProductShippingRates =>
    ({ requires_shipping: true, currency: 'SEK', rates: [], return_policies, ...more }) as ProductShippingRates;
  const finite: ProductReturnPolicy = { countries: ['SE'], category: 'finite', days: 14 };
  const S = 'https://schema.org/';

  it('the documented shape: finite window, by mail, fixed fee in the page currency', () => {
    expect(returnPolicyLd(rates([{ ...finite, methods: ['mail'], fees: 'fixed', fee_amount: 49 }]))).toEqual({
      '@type': 'MerchantReturnPolicy',
      applicableCountry: 'SE',
      returnPolicyCategory: `${S}MerchantReturnFiniteReturnWindow`,
      merchantReturnDays: 14,
      returnMethod: `${S}ReturnByMail`,
      returnFees: `${S}ReturnShippingFees`,
      returnShippingFeesAmount: { '@type': 'MonetaryAmount', value: 49, currency: 'SEK' },
    });
    const eur = returnPolicyLd(
      rates([{ countries: ['AT'], category: 'finite', days: 14, fees: 'fixed', fee_amount: 4.9 }], { currency: 'EUR' }),
    ) as Record<string, unknown>;
    expect(eur.applicableCountry).toBe('AT');
    expect(eur.returnShippingFeesAmount).toEqual({ '@type': 'MonetaryAmount', value: 4.9, currency: 'EUR' });
  });

  it('nothing configured, nothing covering the page, or a product that does not ship: undefined', () => {
    expect(returnPolicyLd(null)).toBeUndefined();
    expect(returnPolicyLd(undefined)).toBeUndefined();
    expect(returnPolicyLd({ requires_shipping: true, currency: 'SEK', rates: [] })).toBeUndefined();
    expect(returnPolicyLd(rates(null))).toBeUndefined();
    expect(returnPolicyLd(rates([]))).toBeUndefined();
    expect(returnPolicyLd(rates({ countries: ['SE'] }))).toBeUndefined();
    expect(returnPolicyLd(rates([finite], { requires_shipping: false }))).toBeUndefined();
  });

  it('category mapping; only a finite window states days', () => {
    const finiteLd = returnPolicyLd(rates([finite])) as Record<string, unknown>;
    expect(finiteLd).toEqual({
      '@type': 'MerchantReturnPolicy',
      applicableCountry: 'SE',
      returnPolicyCategory: `${S}MerchantReturnFiniteReturnWindow`,
      merchantReturnDays: 14,
    });
    expect(returnPolicyLd(rates([{ countries: ['SE'], category: 'unlimited' }]))).toEqual({
      '@type': 'MerchantReturnPolicy',
      applicableCountry: 'SE',
      returnPolicyCategory: `${S}MerchantReturnUnlimitedWindow`,
    });
    expect(returnPolicyLd(rates([{ countries: ['SE'], category: 'none' }]))).toEqual({
      '@type': 'MerchantReturnPolicy',
      applicableCountry: 'SE',
      returnPolicyCategory: `${S}MerchantReturnNotPermitted`,
    });
  });

  it('method mapping: a string for one, a list for several', () => {
    const ld = (methods: ProductReturnPolicy['methods']) =>
      (returnPolicyLd(rates([{ ...finite, methods }])) as Record<string, unknown>).returnMethod;
    expect(ld(['mail'])).toBe(`${S}ReturnByMail`);
    expect(ld(['store'])).toBe(`${S}ReturnInStore`);
    expect(ld(['kiosk'])).toBe(`${S}ReturnAtKiosk`);
    expect(ld(['mail', 'store', 'kiosk'])).toEqual([`${S}ReturnByMail`, `${S}ReturnInStore`, `${S}ReturnAtKiosk`]);
    expect(returnPolicyLd(rates([{ ...finite, methods: [] }]))).not.toHaveProperty('returnMethod');
  });

  it('fees mapping; the amount only with a fixed fee', () => {
    const ld = (more: Partial<ProductReturnPolicy>) => returnPolicyLd(rates([{ ...finite, ...more }])) as Record<string, unknown>;
    expect(ld({ fees: 'free' }).returnFees).toBe(`${S}FreeReturn`);
    expect(ld({ fees: 'free' })).not.toHaveProperty('returnShippingFeesAmount');
    expect(ld({ fees: 'customer' }).returnFees).toBe(`${S}ReturnFeesCustomerResponsibility`);
    expect(ld({ fees: 'customer' })).not.toHaveProperty('returnShippingFeesAmount');
    expect(ld({ fees: 'fixed', fee_amount: 49 })).toMatchObject({
      returnFees: `${S}ReturnShippingFees`,
      returnShippingFeesAmount: { '@type': 'MonetaryAmount', value: 49, currency: 'SEK' },
    });
    // Not stated by the owner: not stated in the markup.
    expect(ld({})).not.toHaveProperty('returnFees');
    expect(ld({})).not.toHaveProperty('returnMethod');
  });

  it('several countries: applicableCountry is a list; several policies: a list of policies', () => {
    const one = returnPolicyLd(rates([{ ...finite, countries: ['DE', 'AT'] }])) as Record<string, unknown>;
    expect(one.applicableCountry).toEqual(['DE', 'AT']);
    const many = returnPolicyLd(rates([{ ...finite, countries: ['DE'] }, { countries: ['AT', 'CH'], category: 'none' }]));
    expect(many).toEqual([
      {
        '@type': 'MerchantReturnPolicy',
        applicableCountry: 'DE',
        returnPolicyCategory: `${S}MerchantReturnFiniteReturnWindow`,
        merchantReturnDays: 14,
      },
      {
        '@type': 'MerchantReturnPolicy',
        applicableCountry: ['AT', 'CH'],
        returnPolicyCategory: `${S}MerchantReturnNotPermitted`,
      },
    ]);
  });

  it('a malformed entry is skipped, never repaired; the well-formed ones stay', () => {
    const bad: unknown[] = [
      null,
      'x',
      {},
      { countries: ['SE'] },
      { countries: ['SE'], category: 'maybe' },
      { countries: ['SE'], category: 'toString' },
      { countries: [], category: 'unlimited' },
      { countries: 'SE', category: 'unlimited' },
      { countries: ['se'], category: 'unlimited' },
      { countries: ['SE', 'SWE'], category: 'unlimited' },
      { countries: Array.from({ length: 51 }, () => 'SE'), category: 'unlimited' },
      { countries: ['SE'], category: 'finite' },
      { countries: ['SE'], category: 'finite', days: 0 },
      { countries: ['SE'], category: 'finite', days: 14.5 },
      { countries: ['SE'], category: 'unlimited', days: 14 },
      { countries: ['SE'], category: 'none', methods: ['mail'] },
      { countries: ['SE'], category: 'none', fees: 'free' },
      { ...finite, methods: ['post'] },
      { ...finite, methods: 'mail' },
      { ...finite, fees: 'cheap' },
      { ...finite, fees: 'fixed' },
      { ...finite, fees: 'fixed', fee_amount: 0 },
      { ...finite, fees: 'fixed', fee_amount: '49' },
      { ...finite, fees: 'free', fee_amount: 49 },
    ];
    for (const entry of bad) {
      expect(returnPolicyLd(rates([entry]))).toBeUndefined();
    }
    const mixed = returnPolicyLd(rates([...bad, { ...finite, countries: ['NO'] }])) as Record<string, unknown>;
    expect(mixed.applicableCountry).toBe('NO');
    // A fixed fee without a currency cannot be stated.
    expect(returnPolicyLd(rates([{ ...finite, fees: 'fixed', fee_amount: 49 }], { currency: '' }))).toBeUndefined();
  });
});

describe('M170 C: buildProductJsonLd offers', () => {
  const RED = '3f6c1c1e-0b7e-4a57-9a53-2f1a8f1d2c11';
  const BLUE = '7b0e6a55-41c2-4e0b-8c8e-0d7a1f3b9a22';
  const shipping: ProductShippingRates = {
    requires_shipping: true,
    currency: 'SEK',
    rates: [{ country: 'SE', cost: 49, min_days: 1, max_days: 3 }],
    handling_days: { min: 1, max: 2 },
    return_policies: [{ countries: ['SE'], category: 'finite', days: 14, methods: ['mail'], fees: 'fixed', fee_amount: 49 }],
  };
  const policy = {
    '@type': 'MerchantReturnPolicy',
    applicableCountry: 'SE',
    returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
    merchantReturnDays: 14,
    returnMethod: 'https://schema.org/ReturnByMail',
    returnFees: 'https://schema.org/ReturnShippingFees',
    returnShippingFeesAmount: { '@type': 'MonetaryAmount', value: 49, currency: 'SEK' },
  };
  const details = [
    {
      '@type': 'OfferShippingDetails',
      shippingRate: { '@type': 'MonetaryAmount', value: 49, currency: 'SEK' },
      shippingDestination: { '@type': 'DefinedRegion', addressCountry: 'SE' },
      deliveryTime: {
        '@type': 'ShippingDeliveryTime',
        handlingTime: { '@type': 'QuantitativeValue', minValue: 1, maxValue: 2, unitCode: 'DAY' },
        transitTime: { '@type': 'QuantitativeValue', minValue: 1, maxValue: 3, unitCode: 'DAY' },
      },
    },
  ];
  const twoVariants = { variants: [variant(RED, 249, { Färg: 'Röd' }), variant(BLUE, 249, { Färg: 'Blå' })] };

  it('single Offer: shippingDetails with handlingTime, then hasMerchantReturnPolicy', () => {
    const ld = buildProductJsonLd(input({ base_price: 249 }, { shipping }));
    expect(ld.offers).toEqual({
      '@type': 'Offer',
      url: CANONICAL,
      price: '249.00',
      priceCurrency: 'SEK',
      availability: 'https://schema.org/InStock',
      seller: { '@id': ORG },
      shippingDetails: details,
      hasMerchantReturnPolicy: policy,
    });
    expect(Object.keys(ld.offers as object).slice(-2)).toEqual(['shippingDetails', 'hasMerchantReturnPolicy']);
  });

  it('every variant Offer carries both blocks next to its own ?variant= url (M170 B)', () => {
    const ld = buildProductJsonLd(input(twoVariants, { shipping }));
    expect(ld['@type']).toBe('ProductGroup');
    const vs = ld.hasVariant as { offers: Record<string, unknown> }[];
    expect(vs.map((v) => v.offers.url)).toEqual([`${CANONICAL}?variant=${RED}`, `${CANONICAL}?variant=${BLUE}`]);
    for (const v of vs) {
      expect(v.offers.shippingDetails).toEqual(details);
      expect(v.offers.hasMerchantReturnPolicy).toEqual(policy);
      expect(Object.keys(v.offers)).toEqual([
        '@type',
        'url',
        'price',
        'priceCurrency',
        'availability',
        'seller',
        'shippingDetails',
        'hasMerchantReturnPolicy',
      ]);
    }
    // The group node itself states no policy and keeps the canonical url.
    expect(ld).not.toHaveProperty('hasMerchantReturnPolicy');
    expect(ld.url).toBe(CANONICAL);
  });

  it('a return policy without any shipping rate still goes on the Offer', () => {
    const ld = buildProductJsonLd(input({}, { shipping: { ...shipping, rates: [], handling_days: undefined } }));
    const offers = ld.offers as Record<string, unknown>;
    expect(offers).not.toHaveProperty('shippingDetails');
    expect(offers.hasMerchantReturnPolicy).toEqual(policy);
  });

  it('AggregateOffer carries neither block', () => {
    const many = Array.from({ length: MAX_LD_VARIANTS + 1 }, (_, i) => variant(`v${i}`, 100 + i, { Storlek: String(i) }));
    const ld = buildProductJsonLd(input({ variants: many }, { shipping }));
    expect(Object.keys(ld.offers as object)).toEqual(['@type', 'lowPrice', 'highPrice', 'offerCount', 'priceCurrency', 'availability']);
    const json = JSON.stringify(ld);
    expect(json).not.toContain('hasMerchantReturnPolicy');
    expect(json).not.toContain('shippingDetails');
    expect(json).not.toContain('handlingTime');
  });

  it('a product that does not ship gets neither block', () => {
    const json = JSON.stringify(buildProductJsonLd(input(twoVariants, { shipping: { ...shipping, requires_shipping: false } })));
    expect(json).not.toContain('hasMerchantReturnPolicy');
    expect(json).not.toContain('shippingDetails');
  });

  it('store without the setting: byte-identical output for all three shapes', () => {
    const base: ProductShippingRates = { requires_shipping: true, currency: 'SEK', rates: shipping.rates };
    const empty = { ...base, handling_days: null, return_policies: [] };
    const many = Array.from({ length: MAX_LD_VARIANTS + 1 }, (_, i) => variant(`v${i}`, 100 + i, { Storlek: String(i) }));
    for (const product of [{}, twoVariants, { variants: many }]) {
      const before = JSON.stringify(buildProductJsonLd(input(product, { shipping: base })));
      expect(JSON.stringify(buildProductJsonLd(input(product, { shipping: empty })))).toBe(before);
      expect(before).not.toContain('hasMerchantReturnPolicy');
      expect(before).not.toContain('handlingTime');
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
