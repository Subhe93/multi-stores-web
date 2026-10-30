import { describe, expect, it } from 'vitest';
import { buildHomeJsonLd, buildLandingJsonLd, isNoindexRobots, pageFaqItems, pageListsProducts } from './pageJsonLd';

const base = {
  origin: 'https://namz.se',
  path: '/present-till-pappa',
  locale: 'sv',
  primaryLocale: 'sv',
  name: 'Present till pappa',
  description: 'Hitta den perfekta presenten.',
  siteName: 'Namz',
  homeLabel: 'Hem',
};

describe('buildLandingJsonLd', () => {
  it('emits a WebPage + Home → page breadcrumb on the primary-locale URL', () => {
    const out = buildLandingJsonLd(base)!;
    expect(out.page).toEqual({
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: 'Present till pappa',
      description: 'Hitta den perfekta presenten.',
      url: 'https://namz.se/present-till-pappa',
      inLanguage: 'sv',
      isPartOf: { '@type': 'WebSite', url: 'https://namz.se', name: 'Namz' },
    });
    expect(out.breadcrumb.itemListElement).toEqual([
      { '@type': 'ListItem', position: 1, name: 'Hem', item: 'https://namz.se' },
      { '@type': 'ListItem', position: 2, name: 'Present till pappa', item: 'https://namz.se/present-till-pappa' },
    ]);
  });

  it('prefixes a secondary locale and omits an empty description', () => {
    const out = buildLandingJsonLd({ ...base, locale: 'en', description: '  ' })!;
    expect(out.page.url).toBe('https://namz.se/en/present-till-pappa');
    expect(out.page.inLanguage).toBe('en');
    expect(out.page).not.toHaveProperty('description');
    expect(out.breadcrumb.itemListElement[0].item).toBe('https://namz.se/en');
  });

  it('becomes a CollectionPage when a visible collection-products section exists', () => {
    const sections = [
      { section_key: 'hero' },
      { section_key: 'collection-products', is_hidden: true },
    ];
    expect(buildLandingJsonLd({ ...base, sections })!.page['@type']).toBe('WebPage');
    sections[1].is_hidden = false;
    expect(buildLandingJsonLd({ ...base, sections })!.page['@type']).toBe('CollectionPage');
  });

  it('prefers a creator canonical for the page url', () => {
    const out = buildLandingJsonLd({ ...base, canonical: 'https://namz.se/pappa' })!;
    expect(out.page.url).toBe('https://namz.se/pappa');
    expect(out.breadcrumb.itemListElement[1].item).toBe('https://namz.se/pappa');
  });

  it('emits nothing for a noindex page', () => {
    expect(buildLandingJsonLd({ ...base, robots: 'noindex, nofollow' })).toBeNull();
    expect(buildLandingJsonLd({ ...base, robots: 'index, follow' })).not.toBeNull();
  });
});

describe('buildHomeJsonLd', () => {
  it('uses the origin as url and strips html from the description', () => {
    expect(
      buildHomeJsonLd({
        origin: 'https://namz.se',
        locale: 'sv',
        primaryLocale: 'sv',
        name: 'Namz',
        description: '<p>Presenter  för <b>alla</b></p>',
      }),
    ).toEqual({
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: 'Namz',
      description: 'Presenter för alla',
      url: 'https://namz.se',
      inLanguage: 'sv',
      isPartOf: { '@type': 'WebSite', url: 'https://namz.se', name: 'Namz' },
    });
  });

  it('localises the url for a secondary locale and honours noindex', () => {
    expect(buildHomeJsonLd({ origin: 'https://namz.se', locale: 'en', primaryLocale: 'sv', name: 'Namz' })!.url).toBe(
      'https://namz.se/en',
    );
    expect(buildHomeJsonLd({ origin: 'https://namz.se', locale: 'sv', primaryLocale: 'sv', name: 'Namz', robots: 'noindex' })).toBeNull();
  });
});

describe('helpers', () => {
  it('pageListsProducts / isNoindexRobots', () => {
    expect(pageListsProducts(null)).toBe(false);
    expect(pageListsProducts([{ section_key: 'collection-products' }])).toBe(true);
    expect(isNoindexRobots(undefined)).toBe(false);
    expect(isNoindexRobots('NOINDEX')).toBe(true);
  });
});

describe('pageFaqItems', () => {
  const faq = (items: unknown[], extra: Partial<{ is_hidden: boolean; locale: string }> = {}) => ({
    section_key: 'faq-list',
    is_hidden: extra.is_hidden,
    translations: [{ locale: extra.locale ?? 'sv', content: { items } }],
  });

  it('collects complete pairs of visible faq-list sections', () => {
    const items = pageFaqItems(
      [
        faq([{ question: 'Hur lång är leveransen?', answer: '  3–5 dagar,  pris < 100 kr ' }, { question: 'Bara fråga' }]),
        faq([{ question: 'Dold', answer: 'Dold' }], { is_hidden: true }),
        { section_key: 'rich-text', translations: [{ locale: 'sv', content: { items: [] } }] },
      ],
      'sv',
      'sv',
    );
    expect(items).toEqual([{ question: 'Hur lång är leveransen?', answer: '3–5 dagar, pris < 100 kr' }]);
  });

  it('falls back to the primary locale row', () => {
    expect(pageFaqItems([faq([{ question: 'Q', answer: 'A' }])], 'en', 'sv')).toHaveLength(1);
    expect(pageFaqItems(null, 'sv', 'sv')).toEqual([]);
  });
});
