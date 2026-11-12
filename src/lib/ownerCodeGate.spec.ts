import { describe, expect, it } from 'vitest';
import { ownerCodeAllowedFor } from './ownerCodeGate';

// Owner custom CSS and header/footer embeds stay off the platform-owned pages.
describe('ownerCodeAllowedFor', () => {
  it('blocks checkout, sign-in and account pages', () => {
    for (const seg of ['(checkout)', 'auth', 'account']) expect(ownerCodeAllowedFor(seg)).toBe(false);
  });

  it('allows the home page and every other storefront page', () => {
    for (const seg of [null, 'products', 'collections', 'cart', 'legal', '[pageSlug]', 'om-oss']) {
      expect(ownerCodeAllowedFor(seg)).toBe(true);
    }
  });
});
