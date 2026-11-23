import { describe, expect, it } from 'vitest';
import { clipDescription, htmlExcerpt, metaDescriptionFallback, sectionsExcerpt } from './pageExcerpt';
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

  it('collapses CR LF and tabs (M161 D)', () => {
    expect(clipDescription('Rad ett\r\nRad\ttvå  ')).toBe('Rad ett Rad två');
  });

  it('returns short text as is, without an ellipsis', () => {
    const exact = 'a'.repeat(155);
    expect(clipDescription(exact)).toBe(exact);
    expect(clipDescription('Kort text.')).toBe('Kort text.');
  });

  it('never cuts mid-word, even when the last space is early', () => {
    const text = `Kort ${'l'.repeat(140)} ${'m'.repeat(30)}`;
    const out = clipDescription(text);
    expect(out).toBe(`Kort ${'l'.repeat(140)}…`);
    expect(out.length).toBeLessThanOrEqual(155);
    const early = `Hej ${'z'.repeat(200)}`;
    expect(clipDescription(early)).toBe('Hej…');
  });

  it('trims trailing punctuation before the ellipsis', () => {
    const text = `${'ord '.repeat(37)}slut, ${'x'.repeat(40)}`;
    const out = clipDescription(text);
    expect(out.endsWith('slut…')).toBe(true);
  });

  it('hard-cuts a single word longer than the limit', () => {
    expect(clipDescription('y'.repeat(300))).toBe(`${'y'.repeat(154)}…`);
  });

  it('metaDescriptionFallback strips html, decodes entities, clips', () => {
    expect(metaDescriptionFallback('<p>Tom &amp; Jerry&nbsp;&lt;3</p>\r\n')).toBe('Tom & Jerry <3');
    expect(metaDescriptionFallback('<p>&nbsp;</p>')).toBeUndefined();
    expect(metaDescriptionFallback(null)).toBeUndefined();
    expect(metaDescriptionFallback(`<p>${'ord '.repeat(80)}</p>`)!.length).toBeLessThanOrEqual(155);
  });
});
