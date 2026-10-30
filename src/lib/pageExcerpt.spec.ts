import { describe, expect, it } from 'vitest';
import { clipDescription, htmlExcerpt, sectionsExcerpt } from './pageExcerpt';
import type { SectionInstance } from '@/themes/types';

const section = (sort: number, content: Record<string, unknown>, locale = 'sv'): SectionInstance => ({
  id: `s${sort}`,
  section_key: 'rich-text',
  settings: {},
  sort_order: sort,
  translations: [{ locale, content }],
});

describe('page excerpt', () => {
  it('strips tags and entities from legacy html', () => {
    expect(htmlExcerpt('<h2>Frakt</h2><p>Vi skickar&nbsp;inom <b>3–5</b> dagar.</p>')).toBe(
      'Frakt Vi skickar inom 3–5 dagar.',
    );
    expect(htmlExcerpt('')).toBeUndefined();
  });

  it('reads sections in order and skips headings and settings', () => {
    const out = sectionsExcerpt(
      [section(2, { body: '<p>Andra</p>' }), section(1, { heading: 'Rubrik', subheading: 'Första' })],
      'sv',
      'sv',
    );
    expect(out).toBe('Första Andra');
  });

  it('falls back to the primary locale and returns undefined without text', () => {
    expect(sectionsExcerpt([section(1, { body: 'Hej' }, 'sv')], 'en', 'sv')).toBe('Hej');
    expect(sectionsExcerpt([section(1, { heading: 'Only a heading' })], 'sv', 'sv')).toBeUndefined();
  });

  it('skips hidden sections and tolerates non-array translations', () => {
    const hidden = { ...section(1, { body: 'Dold text' }), is_hidden: true };
    const legacy = { ...section(2, { body: 'x' }), translations: { sv: { body: 'x' } } } as unknown as SectionInstance;
    expect(sectionsExcerpt([hidden, legacy, section(3, { body: 'Synlig' })], 'sv', 'sv')).toBe('Synlig');
  });

  it('clips at a word boundary', () => {
    const long = 'ord '.repeat(80).trim();
    const out = clipDescription(long);
    expect(out.length).toBeLessThanOrEqual(155);
    expect(out.endsWith('ord…')).toBe(true);
  });
});
