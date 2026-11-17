import { describe, expect, it } from 'vitest';
import {
  buildExternalReturnUrl,
  continueShoppingLink,
  externalSiteHost,
  isExternalHostAllowed,
  parseExternalUrl,
  resolveBackLabel,
  resolveReturnLabel,
  resolveReturnMode,
} from './externalReturn';
import { DEFAULT_CHECKOUT_SETTINGS, normalizeCheckoutSettings } from './checkoutSettings';

// Headless booking P3 (R-D3 / R-D4): the storefront's own check of the
// external-site URLs and the only substitution it makes.

const SITE = 'https://primatrafikskola.se/';
const site = (over: Record<string, unknown> = {}) => normalizeCheckoutSettings({ external_site_url: SITE, ...over });

describe('parseExternalUrl', () => {
  it('accepts https DNS hosts and normalizes', () => {
    expect(parseExternalUrl('https://Example.se')).toBe('https://example.se/');
    expect(parseExternalUrl('https://example.se:443/x')).toBe('https://example.se/x');
  });

  it.each([
    'http://example.se/',
    'https://user:pw@example.se/',
    'https://user@example.se/',
    'https://example.se:8443/',
    'https://127.0.0.1/',
    'https://[::1]/',
    'https://localhost/',
    'javascript:alert(1)',
    '//example.se/',
    'https://exa mple.se/',
    'https://{order_number}.example.se/',
    'https://example.se/\\evil',
    '',
    null,
  ])('refuses %s', (raw) => {
    expect(parseExternalUrl(raw, true)).toBeNull();
  });

  it('allows only {order_number} and only when asked', () => {
    expect(parseExternalUrl('https://example.se/tack?order={order_number}', true)).toBe(
      'https://example.se/tack?order={order_number}',
    );
    expect(parseExternalUrl('https://example.se/tack?order={order_number}')).toBeNull();
    expect(parseExternalUrl('https://example.se/tack?e={email}', true)).toBeNull();
    expect(parseExternalUrl('https://example.se/tack?x={', true)).toBeNull();
  });
});

describe('isExternalHostAllowed', () => {
  it('matches the exact host or its www twin only', () => {
    expect(isExternalHostAllowed('https://primatrafikskola.se/tack', SITE)).toBe(true);
    expect(isExternalHostAllowed('https://www.primatrafikskola.se/tack', SITE)).toBe(true);
    expect(isExternalHostAllowed('https://boka.primatrafikskola.se/', SITE)).toBe(false);
    expect(isExternalHostAllowed('https://evil.se/', SITE)).toBe(false);
    expect(isExternalHostAllowed('https://primatrafikskola.se.evil.se/', SITE)).toBe(false);
    expect(isExternalHostAllowed('https://evil.co.uk/', 'https://shop.example.co.uk/')).toBe(false);
  });
});

describe('normalizeCheckoutSettings with an external site', () => {
  it('keeps the four keys only with a valid site', () => {
    expect(site({ return_url: 'https://www.primatrafikskola.se/tack?order={order_number}', return_mode: 'auto', back_label: { sv: ' Till skolan ' } })).toMatchObject({
      external_site_url: SITE,
      return_url: 'https://www.primatrafikskola.se/tack?order={order_number}',
      return_mode: 'auto',
      back_label: { sv: 'Till skolan' },
    });
    const bad = normalizeCheckoutSettings({ external_site_url: 'http://primatrafikskola.se', return_url: SITE, return_mode: 'auto' });
    expect(bad).toEqual(DEFAULT_CHECKOUT_SETTINGS);
    expect(bad).not.toHaveProperty('external_site_url');
  });

  it('drops a foreign return_url but keeps the site', () => {
    const s = site({ return_url: 'https://evil.se/tack' });
    expect(s.external_site_url).toBe(SITE);
    expect(s.return_url).toBeNull();
  });
});

describe('buildExternalReturnUrl', () => {
  it('is null without a site (stores without the setting)', () => {
    expect(buildExternalReturnUrl(DEFAULT_CHECKOUT_SETTINGS, 'ORD-1')).toBeNull();
    expect(buildExternalReturnUrl(null, 'ORD-1')).toBeNull();
  });

  it('substitutes only {order_number}, URL-encoded', () => {
    const s = site({ return_url: 'https://primatrafikskola.se/tack?order={order_number}#n={order_number}' });
    expect(buildExternalReturnUrl(s, 'ORD-ABC-1234')).toBe('https://primatrafikskola.se/tack?order=ORD-ABC-1234#n=ORD-ABC-1234');
    expect(buildExternalReturnUrl(s, 'a&b=c/d?e')).toBe('https://primatrafikskola.se/tack?order=a%26b%3Dc%2Fd%3Fe#n=a%26b%3Dc%2Fd%3Fe');
  });

  it('falls back to the site URL without an order number or return_url', () => {
    const s = site({ return_url: 'https://primatrafikskola.se/tack?order={order_number}' });
    expect(buildExternalReturnUrl(s, null)).toBe(SITE);
    expect(buildExternalReturnUrl(s, '  ')).toBe(SITE);
    expect(buildExternalReturnUrl(site(), 'ORD-1')).toBe(SITE);
    expect(buildExternalReturnUrl(site({ return_url: 'https://primatrafikskola.se/tack' }), 'ORD-1')).toBe('https://primatrafikskola.se/tack');
  });

  it('re-checks settings that bypassed normalization', () => {
    expect(
      buildExternalReturnUrl({ external_site_url: SITE, return_url: 'https://evil.se/?o={order_number}', return_mode: 'button', back_label: null }, 'ORD-1'),
    ).toBe(SITE);
    expect(
      buildExternalReturnUrl({ external_site_url: 'javascript:alert(1)', return_url: null, return_mode: 'button', back_label: null }, 'ORD-1'),
    ).toBeNull();
  });
});

