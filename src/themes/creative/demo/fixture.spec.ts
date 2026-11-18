import { describe, expect, it } from 'vitest';
import { parseFixture, toInstances } from './fixture';
import { NEUTRAL_FIXTURE } from './neutral';

describe('motion demo fixture', () => {
  it('the neutral fixture passes its own shape check', () => {
    const parsed = parseFixture(JSON.parse(JSON.stringify(NEUTRAL_FIXTURE)));
    expect(parsed).not.toBeNull();
    expect(parsed?.home.map((s) => s.section_key)).toEqual(NEUTRAL_FIXTURE.home.map((s) => s.section_key));
    expect(parsed?.products.length).toBe(NEUTRAL_FIXTURE.products.length);
  });

  it('the neutral fixture is neutral: local artwork only, en and ar copy', () => {
    const text = JSON.stringify(NEUTRAL_FIXTURE);
    expect(text).not.toMatch(/https?:\/\//);
    for (const section of [...NEUTRAL_FIXTURE.header, ...NEUTRAL_FIXTURE.home, ...NEUTRAL_FIXTURE.story, ...NEUTRAL_FIXTURE.footer]) {
      const localesOf = Object.keys(section.content);
      if (localesOf.length) expect(localesOf).toEqual(['en', 'ar']);
    }
  });

  it('junk and unknown versions are refused', () => {
    for (const raw of [null, undefined, 1, 'x', [], {}, { version: 2 }, { version: 1, name: 'x' }]) {
      expect(parseFixture(raw)).toBeNull();
    }
    expect(parseFixture({ version: 1, name: 'x', currency: 'EUR', home: [{ section_key: 1 }], header: [], footer: [] })).toBeNull();
  });

  it('optional parts fall back to empty values', () => {
    const parsed = parseFixture({ version: 1, name: 'x', currency: 'EUR', home: [], header: [], footer: [] });
    expect(parsed).toMatchObject({ primaryLocale: 'en', secondaryLocales: [], menus: [], story: [], products: [], product: null });
    expect(parsed?.logoUrl).toBeUndefined();
  });

  it('sections become instances with one translation per locale', () => {
    const [first, second] = toInstances(NEUTRAL_FIXTURE.home, 'home');
    expect(first).toMatchObject({ id: 'home-1', section_key: 'hero-split', sort_order: 0 });
    expect(first.translations.map((t) => t.locale)).toEqual(['en', 'ar']);
    expect(second.id).toBe('home-2');
  });
});
