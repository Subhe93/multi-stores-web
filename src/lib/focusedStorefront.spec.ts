import { describe, expect, it } from 'vitest';
import { DEFAULT_CHECKOUT_SETTINGS, normalizeCheckoutSettings } from './checkoutSettings';
import {
  afterAddDestination,
  focusedProductSections,
  focusedSitemapData,
  focusedStorefront,
  focusRedirectTarget,
  focusRouteKind,
  isProtectedPageSlug,
  normalizeRequestHost,
  resolveFocusForHost,
} from './focusedStorefront';

// Focused storefront (`checkout_settings.external_focus`): the gate, the
// redirect decision and the small helpers behind the product page, the
// add-to-cart destination and the sitemap.

const SITE = 'https://mollstrands.example/';
const focused = (over: Record<string, unknown> = {}) =>
  normalizeCheckoutSettings({ external_site_url: SITE, external_focus: true, ...over });
const siteOnly = (over: Record<string, unknown> = {}) => normalizeCheckoutSettings({ external_site_url: SITE, ...over });

describe('normalizeCheckoutSettings: external_focus', () => {
  it('is kept only when true and next to a valid site', () => {
    expect(focused().external_focus).toBe(true);
    expect(siteOnly()).not.toHaveProperty('external_focus');
    expect(siteOnly({ external_focus: false })).not.toHaveProperty('external_focus');
    expect(siteOnly({ external_focus: 'true' })).not.toHaveProperty('external_focus');
    // No site, or an invalid one: the flag is dropped with the other keys.
    expect(normalizeCheckoutSettings({ external_focus: true })).toEqual(DEFAULT_CHECKOUT_SETTINGS);
    expect(normalizeCheckoutSettings({ external_site_url: 'http://mollstrands.example', external_focus: true })).toEqual(
      DEFAULT_CHECKOUT_SETTINGS,
    );
  });

  it('a store with a site but without the flag keeps the exact previous shape', () => {
    expect(siteOnly()).toEqual({
      ...DEFAULT_CHECKOUT_SETTINGS,
      external_site_url: SITE,
      return_url: null,
      return_mode: 'button',
      back_label: null,
    });
  });
});

describe('focusedStorefront (the gate)', () => {
  it('needs the flag and a valid site', () => {
    expect(focusedStorefront(focused())).toEqual({ siteUrl: SITE, siteHost: 'mollstrands.example' });
    expect(focusedStorefront(siteOnly())).toBeNull();
    expect(focusedStorefront(DEFAULT_CHECKOUT_SETTINGS)).toBeNull();
    expect(focusedStorefront(null)).toBeNull();
    expect(focusedStorefront(undefined)).toBeNull();
    // A hand-built object with the flag but a bad site.
    expect(
      focusedStorefront({ external_focus: true, external_site_url: 'javascript:alert(1)', return_url: null, return_mode: 'button', back_label: null }),
    ).toBeNull();
    expect(focusedStorefront({ external_focus: true })).toBeNull();
  });

  it('shows the host without www', () => {
    expect(focusedStorefront(focused({ external_site_url: 'https://www.mollstrands.example/' }))?.siteHost).toBe('mollstrands.example');
  });

  it.each([
    ['another host', 'mollstrands.shopsdoor.com', true],
    ['another host with a port', 'mollstrands.shopsdoor.com:443', true],
    ['the site host itself', 'mollstrands.example', false],
    ['the site host, other case and port', 'Mollstrands.Example:3000', false],
    ['the www twin of the site host', 'www.mollstrands.example', false],
    ['no host known', null, true],
  ])('loop guard: served on %s', (_label, host, on) => {
    expect(focusedStorefront(focused(), host) !== null).toBe(on);
  });

  it('normalizeRequestHost', () => {
    expect(normalizeRequestHost(' Shop.Example.se:8080 ')).toBe('shop.example.se');
    expect(normalizeRequestHost('shop.example.se.')).toBe('shop.example.se');
    expect(normalizeRequestHost('')).toBeNull();
    expect(normalizeRequestHost(undefined)).toBeNull();
  });

  it('resolveFocusForHost drops the flag only when the mode is not in force', () => {
    const on = focused();
    expect(resolveFocusForHost(on, 'mollstrands.shopsdoor.com')).toBe(on);
    const off = resolveFocusForHost(on, 'mollstrands.example');
    expect(off).not.toHaveProperty('external_focus');
    expect(off.external_site_url).toBe(SITE);
    // Stores without the flag get the very same object back.
    const plain = siteOnly();
    expect(resolveFocusForHost(plain, 'mollstrands.example')).toBe(plain);
    expect(resolveFocusForHost(DEFAULT_CHECKOUT_SETTINGS, 'x.example')).toBe(DEFAULT_CHECKOUT_SETTINGS);
  });
});

