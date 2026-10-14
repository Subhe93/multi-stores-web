import { describe, expect, it } from 'vitest';
import { buildMarketSwitchUrl } from './marketSwitch';

const se = { key: 'se', default_locale: 'sv', locales: ['en', 'ar'], primary_hostname: 'namez.se' };
const eu = { key: 'eu', default_locale: 'en', locales: ['de', 'fr', 'ar'], primary_hostname: 'namez.shop' };

describe('buildMarketSwitchUrl', () => {
  it('keeps the locale when the target serves it, else uses the target default', () => {
    expect(buildMarketSwitchUrl({ storeSlug: 'namez', current: se, target: eu, pathname: '/en/products/x', locale: 'en' }))
      .toBe('https://namez.shop/products/x');
    expect(buildMarketSwitchUrl({ storeSlug: 'namez', current: se, target: eu, pathname: '/products/x', locale: 'sv' }))
      .toBe('https://namez.shop/products/x');
    expect(buildMarketSwitchUrl({ storeSlug: 'namez', current: se, target: eu, pathname: '/ar/', locale: 'ar' }))
      .toBe('https://namez.shop/ar');
  });

  it('preserves the query string, replaces a stale hand-off param and appends the cart', () => {
    expect(buildMarketSwitchUrl({
      storeSlug: 'namez', current: se, target: eu, pathname: '/products', search: '?sort=newest&c=old&cd=9', locale: 'sv',
      cartParam: 'NEW', cartDropped: 1,
    })).toBe('https://namez.shop/products?sort=newest&c=NEW&cd=1');
    expect(buildMarketSwitchUrl({ storeSlug: 'namez', current: se, target: eu, pathname: '/', search: '?utm=1', locale: 'sv' }))
      .toBe('https://namez.shop?utm=1');
  });

  it('uses translated slugs per target locale', () => {
    expect(buildMarketSwitchUrl({
      storeSlug: 'namez', current: eu, target: se, pathname: '/de/products/metal-card', locale: 'de',
      pathByLocale: { sv: '/products/metallkort', en: '/products/metal-card' },
    })).toBe('https://namez.se/products/metallkort');
  });
});
