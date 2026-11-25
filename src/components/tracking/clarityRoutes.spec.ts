import { describe, expect, it } from 'vitest';
import { clarityAllowedFor, isClarityExcludedPath, vendorTagsAllowedFor } from './clarity';

// Routes kept away from session recording and, for the review write page
// (a review-link token arrives in its URL), from every vendor tag.

describe('clarityAllowedFor', () => {
  it.each([
    [['account']],
    [['account', 'orders', 'abc']],
    [['auth', 'reset-password']],
    [['reviews', 'write']],
    [['(checkout)', 'checkout', 'confirmation']],
  ])('never on %j', (segments) => {
    expect(clarityAllowedFor(segments)).toBe(false);
  });

  it.each([[[]], [['products', 'mug']], [['(checkout)', 'checkout']], [['pages', 'reviews']]])('allowed on %j', (segments) => {
    expect(clarityAllowedFor(segments)).toBe(true);
  });
});

describe('isClarityExcludedPath', () => {
  it.each([
    '/store/namez/reviews/write',
    '/store/namez/reviews/write?product=11111111-1111-4111-8111-111111111111',
    '/reviews/write#token=abc',
    '/de-de/reviews/write',
    '/store/namez/account/orders/1',
    '/auth/login',
    '/checkout/confirmation?order=1',
  ])('excluded: %s', (path) => {
    expect(isClarityExcludedPath(path)).toBe(true);
  });

  it.each(['/', '/store/namez/products/mug', '/store/namez/products/mug?reviews_page=2', '/checkout'])('recorded: %s', (path) => {
    expect(isClarityExcludedPath(path)).toBe(false);
  });
});

describe('vendorTagsAllowedFor', () => {
  it('no vendor tag on the review pages (the URL can hold the link token)', () => {
    expect(vendorTagsAllowedFor(['reviews', 'write'])).toBe(false);
    expect(vendorTagsAllowedFor(['reviews'])).toBe(false);
  });

  it('every other route keeps its tags (account, auth, checkout and products as before)', () => {
    for (const segments of [[], ['products', 'mug'], ['account'], ['auth', 'login'], ['(checkout)', 'checkout', 'confirmation'], ['pages', 'reviews']]) {
      expect(vendorTagsAllowedFor(segments)).toBe(true);
    }
  });
});
