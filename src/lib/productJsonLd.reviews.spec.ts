import { describe, expect, it } from 'vitest';
import { buildProductJsonLd } from './productJsonLd';
import { buildProduct, ldJsonSafe } from './jsonld';
import type { ProductReviewsPage } from './reviews';
import { LD_FIXTURE_INPUTS, type LdShape } from '@/test/fixtures/productJsonLdInputs';
import golden from '@/test/fixtures/productJsonLd.m170.json';

// M171: aggregateRating + review in the product JSON-LD.
// `productJsonLd.m170.json` is the output of the builders as committed
// before the reviews app (recorded once from that code), so the "no reviews"
// cases below prove byte-identical markup for every store without reviews.

const reviews: Pick<ProductReviewsPage, 'summary' | 'items'> = {
  summary: { average: 4.6, count: 12, distribution: { '1': 0, '2': 0, '3': 1, '4': 3, '5': 8 } },
  items: [
    {
      id: 'r1',
      rating: 5,
      title: 'Perfect gift',
      body: 'Fast delivery and the engraving looks great.',
      display_name: 'Anna S.',
      locale: 'en',
      verified: true,
      published_at: '2026-11-20T10:12:00.000Z',
      reply: { body: 'Thank you!', replied_at: '2026-11-21T08:00:00.000Z' },
    },
    {
      id: 'r2',
      rating: 4,
      title: null,
      body: 'Snabb leverans och fin gravyr.',
      display_name: 'Erik',
      locale: 'sv',
      verified: true,
      published_at: '2026-11-18T09:00:00.000Z',
      reply: null,
    },
  ],
};

const EXPECTED_RATING = {
  '@type': 'AggregateRating',
  ratingValue: 4.6,
  reviewCount: 12,
  bestRating: 5,
  worstRating: 1,
};

const SHAPES: LdShape[] = ['product', 'group', 'aggregate'];
const NO_REVIEWS: Pick<ProductReviewsPage, 'summary' | 'items'> = {
  summary: { average: 0, count: 0, distribution: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 } },
  items: [],
};

describe('product JSON-LD without reviews: byte-identical to the output before M171', () => {
  for (const shape of SHAPES) {
    it(`${shape}: no input, undefined, null and zero reviews`, () => {
      const input = LD_FIXTURE_INPUTS[shape];
      const expected = (golden as Record<string, string>)[shape];
      expect(JSON.stringify(buildProductJsonLd(input))).toBe(expected);
      expect(JSON.stringify(buildProductJsonLd({ ...input, reviews: undefined }))).toBe(expected);
      expect(JSON.stringify(buildProductJsonLd({ ...input, reviews: null }))).toBe(expected);
      expect(JSON.stringify(buildProductJsonLd({ ...input, reviews: NO_REVIEWS }))).toBe(expected);
      // Reviews exist but none is rendered on the page: nothing is marked up.
      expect(JSON.stringify(buildProductJsonLd({ ...input, reviews: { ...reviews, items: [] } }))).toBe(expected);
      expect(expected).not.toMatch(/aggregateRating|"review"/);
    });
  }

  it('the fixture covers the three shapes', () => {
    expect(JSON.parse((golden as Record<string, string>).product!)['@type']).toBe('Product');
    expect(JSON.parse((golden as Record<string, string>).group!)['@type']).toBe('ProductGroup');
    const aggregate = JSON.parse((golden as Record<string, string>).aggregate!);
    expect(aggregate['@type']).toBe('Product');
    expect(aggregate.offers['@type']).toBe('AggregateOffer');
  });

  it('buildProduct without review markup is unchanged', () => {
    const input = {
      name: 'A',
      url: 'https://x.se/a',
      images: ['https://x.se/a.jpg'],
      price: 10,
      priceCurrency: 'SEK',
      sku: 'S',
      brand: 'B',
      videos: [{ '@type': 'VideoObject' }],
    };
    expect(JSON.stringify(buildProduct(input))).toBe((golden as Record<string, string>).buildProduct);
    expect(JSON.stringify(buildProduct({ ...input, reviewMarkup: undefined }))).toBe(
      (golden as Record<string, string>).buildProduct,
    );
  });
});