describe('afterAddDestination', () => {
  it.each([
    // [label, settings, destination]
    ['no settings', null, 'stay'],
    ['defaults', DEFAULT_CHECKOUT_SETTINGS, 'stay'],
    ['site without the flag, stay', siteOnly(), 'stay'],
    ['site without the flag, cart', siteOnly({ after_add_to_cart: 'cart' }), 'cart'],
    ['site without the flag, checkout', siteOnly({ after_add_to_cart: 'checkout' }), 'checkout'],
    ['focused, stay (default) -> cart', focused(), 'cart'],
    ['focused, cart', focused({ after_add_to_cart: 'cart' }), 'cart'],
    ['focused, explicit checkout is respected', focused({ after_add_to_cart: 'checkout' }), 'checkout'],
  ] as const)('%s', (_label, settings, destination) => {
    expect(afterAddDestination(settings)).toBe(destination);
  });
});

describe('focusRouteKind', () => {
  it.each([
    ['/', 'home'],
    ['', 'home'],
    ['/?utm=1', 'home'],
    ['/collections', 'collections'],
    ['/collections/', 'collections'],
    ['/collections/kurser', 'collections'],
    ['/collections/kurser/sommar', 'collections'],
    ['/Collections/Kurser', 'collections'],
    ['/products', 'product-listing'],
    ['/products/', 'product-listing'],
    ['/products?search=x', 'product-listing'],
    ['/products/sommarkurs', 'keep'],
    ['/products/sommarkurs?qty=2', 'keep'],
    ['/om-oss', 'content-page'],
    ['/kontakt/', 'content-page'],
    ['/cart', 'keep'],
    ['/checkout', 'keep'],
    ['/checkout/confirmation', 'keep'],
    ['/checkout/kustom/confirmation', 'keep'],
    ['/account', 'keep'],
    ['/account/orders', 'keep'],
    ['/auth/login', 'keep'],
    ['/legal/privacy', 'keep'],
    ['/legal', 'keep'],
    ['/p', 'keep'],
    ['/market-not-found', 'keep'],
    ['/robots.txt', 'keep'],
    ['/sitemap.xml', 'keep'],
    ['/favicon.ico', 'keep'],
    ['/api/revalidate', 'keep'],
    ['/_next/static/chunk.js', 'keep'],
    ['/builder-preview/store', 'keep'],
    ['/fonts-cdn/s/inter.woff2', 'keep'],
    ['/unknown/nested/route', 'keep'],
  ] as const)('%s -> %s', (path, kind) => {
    expect(focusRouteKind(path)).toBe(kind);
  });
});

describe('isProtectedPageSlug', () => {
  it.each([
    ['cookies', [], true],
    ['om-cookies', [], true],
    ['cookie-policy', [], true],
    ['privacy-policy', [], true],
    ['terms-and-conditions', [], true],
    ['refund', [], true],
    ['returns', [], true],
    ['shipping-info', [], true],
    // Named by the store payload: the cookie page and legal `page_slug`s.
    ['villkor', ['villkor', null], true],
    ['Integritet', [undefined, 'integritet'], true],
    ['', [], true],
    ['om-oss', ['villkor'], false],
    ['kontakt', [], false],
  ] as const)('%s', (slug, keep, protectedPage) => {
    expect(isProtectedPageSlug(slug, keep)).toBe(protectedPage);
  });
});

