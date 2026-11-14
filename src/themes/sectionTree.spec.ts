import { describe, expect, it } from 'vitest';
import { buildSectionTree, isDividerSection, readChildLayout, subtreeContains, walkTree, type SectionTreeNode } from './sectionTree';
import type { SectionInstance } from './types';

function s(id: string, key: string, sort_order: number, extra: Partial<SectionInstance> = {}): SectionInstance {
  return { id, section_key: key, sort_order, settings: {}, translations: [], ...extra };
}

function shape(nodes: SectionTreeNode[]): unknown[] {
  return nodes.map((n) => (n.children.length ? { [n.section.id]: shape(n.children) } : n.section.id));
}

describe('buildSectionTree', () => {
  it('keeps a flat page flat and sorted, like the old renderer', () => {
    const tree = buildSectionTree([s('c', 'rich-text', 2), s('a', 'hero-banner', 0), s('b', 'faq-list', 1)]);
    expect(shape(tree)).toEqual(['a', 'b', 'c']);
    expect(tree.every((n) => n.depth === 1)).toBe(true);
  });

  it('keeps the input order for equal sort_order values (stable)', () => {
    const tree = buildSectionTree([s('x', 'rich-text', 0), s('y', 'rich-text', 0), s('z', 'rich-text', 0)]);
    expect(shape(tree)).toEqual(['x', 'y', 'z']);
  });

  it('nests children under containers and sorts siblings', () => {
    const tree = buildSectionTree([
      s('row', 'layout-row', 0),
      s('right', 'layout-column', 1, { parent_id: 'row' }),
      s('left', 'layout-column', 0, { parent_id: 'row' }),
      s('price', 'product-details', 1, { parent_id: 'right' }),
      s('title', 'product-details', 0, { parent_id: 'right' }),
      s('gallery', 'product-gallery', 0, { parent_id: 'left' }),
      s('tabs', 'product-tabs', 1),
    ]);
    expect(shape(tree)).toEqual([{ row: [{ left: ['gallery'] }, { right: ['title', 'price'] }] }, 'tabs']);
    expect(tree[0].children[1].children[0].depth).toBe(3);
  });

  it('drops a hidden container with its whole subtree', () => {
    const tree = buildSectionTree([
      s('row', 'layout-row', 0, { is_hidden: true }),
      s('col', 'layout-column', 0, { parent_id: 'row' }),
      s('leaf', 'rich-text', 0, { parent_id: 'col' }),
      s('after', 'rich-text', 1),
    ]);
    expect(shape(tree)).toEqual(['after']);
  });

  it('drops sections whose parent is unknown or not a container', () => {
    const tree = buildSectionTree([
      s('text', 'rich-text', 0),
      s('orphan', 'rich-text', 1, { parent_id: 'missing' }),
      s('under-leaf', 'rich-text', 2, { parent_id: 'text' }),
    ]);
    expect(shape(tree)).toEqual(['text']);
  });

  it('ignores cycles (unreachable from a root)', () => {
    const tree = buildSectionTree([
      s('a', 'layout-row', 0, { parent_id: 'b' }),
      s('b', 'layout-column', 0, { parent_id: 'a' }),
      s('root', 'rich-text', 0),
    ]);
    expect(shape(tree)).toEqual(['root']);
  });

  it('enforces the max depth of 3', () => {
    const tree = buildSectionTree([
      s('g', 'layout-grid', 0),
      s('r', 'layout-row', 0, { parent_id: 'g' }),
      s('c', 'layout-column', 0, { parent_id: 'r' }),
      s('deep', 'rich-text', 0, { parent_id: 'c' }),
    ]);
    // The container at depth 3 keeps no children.
    expect(shape(tree)).toEqual([{ g: [{ r: ['c'] }] }]);
  });

  it('walks in document order and finds subtree members', () => {
    const tree = buildSectionTree([
      s('row', 'layout-row', 0),
      s('a', 'rich-text', 0, { parent_id: 'row' }),
      s('b', 'rich-text', 1),
    ]);
    const order: string[] = [];
    walkTree(tree, (n) => order.push(n.section.id));
    expect(order).toEqual(['row', 'a', 'b']);
    expect(subtreeContains(tree[0], 'a')).toBe(true);
    expect(subtreeContains(tree[0], 'b')).toBe(false);
    expect(subtreeContains(tree[0], undefined)).toBe(false);
  });
});

describe('readChildLayout', () => {
  it('returns {} without _layout', () => {
    expect(readChildLayout({})).toEqual({});
    expect(readChildLayout(undefined)).toEqual({});
  });

  it('sanitises spans, orders, align_self and sticky', () => {
    expect(
      readChildLayout({
        _layout: {
          span: { desktop: 2.4, tablet: 40, mobile: 'x' },
          order: { mobile: '-1' },
          align_self: 'center',
          sticky: true,
        },
      }),
    ).toEqual({ span: { desktop: 2, tablet: 12 }, order: { mobile: -1 }, align_self: 'center', sticky: true });
    expect(readChildLayout({ _layout: { align_self: 'bogus', sticky: 'yes' } })).toEqual({});
  });
});

describe('isDividerSection', () => {
  it('is a spacer with its divider line on', () => {
    expect(isDividerSection('spacer', { show_divider: true })).toBe(true);
    expect(isDividerSection('spacer', { show_divider: false })).toBe(false);
    expect(isDividerSection('spacer', {})).toBe(false);
    expect(isDividerSection('spacer', null)).toBe(false);
    expect(isDividerSection('rich-text', { show_divider: true })).toBe(false);
  });
});
