import { describe, expect, it } from 'vitest';
import { isActiveHref } from './activeHref';

const q = (s: string) => new URLSearchParams(s);

describe('isActiveHref', () => {
  it('matches a link without a query on the pathname only (as before)', () => {
    expect(isActiveHref('/products', '/products', q(''))).toBe(true);
    expect(isActiveHref('/products', '/products', q('sort=newest'))).toBe(true);
    expect(isActiveHref('/products', '/products/shirt', q(''))).toBe(true);
    expect(isActiveHref('/products', '/products/shirt', q(''), true)).toBe(false);
    expect(isActiveHref('/products', '/productsx', q(''))).toBe(false);
    expect(isActiveHref('/', '/cart', q(''))).toBe(false);
  });

  it('never matches an anchor or an empty href', () => {
    expect(isActiveHref('#', '/', q(''))).toBe(false);
    expect(isActiveHref('#menu', '/', q(''))).toBe(false);
    expect(isActiveHref(undefined, '/', q(''))).toBe(false);
  });

  it('requires the link own query parameters when it has some', () => {
    expect(isActiveHref('/products?sort=newest', '/products', q('sort=newest'))).toBe(true);
    expect(isActiveHref('/products?sort=newest', '/products', q('sort=newest&page=2'))).toBe(true);
    expect(isActiveHref('/products?sort=newest', '/products', q(''))).toBe(false);
    expect(isActiveHref('/products?sort=newest', '/products', q('sort=popular'))).toBe(false);
    expect(isActiveHref('/products?sort=newest', '/products', null)).toBe(false);
    // A filtered view is one page, not a section: no prefix match.
    expect(isActiveHref('/products?sort=newest', '/products/shirt', q('sort=newest'))).toBe(false);
  });

  it('highlights only one of several filtered links to the same page', () => {
    const links = ['/products?sort=newest', '/products?sort=popular', '/products?sale=true'];
    const active = links.filter((href) => isActiveHref(href, '/products', q('sort=popular')));
    expect(active).toEqual(['/products?sort=popular']);
  });

  it('treats a bare "?" like no query and ignores the hash', () => {
    expect(isActiveHref('/products?', '/products', q('sort=newest'))).toBe(true);
    expect(isActiveHref('/products#top', '/products', q(''))).toBe(true);
  });

  it('compares percent-encoded and raw slugs as equal', () => {
    expect(isActiveHref('/collections/kläder', '/collections/kl%C3%A4der', q(''))).toBe(true);
  });
});
