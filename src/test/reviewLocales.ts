import { afterAll, beforeAll } from 'vitest';
import { reviewLocales, type StoreLocale } from '@/i18n/config';

/**
 * Puts `codes` into the platform review list for the surrounding describe, so
 * the review mechanism (hidden from switcher / hreflang / sitemap, noindex)
 * stays testable now that no real locale is in review. Call inside a describe.
 */
export function injectReviewLocales(...codes: StoreLocale[]): void {
  beforeAll(() => {
    (reviewLocales as StoreLocale[]).push(...codes);
  });
  afterAll(() => {
    (reviewLocales as StoreLocale[]).length = 0;
  });
}
