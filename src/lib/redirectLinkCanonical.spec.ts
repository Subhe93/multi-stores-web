import { describe, expect, it } from 'vitest';
import {
  canonicalizeRedirectHtml,
  canonicalizeRedirectLink,
  canonicalizeRedirectMenus,
  canonicalizeRedirectSections,
  type RedirectLinkContext,
} from './redirectLinkCanonical';
import type { RedirectHit } from './redirects';
import { NAMEZ_EU } from './localePaths.fixtures';
import type { NavMenu, SectionInstance } from '@/themes/types';

const map = new Map<string, RedirectHit>([
  ['/shipping-policy', { to: '/legal/shipping', status: 301 }],
  ['/old-308', { to: '/new-308', status: 308 }],
  ['/temp', { to: '/somewhere', status: 302 }],
  ['/temp-307', { to: '/somewhere', status: 307 }],
  ['/chain-a', { to: '/chain-b', status: 301 }],
  ['/chain-b', { to: '/chain-c', status: 301 }],
  ['/with-query', { to: '/target?ref=x', status: 301 }],
  ['/with-hash', { to: '/target#faq', status: 301 }],
  ['/de/alt', { to: '/de/neu', status: 301 }],
  ['/self', { to: '/SELF/', status: 301 }],
]);

const ctx: RedirectLinkContext = {
  map,
  pathMarket: null,
  hosts: new Map([
    ['namez.se', null],
    ['namez.shop', NAMEZ_EU],
  ]),
};

describe('canonicalizeRedirectLink', () => {
  it('relative link with a permanent hit points at the target', () => {
    expect(canonicalizeRedirectLink('/shipping-policy', ctx)).toBe('/legal/shipping');
    expect(canonicalizeRedirectLink('/Shipping-Policy/', ctx)).toBe('/legal/shipping');
    expect(canonicalizeRedirectLink('/old-308', ctx)).toBe('/new-308');
  });

  it('keeps the query (merged after the target query) and the fragment', () => {
    expect(canonicalizeRedirectLink('/shipping-policy?a=1#x', ctx)).toBe('/legal/shipping?a=1#x');
    expect(canonicalizeRedirectLink('/with-query?a=1', ctx)).toBe('/target?ref=x&a=1');
    expect(canonicalizeRedirectLink('/with-hash#mine', ctx)).toBe('/target#faq');
  });

  it('temporary redirects stay as typed', () => {
    expect(canonicalizeRedirectLink('/temp', ctx)).toBe('/temp');
    expect(canonicalizeRedirectLink('/temp-307', ctx)).toBe('/temp-307');
  });

  it('one hop only: a target that is itself a source is not chained', () => {
    expect(canonicalizeRedirectLink('/chain-a', ctx)).toBe('/chain-b');
  });

  it('a self target is ignored', () => {
    expect(canonicalizeRedirectLink('/self', ctx)).toBe('/self');
  });

  it('external, other-host, protocol-relative and non-link strings are untouched', () => {
    for (const v of [
      'https://example.com/shipping-policy',
      '//namez.se/shipping-policy',
      'mailto:a@b.se',
      '#top',
      'shipping-policy',
      'two words /shipping-policy',
      '',
    ]) {
      expect(canonicalizeRedirectLink(v, ctx)).toBe(v);
    }
  });

  it('absolute link on a host of this store keeps its host', () => {
    expect(canonicalizeRedirectLink('https://namez.se/shipping-policy', ctx)).toBe('https://namez.se/legal/shipping');
    expect(canonicalizeRedirectLink('https://www.namez.se/shipping-policy?x=1', ctx)).toBe(
      'https://www.namez.se/legal/shipping?x=1',
    );
  });

  it('link on another market host of the store uses that market (locale-path alias)', () => {
    // namez.shop serves `/de-de/...`; the table keeps the bare `/de/...` row.
    expect(canonicalizeRedirectLink('https://namez.shop/de-de/alt', ctx)).toBe('https://namez.shop/de-de/neu');
  });

  it('relative link on a locale-path market remaps the target folder', () => {
    const eu = { ...ctx, pathMarket: NAMEZ_EU };
    expect(canonicalizeRedirectLink('/de/alt', eu)).toBe('/de-de/neu');
    expect(canonicalizeRedirectLink('/de-de/alt', eu)).toBe('/de-de/neu');
  });

  it('an empty table is the identity', () => {
    const empty = { ...ctx, map: new Map() };
    expect(canonicalizeRedirectLink('/shipping-policy', empty)).toBe('/shipping-policy');
  });
});

describe('canonicalizeRedirectHtml / sections / menus', () => {
  it('rewrites hrefs inside owner HTML only', () => {
    const html = '<p><a href="/shipping-policy">Frakt</a> /shipping-policy <a href=\'/temp\'>t</a></p>';
    expect(canonicalizeRedirectHtml(html, ctx)).toBe(
      '<p><a href="/legal/shipping">Frakt</a> /shipping-policy <a href=\'/temp\'>t</a></p>',
    );
  });

  it('sections: copy on write, unchanged sections keep identity', () => {
    const untouched: SectionInstance = { id: 'a', section_key: 'text', sort_order: 0, settings: { url: '/x' }, translations: [] };
    const footer: SectionInstance = {
      id: 'b',
      section_key: 'footer',
      sort_order: 1,
      settings: { links: [{ url: '/shipping-policy' }], html: '<a href="/shipping-policy">x</a>' },
      translations: [],
    };
    const input = [untouched, footer];
    const out = canonicalizeRedirectSections(input, ctx);
    expect(out[0]).toBe(untouched);
    expect(out[1]!.settings).toEqual({ links: [{ url: '/legal/shipping' }], html: '<a href="/legal/shipping">x</a>' });
    expect(footer.settings).toEqual({ links: [{ url: '/shipping-policy' }], html: '<a href="/shipping-policy">x</a>' });
    const none = [untouched];
    expect(canonicalizeRedirectSections(none, ctx)).toBe(none);
  });

  it('menus: item urls', () => {
    const menus = [
      { id: 'm', key: 'footer', name: 'Footer', items: [{ id: 'i', label: 'Frakt', url: '/shipping-policy' }] },
    ] as NavMenu[];
    const out = canonicalizeRedirectMenus(menus, ctx);
    expect(out[0]!.items[0]!.url).toBe('/legal/shipping');
    const plain = [{ id: 'm', key: 'f', name: 'F', items: [{ id: 'i', label: 'x', url: '/x' }] }] as NavMenu[];
    expect(canonicalizeRedirectMenus(plain, ctx)).toBe(plain);
  });
});
