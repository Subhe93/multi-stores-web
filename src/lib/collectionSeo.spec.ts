import { describe, expect, it } from 'vitest';
import { collectionIsNoindex, collectionMetaDescription, collectionMetaTitle } from './collectionSeo';

describe('collection SEO', () => {
  it('title prefers meta_title, then name, then handle', () => {
    expect(collectionMetaTitle({ name: 'Barn', meta_title: 'Barn SEO' }, 'barn')).toBe('Barn SEO');
    expect(collectionMetaTitle({ name: 'Barn', meta_title: '  ' }, 'barn')).toBe('Barn');
    expect(collectionMetaTitle({ name: 'Barn' }, 'barn')).toBe('Barn');
    expect(collectionMetaTitle(undefined, 'barn')).toBe('barn');
  });

  it('description prefers meta_desc, else stripped body (unchanged legacy output)', () => {
    expect(collectionMetaDescription({ meta_desc: 'Short', description: '<p>Long</p>' })).toBe('Short');
    expect(collectionMetaDescription({ description: '<p>Long</p>' })).toBe('Long');
    expect(collectionMetaDescription({ description: 'x'.repeat(200) })).toHaveLength(160);
    expect(collectionMetaDescription({ description: '' })).toBeUndefined();
    expect(collectionMetaDescription(undefined)).toBeUndefined();
  });

  it('noindex only when flagged and the published count is exactly 0', () => {
    expect(collectionIsNoindex({ noindex_when_empty: true, published_product_count: 0 })).toBe(true);
    expect(collectionIsNoindex({ noindex_when_empty: true, published_product_count: 3 })).toBe(false);
    expect(collectionIsNoindex({ noindex_when_empty: true })).toBe(false);
    expect(collectionIsNoindex({ noindex_when_empty: false, published_product_count: 0 })).toBe(false);
    expect(collectionIsNoindex({})).toBe(false);
  });
});
