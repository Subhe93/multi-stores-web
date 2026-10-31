import { describe, expect, it } from 'vitest';
import {
  collectionHref,
  collectionPathFromTree,
  collectionPathInChain,
  resolveCollectionChain,
} from './collectionPath';

type Node = { id: string; slug: string; is_active?: boolean; children?: Node[] };

// skyltar › namnskyltar › 3d-namnskyltar, plus an inactive sibling branch.
const tree: Node[] = [
  {
    id: 'root',
    slug: 'skyltar',
    children: [
      {
        id: 'child',
        slug: 'namnskyltar',
        children: [{ id: 'grandchild', slug: '3d-namnskyltar' }],
      },
      { id: 'off', slug: 'gamla', is_active: false, children: [{ id: 'off-kid', slug: 'kid' }] },
    ],
  },
  { id: 'root2', slug: 'present' },
];

describe('collectionHref (M6.7)', () => {
  it('joins the hierarchical path under /collections/', () => {
    expect(collectionHref({ slug: '3d-namnskyltar', path: ['skyltar', 'namnskyltar', '3d-namnskyltar'] })).toBe(
      '/collections/skyltar/namnskyltar/3d-namnskyltar',
    );
  });

  it('keeps a root collection at /collections/<root>', () => {
    expect(collectionHref({ slug: 'skyltar', path: ['skyltar'] })).toBe('/collections/skyltar');
  });

  it('falls back to the flat slug when the payload has no path', () => {
    expect(collectionHref({ slug: 'namnskyltar' })).toBe('/collections/namnskyltar');
    expect(collectionHref({ slug: 'namnskyltar', path: null })).toBe('/collections/namnskyltar');
    expect(collectionHref({ slug: 'namnskyltar', path: [] })).toBe('/collections/namnskyltar');
  });
});

describe('collectionPathFromTree (M6.7)', () => {
  it('returns ancestors + self for a nested node', () => {
    expect(collectionPathFromTree(tree, 'grandchild')).toEqual(['skyltar', 'namnskyltar', '3d-namnskyltar']);
    expect(collectionPathFromTree(tree, 'child')).toEqual(['skyltar', 'namnskyltar']);
  });

  it('returns only the slug for a root', () => {
    expect(collectionPathFromTree(tree, 'root2')).toEqual(['present']);
  });

  it('returns [] for an unknown id', () => {
    expect(collectionPathFromTree(tree, 'nope')).toEqual([]);
  });

  it('round-trips through collectionHref', () => {
    const path = collectionPathFromTree(tree, 'grandchild');
    expect(collectionHref({ slug: '3d-namnskyltar', path })).toBe('/collections/skyltar/namnskyltar/3d-namnskyltar');
  });
});

describe('collectionPathInChain (M6.7)', () => {
  const chain = [{ slug: 'a' }, { slug: 'b', path: ['a', 'b'] }, { slug: 'c' }];

  it('prefers the node own path and otherwise uses the chain prefix', () => {
    expect(collectionPathInChain(chain, 0)).toEqual(['a']);
    expect(collectionPathInChain(chain, 1)).toEqual(['a', 'b']);
    expect(collectionPathInChain(chain, 2)).toEqual(['a', 'b', 'c']);
    expect(collectionPathInChain(chain, 5)).toEqual([]);
  });
});

describe('resolveCollectionChain (M6.7 route resolver)', () => {
  it('resolves root, child and grandchild URLs', () => {
    expect(resolveCollectionChain(tree, ['skyltar'])?.map((n) => n.id)).toEqual(['root']);
    expect(resolveCollectionChain(tree, ['skyltar', 'namnskyltar'])?.map((n) => n.id)).toEqual(['root', 'child']);
    expect(resolveCollectionChain(tree, ['skyltar', 'namnskyltar', '3d-namnskyltar'])?.map((n) => n.id)).toEqual([
      'root',
      'child',
      'grandchild',
    ]);
  });

  it('rejects a flat child URL, wrong order, extra or missing segments', () => {
    expect(resolveCollectionChain(tree, ['namnskyltar'])).toBeNull();
    expect(resolveCollectionChain(tree, ['3d-namnskyltar'])).toBeNull();
    expect(resolveCollectionChain(tree, ['namnskyltar', 'skyltar'])).toBeNull();
    expect(resolveCollectionChain(tree, ['skyltar', '3d-namnskyltar'])).toBeNull();
    expect(resolveCollectionChain(tree, ['skyltar', 'namnskyltar', '3d-namnskyltar', 'x'])).toBeNull();
    expect(resolveCollectionChain(tree, ['present', 'skyltar'])).toBeNull();
    expect(resolveCollectionChain(tree, [])).toBeNull();
  });

  it('rejects inactive nodes and anything below them', () => {
    expect(resolveCollectionChain(tree, ['skyltar', 'gamla'])).toBeNull();
    expect(resolveCollectionChain(tree, ['skyltar', 'gamla', 'kid'])).toBeNull();
  });
});

// Next 16 hands catch-all params percent-ENCODED (`kläder` -> `kl%C3%A4der`),
// while the tree carries the decoded DB slugs (SLUG-INVENTORY §0).
describe('resolveCollectionChain with non-ASCII slugs', () => {
  const unicodeTree: Node[] = [
    {
      id: 'parent',
      slug: 'parent',
      children: [
        { id: 'sv', slug: 'kläder' },
        { id: 'ar', slug: 'هدايا-للأم' },
      ],
    },
    { id: 'ar-root', slug: 'هدايا' },
  ];
  const ids = (segments: string[]) =>
    resolveCollectionChain(unicodeTree, segments)?.map((n) => n.id) ?? null;

  it('resolves an encoded Swedish segment', () => {
    expect(ids(['parent', 'kl%C3%A4der'])).toEqual(['parent', 'sv']);
    expect(ids(['parent', encodeURIComponent('kläder')])).toEqual(['parent', 'sv']);
  });

  it('resolves encoded Arabic segments (root and child)', () => {
    expect(ids([encodeURIComponent('هدايا')])).toEqual(['ar-root']);
    expect(ids(['parent', encodeURIComponent('هدايا-للأم')])).toEqual(['parent', 'ar']);
  });

  it('accepts lowercase hex, decoded input, NFD input and another letter case', () => {
    expect(ids(['parent', 'kl%c3%a4der'])).toEqual(['parent', 'sv']);
    expect(ids(['parent', 'kläder'])).toEqual(['parent', 'sv']);
    expect(ids(['parent', 'kläder'])).toEqual(['parent', 'sv']);
    expect(ids(['parent', encodeURIComponent('kläder')])).toEqual(['parent', 'sv']);
    expect(ids(['PARENT', 'KL%C3%84DER'])).toEqual(['parent', 'sv']);
  });

  it('matches a stored slug that is itself NFD', () => {
    const nfdTree: Node[] = [{ id: 'x', slug: 'kläder' }];
    expect(resolveCollectionChain(nfdTree, ['kl%C3%A4der'])?.map((n) => n.id)).toEqual(['x']);
  });

  it('still rejects a different slug and a flat child URL', () => {
    expect(ids(['parent', 'klader'])).toBeNull();
    expect(ids(['kl%C3%A4der'])).toBeNull();
  });
});
