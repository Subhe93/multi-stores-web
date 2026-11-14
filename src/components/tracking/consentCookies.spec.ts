// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { clearVendorCookies, cookieDomains, vendorCookieNames } from './consentCookies';

// Vendor cookie clean-up on withdrawal (plans/consent-v2/CONTRACT.md §7.1).

describe('cookieDomains', () => {
  it('host-only plus every parent domain down to the registrable one', () => {
    expect(cookieDomains('www.namez.se')).toEqual(['', 'www.namez.se', 'namez.se']);
    expect(cookieDomains('namez.shop')).toEqual(['', 'namez.shop']);
  });

  it('host-only for localhost and IPs', () => {
    expect(cookieDomains('localhost')).toEqual(['']);
    expect(cookieDomains('127.0.0.1')).toEqual(['']);
    expect(cookieDomains('[::1]')).toEqual(['']);
  });
});

describe('vendorCookieNames', () => {
  const names = [
    '_ga',
    '_ga_ABC123',
    '_gid',
    '_gat_UA1',
    '_clck',
    '_clsk',
    '_fbp',
    '_fbc',
    '_ttp',
    '_tt_enable_cookie',
    'ttcsid_X',
    'consent_namez-se',
    'cart',
  ];

  it('analytics vendors', () => {
    expect(vendorCookieNames(names, ['ga4', 'clarity'])).toEqual(['_ga', '_ga_ABC123', '_gid', '_gat_UA1', '_clck', '_clsk']);
  });

  it('marketing vendors', () => {
    expect(vendorCookieNames(names, ['meta', 'tiktok'])).toEqual(['_fbp', '_fbc', '_ttp', '_tt_enable_cookie', 'ttcsid_X']);
  });

  it('Google ad cookies are their own group (cleared with marketing, not with GA4 analytics alone)', () => {
    const withAds = [...names, '_gcl_au', '_gcl_aw'];
    expect(vendorCookieNames(withAds, ['ga4'])).not.toContain('_gcl_au');
    expect(vendorCookieNames(withAds, ['google_ads'])).toEqual(['_gcl_au', '_gcl_aw']);
  });

  it('never touches the consent cookie or other store cookies', () => {
    const all = vendorCookieNames(names, ['ga4', 'clarity', 'meta', 'tiktok']);
    expect(all).not.toContain('consent_namez-se');
    expect(all).not.toContain('cart');
  });
});

describe('clearVendorCookies', () => {
  afterEach(() => {
    document.cookie = 'keep=; max-age=0; path=/';
    window.localStorage.clear();
  });

  it('deletes the vendor cookies and Clarity storage, keeps the rest', () => {
    document.cookie = '_ga=GA1.1.1; path=/';
    document.cookie = '_fbp=fb.1; path=/';
    document.cookie = '_clck=abc; path=/';
    document.cookie = 'keep=1; path=/';
    window.localStorage.setItem('_clck', 'x');
    window.localStorage.setItem('other', 'y');
    clearVendorCookies(['ga4', 'clarity']);
    expect(document.cookie).not.toContain('_ga=');
    expect(document.cookie).not.toContain('_clck=');
    expect(document.cookie).toContain('_fbp=');
    expect(document.cookie).toContain('keep=1');
    expect(window.localStorage.getItem('_clck')).toBeNull();
    expect(window.localStorage.getItem('other')).toBe('y');
    clearVendorCookies(['meta']);
    expect(document.cookie).not.toContain('_fbp=');
  });
});
