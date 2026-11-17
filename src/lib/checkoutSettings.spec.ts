import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CHECKOUT_SETTINGS,
  captureCouponFromSearch,
  guestEmailExistsNeedsPasswordSetup,
  normalizeCheckoutSettings,
  resolvePayButtonLabel,
} from './checkoutSettings';

// M5 W2-A: the storefront mirror of the store checkout settings.

describe('normalizeCheckoutSettings', () => {
  it('G0: a store without the block (or garbage) resolves to the defaults', () => {
    expect(normalizeCheckoutSettings(undefined)).toEqual(DEFAULT_CHECKOUT_SETTINGS);
    expect(normalizeCheckoutSettings(null)).toEqual(DEFAULT_CHECKOUT_SETTINGS);
    expect(normalizeCheckoutSettings('x')).toEqual(DEFAULT_CHECKOUT_SETTINGS);
    expect(normalizeCheckoutSettings([])).toEqual(DEFAULT_CHECKOUT_SETTINGS);
  });

  it('reads valid keys and ignores malformed ones', () => {
    expect(
      normalizeCheckoutSettings({
        after_add_to_cart: 'checkout',
        phone_required: 'yes',
        pay_button_label: { sv: ' Betala med kort ', en: '' },
        coupon_param: ['coupon', 'coupon1', 'bad key'],
        coupon_autoapply: true,
        nope: 1,
      }),
    ).toEqual({
      after_add_to_cart: 'checkout',
      phone_required: false,
      pay_button_label: { sv: 'Betala med kort' },
      coupon_param: ['coupon', 'coupon1'],
      coupon_autoapply: true,
    });
    expect(normalizeCheckoutSettings({ after_add_to_cart: 'home', coupon_param: [] })).toEqual(DEFAULT_CHECKOUT_SETTINGS);
  });
});

describe('resolvePayButtonLabel', () => {
  const settings = normalizeCheckoutSettings({ pay_button_label: { sv: 'Betala med kort' } });
  it('exact locale, then language fallback, never another language', () => {
    expect(resolvePayButtonLabel(settings, 'sv')).toBe('Betala med kort');
    expect(resolvePayButtonLabel(settings, 'sv-SE')).toBe('Betala med kort');
    expect(resolvePayButtonLabel(settings, 'en')).toBeNull();
    expect(resolvePayButtonLabel(DEFAULT_CHECKOUT_SETTINGS, 'sv')).toBeNull();
    expect(resolvePayButtonLabel(null, 'sv')).toBeNull();
  });
});

describe('captureCouponFromSearch', () => {
  const on = { coupon_param: ['coupon', 'coupon1'], coupon_autoapply: true };

  it('off (default): nothing is captured even with ?coupon=', () => {
    expect(captureCouponFromSearch('?coupon=X', DEFAULT_CHECKOUT_SETTINGS)).toBeNull();
  });

  it('captures the code and strips every coupon key, keeping the rest', () => {
    expect(captureCouponFromSearch('?utm=a&coupon1=SPRING&x=1', on)).toEqual({ code: 'SPRING', search: '?utm=a&x=1' });
    expect(captureCouponFromSearch('?coupon=ONLY', on)).toEqual({ code: 'ONLY', search: '' });
    expect(captureCouponFromSearch('coupon1=%20abc%20', on)).toEqual({ code: 'abc', search: '' });
  });

  it('the first configured key wins when several are present', () => {
    expect(captureCouponFromSearch('?coupon1=B&coupon=A', on)).toEqual({ code: 'A', search: '' });
  });

  it('an empty / oversized value is ignored (but still stripped)', () => {
    expect(captureCouponFromSearch('?coupon=', on)).toBeNull();
    expect(captureCouponFromSearch(`?coupon=${'x'.repeat(65)}`, on)).toBeNull();
    expect(captureCouponFromSearch('', on)).toBeNull();
    expect(captureCouponFromSearch('?other=1', on)).toBeNull();
  });
});

describe('no_customer_accounts', () => {
  it('is present only when literally true', () => {
    expect(normalizeCheckoutSettings({ no_customer_accounts: true }).no_customer_accounts).toBe(true);
    for (const value of [false, null, undefined, 'true', 1, {}]) {
      expect(normalizeCheckoutSettings({ no_customer_accounts: value })).not.toHaveProperty('no_customer_accounts');
    }
    expect(normalizeCheckoutSettings(null)).not.toHaveProperty('no_customer_accounts');
  });

  it('works without an external site and changes nothing else', () => {
    expect(normalizeCheckoutSettings({ no_customer_accounts: true })).toStrictEqual({
      ...DEFAULT_CHECKOUT_SETTINGS,
      no_customer_accounts: true,
    });
    const withSite = normalizeCheckoutSettings({ external_site_url: 'https://example.se/', no_customer_accounts: true });
    expect(withSite.no_customer_accounts).toBe(true);
    expect(withSite.external_site_url).toBe('https://example.se/');
  });

  it('the defaults carry neither new key', () => {
    expect(DEFAULT_CHECKOUT_SETTINGS).not.toHaveProperty('no_customer_accounts');
    expect(DEFAULT_CHECKOUT_SETTINGS).not.toHaveProperty('return_label');
    expect(normalizeCheckoutSettings({})).toStrictEqual({ ...DEFAULT_CHECKOUT_SETTINGS });
  });
});

describe('guestEmailExistsNeedsPasswordSetup', () => {
  it('is true only for AUTH_EMAIL_EXISTS on a store without customer accounts', () => {
    const on = normalizeCheckoutSettings({ no_customer_accounts: true });
    expect(guestEmailExistsNeedsPasswordSetup('AUTH_EMAIL_EXISTS', on)).toBe(true);
    expect(guestEmailExistsNeedsPasswordSetup('AUTH_CAPTCHA_FAILED', on)).toBe(false);
    expect(guestEmailExistsNeedsPasswordSetup(undefined, on)).toBe(false);
    expect(guestEmailExistsNeedsPasswordSetup(null, on)).toBe(false);
  });

  it('stays false for stores without the option (former "log in" message)', () => {
    expect(guestEmailExistsNeedsPasswordSetup('AUTH_EMAIL_EXISTS', normalizeCheckoutSettings(null))).toBe(false);
    expect(guestEmailExistsNeedsPasswordSetup('AUTH_EMAIL_EXISTS', { ...DEFAULT_CHECKOUT_SETTINGS })).toBe(false);
    expect(
      guestEmailExistsNeedsPasswordSetup('AUTH_EMAIL_EXISTS', normalizeCheckoutSettings({ no_customer_accounts: false })),
    ).toBe(false);
  });
});
