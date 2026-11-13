import { describe, expect, it } from 'vitest';
import {
  findEditablePath,
  findParentId,
  findSection,
  resolveSectionContent,
  safeSectionId,
  selectionCss,
} from './builderPreviewHelpers';
import type { SectionInstance } from './types';

function s(id: string, extra: Partial<SectionInstance> = {}): SectionInstance {
  return { id, section_key: 'rich-text', settings: {}, sort_order: 0, translations: [], ...extra };
}

const sections: SectionInstance[] = [
  s('row1', { section_key: 'layout-row' }),
  s('col1', { section_key: 'layout-column', parent_id: 'row1' }),
  s('leaf1', {
    parent_id: 'col1',
    translations: [
      { locale: 'en', content: { heading: 'Hello', items: [{ title: 'One' }] } },
      { locale: 'ar', content: { heading: 'مرحبا' } },
    ],
  }),
  s('root2'),
  s('orphan', { parent_id: 'missing' }),
  s('self', { parent_id: 'self' }),
];

describe('safeSectionId', () => {
  it('strips selector-breaking characters', () => {
    expect(safeSectionId('ab"]{x}')).toBe('abx');
    expect(safeSectionId('')).toBeNull();
    expect(safeSectionId(null)).toBeNull();
    expect(safeSectionId('"]')).toBeNull();
  });
});

describe('findSection / findParentId', () => {
  it('finds nested sections in the flat list', () => {
    expect(findSection(sections, 'leaf1')?.id).toBe('leaf1');
    expect(findSection(sections, 'nope')).toBeNull();
  });

  it('returns the parent container at any depth', () => {
    expect(findParentId(sections, 'leaf1')).toBe('col1');
    expect(findParentId(sections, 'col1')).toBe('row1');
  });

  it('returns null for roots, dangling and self parents', () => {
    expect(findParentId(sections, 'row1')).toBeNull();
    expect(findParentId(sections, 'root2')).toBeNull();
    expect(findParentId(sections, 'orphan')).toBeNull();
    expect(findParentId(sections, 'self')).toBeNull();
    expect(findParentId(sections, null)).toBeNull();
  });
});

describe('selectionCss', () => {
  it('is empty without a selection', () => {
    expect(selectionCss(null)).toBe('');
  });

  it('outlines the selection solid and the parent dashed', () => {
    const css = selectionCss('leaf1', 'col1');
    expect(css).toContain('[data-section-id="leaf1"]');
    expect(css).toContain('2px solid');
    expect(css).toContain('[data-section-id="col1"]');
    expect(css).toContain('2px dashed');
  });

  it('skips the parent rule for root sections', () => {
    const css = selectionCss('root2', null);
    expect(css).not.toContain('dashed');
  });
});

describe('inline edit lookup', () => {
  it('resolves nested section content by locale with fallback', () => {
    expect(resolveSectionContent(sections, 'leaf1', 'ar', 'en')?.heading).toBe('مرحبا');
    expect(resolveSectionContent(sections, 'leaf1', 'sv', 'en')?.heading).toBe('Hello');
    expect(resolveSectionContent(sections, 'root2', 'en', 'en')).toBeNull();
    expect(resolveSectionContent(sections, 'nope', 'en', 'en')).toBeNull();
  });

  it('finds top-level and repeater paths', () => {
    const content = resolveSectionContent(sections, 'leaf1', 'en', 'en')!;
    expect(findEditablePath(content, 'Hello')).toEqual(['heading']);
    expect(findEditablePath(content, 'One')).toEqual(['items', 0, 'title']);
    expect(findEditablePath(content, 'Missing')).toBeNull();
  });
});
