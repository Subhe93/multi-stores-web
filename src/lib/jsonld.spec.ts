import { describe, expect, it } from 'vitest';
import { buildOrganization, buildProduct, buildWebSite } from './jsonld';
import { buildVideoObjectsJsonLd, type StorefrontProductVideo } from './productVideo';

// Product JSON-LD and product video (contract 6.5): `image` stays image-only
// and `subjectOf` (VideoObject) appears only when the product has videos.

const base = {
  name: 'Mug',
  url: 'https://shop.example/products/mug',
  images: ['https://api.example/uploads/products/a.webp'],
  price: 100,
  priceCurrency: 'SEK',
};

const video: StorefrontProductVideo = {
  id: 'v1',
  kind: 'file',
  url: '/uploads/products/0f6c3d5e-1111-4222-8333-944455556666.mp4',
  poster_url: '/uploads/products/p.webp',
  duration_s: 32,
  width: 1280,
  height: 720,
  position: 1,
  alt: null,
  created_at: '2026-11-13T10:00:00.000Z',
};

const abs = (u: string) => (u.startsWith('http') ? u : `https://api.example${u}`);

describe('buildProduct and videos', () => {
  it('has no subjectOf without videos (unchanged JSON-LD)', () => {
    const plain = buildProduct(base);
    expect(plain).not.toHaveProperty('subjectOf');
    expect(JSON.stringify(buildProduct({ ...base, videos: [] }))).toBe(JSON.stringify(plain));
    expect(JSON.stringify(buildProduct({ ...base, videos: undefined }))).toBe(JSON.stringify(plain));
  });

  it('adds VideoObject entries as subjectOf; image stays image-only', () => {
    const videos = buildVideoObjectsJsonLd({
      videos: [video, { ...video, id: 'yt', kind: 'youtube', url: 'https://youtu.be/dQw4w9WgXcQ', alt: 'Demo' }, { ...video, id: 'np', poster_url: null }],
      productName: 'Mug',
      description: 'A mug.',
      toAbsoluteUrl: abs,
    });
    const ld = buildProduct({ ...base, videos }) as Record<string, unknown>;
    expect(ld.image).toEqual(base.images);
    expect(ld.subjectOf).toEqual([
      {
        '@type': 'VideoObject',
        name: 'Mug',
        description: 'A mug.',
        thumbnailUrl: 'https://api.example/uploads/products/p.webp',
        uploadDate: '2026-11-13T10:00:00.000Z',
        duration: 'PT32S',
        contentUrl: 'https://api.example/uploads/products/0f6c3d5e-1111-4222-8333-944455556666.mp4',
      },
      {
        '@type': 'VideoObject',
        name: 'Demo',
        description: 'A mug.',
        thumbnailUrl: 'https://api.example/uploads/products/p.webp',
        uploadDate: '2026-11-13T10:00:00.000Z',
        duration: 'PT32S',
        embedUrl: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
      },
    ]);
  });
});

describe('buildOrganization description', () => {
  it('is plain text even when the store description is editor HTML', () => {
    const ld = buildOrganization({
      name: 'Namez',
      url: 'https://namez.se',
      description: '<p>NameZ är en webbutik i Borlänge&nbsp;– Dalarna.</p><p>Allt tillverkas i Sverige.</p>',
    });
    expect(ld.description).toBe('NameZ är en webbutik i Borlänge – Dalarna. Allt tillverkas i Sverige.');
  });

  it('omits an empty or tag-only description', () => {
    expect(buildOrganization({ name: 'A', url: 'https://a.se', description: '<p>&nbsp;</p>' })).not.toHaveProperty('description');
    expect(buildOrganization({ name: 'A', url: 'https://a.se' })).not.toHaveProperty('description');
  });
});

describe('M161 B: ids, url, seller', () => {
  it('Organization @id, alternateName only when different', () => {
    const ld = buildOrganization({
      name: 'Namez',
      alternateName: 'Namez – Personliga presenter',
      id: 'https://namez.se/#organization',
      url: 'https://namez.se',
    }) as Record<string, unknown>;
    expect(ld['@id']).toBe('https://namez.se/#organization');
    expect(ld.alternateName).toBe('Namez – Personliga presenter');
    expect(buildOrganization({ name: 'A', alternateName: 'A', url: 'https://a.se' })).not.toHaveProperty('alternateName');
    expect(buildOrganization({ name: 'A', url: 'https://a.se' })).not.toHaveProperty('@id');
  });

  it('WebSite publisher only with an id', () => {
    expect(buildWebSite({ name: 'A', url: 'https://a.se', publisherId: 'https://a.se/#organization' })).toMatchObject({
      publisher: { '@id': 'https://a.se/#organization' },
    });
    expect(buildWebSite({ name: 'A', url: 'https://a.se' })).not.toHaveProperty('publisher');
  });

  it('Product: url added, otherwise unchanged without the new inputs', () => {
    const ld = buildProduct(base) as Record<string, unknown>;
    expect(ld.url).toBe(base.url);
    const { url: _url, ...rest } = ld;
    void _url;
    expect(JSON.stringify(rest)).toBe(
      JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: 'Mug',
        image: base.images,
        offers: {
          '@type': 'Offer',
          url: base.url,
          price: '100.00',
          priceCurrency: 'SEK',
          availability: 'https://schema.org/InStock',
        },
      }),
    );
  });

  it('Product: seller and shippingDetails on the Offer', () => {
    const ld = buildProduct({ ...base, sellerId: 'https://a.se/#organization', shippingDetails: [{ '@type': 'OfferShippingDetails' }] });
    expect(ld.offers).toMatchObject({
      seller: { '@id': 'https://a.se/#organization' },
      shippingDetails: [{ '@type': 'OfferShippingDetails' }],
    });
  });
});

describe('M170 C: buildProduct returnPolicy', () => {
  const policy = {
    '@type': 'MerchantReturnPolicy',
    applicableCountry: 'SE',
    returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
    merchantReturnDays: 14,
  };

  it('without it (absent, undefined or an empty list) the output is unchanged', () => {
    const plain = JSON.stringify(buildProduct(base));
    expect(JSON.stringify(buildProduct({ ...base, returnPolicy: undefined }))).toBe(plain);
    expect(JSON.stringify(buildProduct({ ...base, returnPolicy: [] }))).toBe(plain);
    expect(plain).not.toContain('hasMerchantReturnPolicy');
  });

  it('one policy: hasMerchantReturnPolicy is the last key of the Offer, after shippingDetails', () => {
    const ld = buildProduct({
      ...base,
      sellerId: 'https://a.se/#organization',
      shippingDetails: [{ '@type': 'OfferShippingDetails' }],
      returnPolicy: policy,
    });
    const offers = ld.offers as Record<string, unknown>;
    expect(offers.hasMerchantReturnPolicy).toEqual(policy);
    expect(Object.keys(offers)).toEqual([
      '@type',
      'url',
      'price',
      'priceCurrency',
      'availability',
      'seller',
      'shippingDetails',
      'hasMerchantReturnPolicy',
    ]);
  });

  it('several policies stay a list', () => {
    const list = [policy, { ...policy, applicableCountry: 'NO' }];
    const ld = buildProduct({ ...base, returnPolicy: list });
    expect((ld.offers as Record<string, unknown>).hasMerchantReturnPolicy).toEqual(list);
  });

  it('a custom offers object (AggregateOffer) never gets one', () => {
    const offers = { '@type': 'AggregateOffer', lowPrice: '1.00' };
    const ld = buildProduct({ ...base, offers, returnPolicy: policy });
    expect(ld.offers).toEqual(offers);
  });
});
