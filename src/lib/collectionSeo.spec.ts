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

  it('description falls back to the long description as plain text (M6.2)', () => {
    expect(collectionMetaDescription({ long_description: '<h2>Barn</h2><p>Kläder   för\nbarn.</p>' })).toBe(
      'Barn Kläder för barn.',
    );
    expect(collectionMetaDescription({ description: '<p>Short</p>', long_description: '<p>Long</p>' })).toBe('Short');
    expect(collectionMetaDescription({ description: '<p></p>', long_description: '<p>Long</p>' })).toBe('Long');
    expect(collectionMetaDescription({ long_description: `<p>${'y'.repeat(300)}</p>` })).toHaveLength(160);
    expect(collectionMetaDescription({ long_description: '<p></p>' })).toBeUndefined();
    expect(collectionMetaDescription({ long_description: '<p>&nbsp;</p>' })).toBeUndefined();
    expect(collectionMetaDescription({ long_description: '<p>Tom &amp; Jerry&#160;&lt;3&#x21;</p>' })).toBe('Tom & Jerry <3!');
    expect(collectionMetaDescription({ long_description: null })).toBeUndefined();
  });

  it('noindex only when flagged and the published count is exactly 0', () => {
    expect(collectionIsNoindex({ noindex_when_empty: true, published_product_count: 0 })).toBe(true);
    expect(collectionIsNoindex({ noindex_when_empty: true, published_product_count: 3 })).toBe(false);
    expect(collectionIsNoindex({ noindex_when_empty: true })).toBe(false);
    expect(collectionIsNoindex({ noindex_when_empty: false, published_product_count: 0 })).toBe(false);
    expect(collectionIsNoindex({})).toBe(false);
  });
});
