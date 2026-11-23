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

// M165 safety net: an unresolved product reference never reaches the browser.
describe('product references (unresolved)', () => {
  const REF = 'product:0f8b2c4e-1a2b-4c3d-8e9f-a0b1c2d3e4f5';
  it('sectionHref maps a reference to the prefixed product list', () => {
    expect(sectionHref(REF, DE_AT)).toBe('/de-at/products');
    expect(sectionHref(REF, ROOT)).toBe('/products');
    expect(sectionHref(`collection:${REF.slice(8)}`, LEGACY_AR)).toBe('/ar/products');
  });
  it('sectionHtml maps reference hrefs; external, mailto and tel unchanged', () => {
    const html = `<a href="${REF}">a</a> <a href='mailto:x@y.se'>m</a> <a href="tel:1">t</a> <a href="https://x.se">e</a>`;
    expect(sectionHtml(html, DE_AT)).toBe(
      `<a href="/de-at/products">a</a> <a href='mailto:x@y.se'>m</a> <a href="tel:1">t</a> <a href="https://x.se">e</a>`,
    );
    expect(sectionHtml(`<a href="${REF}">a</a>`, ROOT)).toBe('<a href="/products">a</a>');
    expect(sectionHtml('<a href="product:abc">a</a>', ROOT)).toBe('<a href="product:abc">a</a>');
  });
});
