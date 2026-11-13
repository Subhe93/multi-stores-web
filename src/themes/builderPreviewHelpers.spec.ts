import { describe, expect, it } from 'vitest';
import {
  adoptPreviewApps,
  adoptPreviewBrand,
  adoptPreviewCurrency,
  adoptPreviewTax,
  adoptPreviewProduct,
  findEditablePath,
  findParentId,
  findSection,
  previewBrandVars,
  resolveSectionContent,
  safeSectionId,
  selectionCss,
} from './builderPreviewHelpers';
import type { ProductContext, SectionInstance } from './types';

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

describe('adoptPreviewProduct', () => {
  const sample = { id: 'server', translations: [] } as unknown as ProductContext;
  const posted = { id: 'posted', translations: [] } as unknown as ProductContext;

  it('adopts a posted product with an id', () => {
    expect(adoptPreviewProduct(posted, sample)).toBe(posted);
    expect(adoptPreviewProduct(posted, undefined)).toBe(posted);
  });

  it('keeps the current product when nothing usable is posted', () => {
    expect(adoptPreviewProduct(undefined, sample)).toBe(sample);
    expect(adoptPreviewProduct(null, sample)).toBe(sample);
    expect(adoptPreviewProduct({ id: '' }, sample)).toBe(sample);
    expect(adoptPreviewProduct({ id: 7 }, sample)).toBe(sample);
    expect(adoptPreviewProduct([{ id: 'x' }], sample)).toBe(sample);
    expect(adoptPreviewProduct('p1', undefined)).toBeUndefined();
  });
});

describe('adoptPreviewCurrency', () => {
  it('adopts a posted ISO-4217 code (the owner-read currency of a draft store)', () => {
    expect(adoptPreviewCurrency('SEK', 'EUR')).toBe('SEK');
    expect(adoptPreviewCurrency(' sek ', 'EUR')).toBe('SEK');
    expect(adoptPreviewCurrency('SEK', undefined)).toBe('SEK');
  });

  it('keeps the current currency when nothing usable is posted', () => {
    expect(adoptPreviewCurrency(undefined, 'SEK')).toBe('SEK');
    for (const v of [null, '', 'kr', 'SEKK', 'S1K', 752, {}, ['SEK']]) {
      expect(adoptPreviewCurrency(v, 'EUR')).toBe('EUR');
    }
    expect(adoptPreviewCurrency('kr', undefined)).toBeUndefined();
  });
});

describe('adoptPreviewApps', () => {
  it('adopts the posted apps of the owner read, normalized', () => {
    const posted = { personalization: { enabled: true, settings: { a: 1 } }, b2b: { enabled: false }, nope: { enabled: true } };
    expect(adoptPreviewApps(posted, {})).toEqual({ personalization: { enabled: true, settings: { a: 1 } } });
    // An empty object is a real answer (no apps enabled).
    expect(adoptPreviewApps({}, { personalization: { enabled: true } })).toEqual({});
  });

  it('keeps the current apps when nothing is posted, and keeps identity when unchanged', () => {
    const current = { personalization: { enabled: true as const } };
    expect(adoptPreviewApps(undefined, current)).toBe(current);
    expect(adoptPreviewApps(null, current)).toBe(current);
    expect(adoptPreviewApps([], current)).toBe(current);
    expect(adoptPreviewApps({ personalization: { enabled: true } }, current)).toBe(current);
  });
});

describe('adoptPreviewTax', () => {
  it('adopts the posted tax settings, null included', () => {
    expect(adoptPreviewTax({ pricing_mode: 'EXCLUSIVE', display_prices_incl_tax: false }, null)).toMatchObject({
      pricing_mode: 'EXCLUSIVE',
      display_prices_incl_tax: false,
    });
    expect(adoptPreviewTax(null, { pricing_mode: 'INCLUSIVE', display_prices_incl_tax: true, country: null, registrant: 'STORE' })).toBeNull();
  });

  it('keeps the current settings when nothing is posted, and keeps identity when unchanged', () => {
    const current = adoptPreviewTax({ pricing_mode: 'INCLUSIVE' }, null);
    expect(adoptPreviewTax(undefined, current)).toBe(current);
    expect(adoptPreviewTax({ pricing_mode: 'INCLUSIVE' }, current)).toBe(current);
  });
});

describe('preview brand colours (--store-*)', () => {
  const tokens = { primary: '#111827', secondary: '#6b7280' };
  const contrast = (c: string) => `on(${c})`;

  it('falls back to the theme tokens when the store sets no colour', () => {
    expect(previewBrandVars(undefined, tokens, contrast)).toEqual({
      '--store-primary': '#111827',
      '--store-primary-contrast': 'on(#111827)',
      '--store-secondary': '#6b7280',
    });
  });

  it('uses the store colours of the owner read; unsafe values are dropped', () => {
    const brand = adoptPreviewBrand({ primaryColor: ' #e11d48 ', secondaryColor: 'red;}body{x:y' }, undefined);
    expect(brand).toEqual({ primaryColor: '#e11d48' });
    expect(previewBrandVars(brand, tokens, contrast)).toEqual({
      '--store-primary': '#e11d48',
      '--store-primary-contrast': 'on(#e11d48)',
      '--store-secondary': '#6b7280',
    });
  });

  it('keeps the current value when nothing usable is posted, and the same object for equal input', () => {
    const current = { primaryColor: '#000000' };
    expect(adoptPreviewBrand(undefined, current)).toBe(current);
    expect(adoptPreviewBrand('x', current)).toBe(current);
    expect(adoptPreviewBrand({ primaryColor: '#000000' }, current)).toBe(current);
    expect(adoptPreviewBrand({}, current)).toEqual({});
  });
});