describe('focusRedirectTarget', () => {
  const HOST = 'mollstrands.shopsdoor.com';
  const base = { settings: focused(), requestHost: HOST, gate: 'live' as const, ownerPreview: false };

  it.each([
    // Redirected to the external site.
    ['/', SITE],
    ['/collections', SITE],
    ['/collections/kurser', SITE],
    ['/collections/kurser/sommar', SITE],
    ['/products', SITE],
    ['/products?search=x', SITE],
    ['/om-oss', SITE],
    ['/kontakt', SITE],
    // Never redirected.
    ['/products/sommarkurs', null],
    ['/cart', null],
    ['/checkout', null],
    ['/checkout/confirmation', null],
    ['/checkout/kustom/confirmation', null],
    ['/account', null],
    ['/account/orders', null],
    ['/auth/login', null],
    ['/auth/register', null],
    ['/legal/privacy', null],
    ['/legal/terms', null],
    ['/robots.txt', null],
    ['/sitemap.xml', null],
    ['/api/contact', null],
    ['/builder-preview/mollstrands', null],
    ['/_next/static/x.js', null],
    // Legal / cookie content pages stay reachable.
    ['/cookies', null],
    ['/om-cookies', null],
    ['/privacy-policy', null],
    ['/terms', null],
    ['/refund-policy', null],
    ['/shipping', null],
  ] as const)('focused store: %s', (path, target) => {
    expect(focusRedirectTarget({ ...base, path })).toBe(target);
  });

  it('keeps the content pages the store payload names (cookie page, legal page_slug)', () => {
    expect(focusRedirectTarget({ ...base, path: '/bokningsregler' })).toBe(SITE);
    expect(focusRedirectTarget({ ...base, path: '/bokningsregler', keepSlugs: ['bokningsregler'] })).toBeNull();
    expect(focusRedirectTarget({ ...base, path: '/om-oss-sidan', keepSlugs: [null, 'om-oss-sidan'] })).toBeNull();
    // Swedish policy words keep a page in the store even when it is not registered.
    for (const slug of ['villkor', 'kopvillkor', 'integritetspolicy', 'angerratt', 'returer', 'leveransvillkor', 'om-kakor']) {
      expect(focusRedirectTarget({ ...base, path: `/${slug}` })).toBeNull();
    }
    // An encoded slug is compared decoded.
    expect(focusRedirectTarget({ ...base, path: `/${encodeURIComponent('köpvillkor')}`, keepSlugs: ['köpvillkor'] })).toBeNull();
  });

  it.each([
    ['a store without the flag', { settings: siteOnly() }],
    ['a store without a site', { settings: DEFAULT_CHECKOUT_SETTINGS }],
    ['no settings', { settings: null }],
    ['a store that is not LIVE (coming soon)', { gate: 'coming_soon' as const }],
    ['a paused store', { gate: 'paused' as const }],
    ["the owner's preview", { ownerPreview: true }],
    ['the external site being the host served (loop guard)', { requestHost: 'mollstrands.example' }],
    ['the www twin of the external site being served', { requestHost: 'www.mollstrands.example:443' }],
  ])('never redirects: %s', (_label, over) => {
    for (const path of ['/', '/collections/kurser', '/products', '/om-oss']) {
      expect(focusRedirectTarget({ ...base, ...over, path })).toBeNull();
    }
  });

  it('the target is always the validated external site URL', () => {
    const settings = focused({ external_site_url: 'https://Mollstrands.Example', return_url: 'https://mollstrands.example/tack' });
    expect(focusRedirectTarget({ ...base, settings, path: '/' })).toBe(SITE);
  });
});

describe('focusedProductSections', () => {
  it('drops product listing sections and keeps everything else in order', () => {
    const sections = [
      { id: '1', section_key: 'product-page' },
      { id: '2', section_key: 'featured-products' },
      { id: '3', section_key: 'rich-text' },
      { id: '4', section_key: 'product-slider' },
      { id: '5', section_key: 'collection-products' },
      { id: '6', section_key: 'product-listing' },
      { id: '7', section_key: 'product-breadcrumb' },
      { id: '8', section_key: 'layout-row' },
    ];
    expect(focusedProductSections(sections).map((s) => s.id)).toEqual(['1', '3', '7', '8']);
  });
});

describe('focusedSitemapData', () => {
  it('keeps products only', () => {
    const data = {
      locales: ['sv'],
      home: { lastmod: null },
      static_pages: [{ slug: 'om-oss' }],
      landing_pages: [{ slug: 'kampanj' }],
      products: [{ slug: 'sommarkurs' }],
      collections: [{ slug: 'kurser' }],
      legal_pages: [{ slug: 'privacy' }],
    };
    expect(focusedSitemapData(data)).toEqual({
      locales: ['sv'],
      home: null,
      static_pages: [],
      landing_pages: [],
      products: [{ slug: 'sommarkurs' }],
      collections: [],
      legal_pages: [],
    });
  });
});
