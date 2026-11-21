import { describe, expect, it } from 'vitest';
import ar from './messages/ar.json';
import de from './messages/de.json';
import en from './messages/en.json';
import fr from './messages/fr.json';
import ku from './messages/ku.json';
import sv from './messages/sv.json';
import tr from './messages/tr.json';

// M157: the storefront messages of the per-market payment methods exist,
// non-empty, in every locale file.
const KEYS = [
  'errors.MARKET_PAYMENT_METHOD_NOT_ALLOWED',
  'errors.KUSTOM_CURRENCY_NOT_ENABLED',
  'checkout.kustomCurrencyNotEnabled',
  'checkout.kustomCurrencyNotEnabledNoCard',
  'checkout.payByCardInstead',
  'checkout.kustomValidationReasons.paymentMethodUnavailable',
];

const LOCALES: Record<string, unknown> = { ar, de, en, fr, ku, sv, tr };

function lookup(tree: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((node, key) => (node && typeof node === 'object' ? (node as Record<string, unknown>)[key] : undefined), tree);
}

describe('M157 storefront messages', () => {
  for (const [locale, messages] of Object.entries(LOCALES)) {
    it(`${locale} has every key`, () => {
      for (const key of KEYS) {
        const value = lookup(messages, key);
        expect(typeof value, `${locale}: ${key}`).toBe('string');
        expect((value as string).trim(), `${locale}: ${key}`).not.toBe('');
      }
    });
  }

  it('shopper copy names the Klarna brand, not Kustom', () => {
    for (const [locale, messages] of Object.entries(LOCALES)) {
      for (const key of KEYS) expect(lookup(messages, key) as string, `${locale}: ${key}`).not.toMatch(/kustom/i);
    }
  });
});