/** The object without the two review keys, serialized. */
function withoutReviewKeys(ld: Record<string, unknown>): string {
  const rest = { ...ld };
  delete rest.aggregateRating;
  delete rest.review;
  return JSON.stringify(rest);
}

describe('product JSON-LD with reviews', () => {
  it('Product: aggregateRating and review after offers, every other key untouched', () => {
    const ld = buildProductJsonLd({ ...LD_FIXTURE_INPUTS.product, reviews });
    expect(ld['@type']).toBe('Product');
    expect(ld.aggregateRating).toEqual(EXPECTED_RATING);
    expect(ld.review).toEqual([
      {
        '@type': 'Review',
        author: { '@type': 'Person', name: 'Anna S.' },
        datePublished: '2026-11-20',
        name: 'Perfect gift',
        reviewBody: 'Fast delivery and the engraving looks great.',
        reviewRating: { '@type': 'Rating', ratingValue: 5, bestRating: 5, worstRating: 1 },
      },
      {
        '@type': 'Review',
        author: { '@type': 'Person', name: 'Erik' },
        datePublished: '2026-11-18',
        reviewBody: 'Snabb leverans och fin gravyr.',
        reviewRating: { '@type': 'Rating', ratingValue: 4, bestRating: 5, worstRating: 1 },
      },
    ]);
    const keys = Object.keys(ld);
    expect(keys.indexOf('aggregateRating')).toBe(keys.indexOf('offers') + 1);
    expect(keys.indexOf('review')).toBe(keys.indexOf('aggregateRating') + 1);
    expect(withoutReviewKeys(ld)).toBe((golden as Record<string, string>).product);
  });

  it('ProductGroup: on the group, last, and never on a hasVariant item', () => {
    const ld = buildProductJsonLd({ ...LD_FIXTURE_INPUTS.group, reviews });
    expect(ld['@type']).toBe('ProductGroup');
    expect(ld.aggregateRating).toEqual(EXPECTED_RATING);
    expect(ld.review).toHaveLength(2);
    expect(Object.keys(ld).slice(-2)).toEqual(['aggregateRating', 'review']);
    const variants = ld.hasVariant as Record<string, unknown>[];
    expect(variants.length).toBeGreaterThan(1);
    for (const v of variants) {
      expect(v).not.toHaveProperty('aggregateRating');
      expect(v).not.toHaveProperty('review');
      expect(v.offers).not.toHaveProperty('aggregateRating');
    }
    // M170 output (variant URLs, return policy, handling time) is untouched.
    expect(withoutReviewKeys(ld)).toBe((golden as Record<string, string>).group);
  });

  it('more than 100 variants: on the Product with the AggregateOffer', () => {
    const ld = buildProductJsonLd({ ...LD_FIXTURE_INPUTS.aggregate, reviews });
    expect(ld['@type']).toBe('Product');
    expect((ld.offers as Record<string, unknown>)['@type']).toBe('AggregateOffer');
    expect(ld.aggregateRating).toEqual(EXPECTED_RATING);
    expect(ld.offers).not.toHaveProperty('aggregateRating');
    expect(withoutReviewKeys(ld)).toBe((golden as Record<string, string>).aggregate);
  });

  it('no personal or internal data, no owner reply, no undefined / null value', () => {
    const json = JSON.stringify(buildProductJsonLd({ ...LD_FIXTURE_INPUTS.group, reviews }));
    expect(json).not.toMatch(/Thank you!|verified|"id":"r1"|customer|order|null|undefined/);
  });

  it('review text cannot close the script tag', () => {
    const hostile = {
      ...reviews,
      items: [{ ...reviews.items[0]!, body: '</script><script>alert(1)</script>', display_name: '<b>x</b>' }],
    };
    const html = ldJsonSafe(buildProductJsonLd({ ...LD_FIXTURE_INPUTS.product, reviews: hostile }));
    expect(html).not.toContain('<');
    expect(JSON.parse(html).review[0].reviewBody).toBe('</script><script>alert(1)</script>');
  });
});