describe('labels, mode and links', () => {
  it('resolves the back label by locale, never across languages', () => {
    const s = site({ back_label: { sv: 'Till skolan' } });
    expect(resolveBackLabel(s, 'sv')).toBe('Till skolan');
    expect(resolveBackLabel(s, 'sv-SE')).toBe('Till skolan');
    expect(resolveBackLabel(s, 'en')).toBeNull();
    expect(resolveBackLabel(DEFAULT_CHECKOUT_SETTINGS, 'sv')).toBeNull();
  });

  it('shows the host without www', () => {
    expect(externalSiteHost(site({ external_site_url: 'https://www.primatrafikskola.se/' }))).toBe('primatrafikskola.se');
    expect(externalSiteHost(DEFAULT_CHECKOUT_SETTINGS)).toBeNull();
  });

  it('auto mode only with a site', () => {
    expect(resolveReturnMode(site({ return_mode: 'auto' }))).toBe('auto');
    expect(resolveReturnMode(site())).toBe('button');
    expect(resolveReturnMode({ ...DEFAULT_CHECKOUT_SETTINGS, return_mode: 'auto' })).toBe('button');
  });

  it('continue shopping link is unchanged without a site', () => {
    expect(continueShoppingLink(DEFAULT_CHECKOUT_SETTINGS, '/products')).toStrictEqual({ href: '/products' });
    expect(continueShoppingLink(site(), '/products')).toStrictEqual({ href: SITE, rel: 'noreferrer' });
  });
});

describe('return_label', () => {
  it('is kept only when it has entries, and only next to a valid site', () => {
    expect(site({ return_label: { sv: '  Till bokningen ', en: ' ', de: 5 } }).return_label).toStrictEqual({ sv: 'Till bokningen' });
    for (const value of [null, {}, { sv: '  ' }, 'text', ['a']]) {
      expect(site({ return_label: value })).not.toHaveProperty('return_label');
    }
    // A store with a site but without the key keeps the previous shape.
    expect(site({ back_label: { sv: 'Till skolan' } })).toStrictEqual({
      ...DEFAULT_CHECKOUT_SETTINGS,
      external_site_url: SITE,
      return_url: null,
      return_mode: 'button',
      back_label: { sv: 'Till skolan' },
    });
    expect(normalizeCheckoutSettings({ return_label: { sv: 'X' } })).not.toHaveProperty('return_label');
    expect(normalizeCheckoutSettings({ external_site_url: 'http://bad.se', return_label: { sv: 'X' } })).not.toHaveProperty('return_label');
  });

  it('resolves exact locale, then language, then back_label, then null', () => {
    const s = site({ return_label: { 'sv-SE': 'Exakt', sv: 'Till bokningen' }, back_label: { sv: 'Till skolan', en: 'To the school' } });
    expect(resolveReturnLabel(s, 'sv-SE')).toBe('Exakt');
    expect(resolveReturnLabel(s, 'sv')).toBe('Till bokningen');
    expect(resolveReturnLabel(s, 'sv-FI')).toBe('Till bokningen');
    // Never another language of return_label: back_label of the locale wins.
    expect(resolveReturnLabel(s, 'en')).toBe('To the school');
    expect(resolveReturnLabel(s, 'de')).toBeNull();
    // back_label resolution itself is untouched.
    expect(resolveBackLabel(s, 'sv')).toBe('Till skolan');
  });

  it('without return_label it equals the back label resolution', () => {
    const s = site({ back_label: { sv: 'Till skolan' } });
    for (const locale of ['sv', 'sv-SE', 'en']) {
      expect(resolveReturnLabel(s, locale)).toBe(resolveBackLabel(s, locale));
    }
    expect(resolveReturnLabel(site(), 'sv')).toBeNull();
  });

  it('is ignored without a valid external site', () => {
    expect(resolveReturnLabel({ ...DEFAULT_CHECKOUT_SETTINGS, return_label: { sv: 'X' } }, 'sv')).toBeNull();
    expect(resolveReturnLabel({ ...DEFAULT_CHECKOUT_SETTINGS, external_site_url: 'http://bad.se', return_label: { sv: 'X' } }, 'sv')).toBeNull();
    expect(resolveReturnLabel(DEFAULT_CHECKOUT_SETTINGS, 'sv')).toBeNull();
    expect(resolveReturnLabel(null, 'sv')).toBeNull();
  });
});
