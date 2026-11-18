import { describe, expect, it } from 'vitest';
import { storeFaviconRewritePath } from './storeFavicon';

describe('storeFaviconRewritePath', () => {
  it('store host: /favicon.ico goes to the store route', () => {
    expect(storeFaviconRewritePath('/favicon.ico', 'newroj')).toBe('/store/newroj/favicon.ico');
  });

  it('platform host (no store): passes through', () => {
    expect(storeFaviconRewritePath('/favicon.ico', null)).toBeNull();
  });

  it('any other path is not touched', () => {
    expect(storeFaviconRewritePath('/logo.png', 'newroj')).toBeNull();
    expect(storeFaviconRewritePath('/sv/favicon.ico', 'newroj')).toBeNull();
    expect(storeFaviconRewritePath('/favicon.ico/', 'newroj')).toBeNull();
  });
});
