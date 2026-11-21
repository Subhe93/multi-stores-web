import { describe, expect, it } from 'vitest';
import { sectionHref, sectionHtml } from './links';

const DE_AT = { locale: 'de', primaryLocale: 'en', pathPrefix: '/de-at' };
const ROOT = { locale: 'en', primaryLocale: 'en', pathPrefix: '' };
const LEGACY_AR = { locale: 'ar', primaryLocale: 'en' };

describe('sectionHref', () => {
  it('keeps a locale-path visitor on their prefix', () => {
    expect(sectionHref('/products/x', DE_AT)).toBe('/de-at/products/x');
    expect(sectionHref('/', DE_AT)).toBe('/de-at');
    expect(sectionHref('/de-at/om', DE_AT)).toBe('/de-at/om');
  });
  it('leaves external, hash and empty values alone', () => {
    expect(sectionHref('https://example.com/a', DE_AT)).toBe('https://example.com/a');
    expect(sectionHref('#', DE_AT)).toBe('#');
    expect(sectionHref('', DE_AT)).toBe('#');
  });
  it('primary locale on the root gets no prefix', () => {
    expect(sectionHref('/products/x', ROOT)).toBe('/products/x');
  });
});

describe('sectionHtml', () => {
  it('prefixes internal links in owner HTML', () => {
    const html = '<p><a href="/om-namez">Über uns</a> <a href=\'/legal/shipping\'>Versand</a></p>';
    expect(sectionHtml(html, DE_AT)).toBe('<p><a href="/de-at/om-namez">Über uns</a> <a href=\'/de-at/legal/shipping\'>Versand</a></p>');
  });
  it('keeps the legacy /<locale> prefix on markets without locale paths', () => {
    expect(sectionHtml('<a href="/kontakt">k</a>', LEGACY_AR)).toBe('<a href="/ar/kontakt">k</a>');
  });
  it('leaves external, protocol-relative, mailto, hash and already prefixed links alone', () => {
    const html = '<a href="https://x.se/a">a</a><a href="//cdn.x/a">b</a><a href="mailto:a@b.c">c</a><a href="#top">d</a><a href="/de-at/x">e</a>';
    expect(sectionHtml(html, DE_AT)).toBe(html);
  });
  it('is a no-op without a prefix and for empty input', () => {
    const html = '<a href="/om">o</a>';
    expect(sectionHtml(html, ROOT)).toBe(html);
    expect(sectionHtml(undefined, DE_AT)).toBe('');
  });
});
