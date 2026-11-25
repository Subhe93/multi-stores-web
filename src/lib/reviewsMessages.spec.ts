import { describe, expect, it } from 'vitest';
import ar from '@/i18n/messages/ar.json';
import de from '@/i18n/messages/de.json';
import en from '@/i18n/messages/en.json';
import fr from '@/i18n/messages/fr.json';
import sv from '@/i18n/messages/sv.json';
import tr from '@/i18n/messages/tr.json';
import { STORE_APP_KEYS } from './storeApps';
import { isReviewsErrorKey, reviewsClientMessages, REVIEWS_ACCOUNT_KEYS } from './reviewsMessages';

type Tree = { [key: string]: string | Tree };
const FILES: Record<string, Tree> = { en, ar, tr, de, fr, sv } as unknown as Record<string, Tree>;

/** Dotted paths of every string in a message tree. */
function paths(tree: Tree, prefix = ''): string[] {
  return Object.entries(tree).flatMap(([key, value]) =>
    typeof value === 'string' ? [`${prefix}${key}`] : paths(value, `${prefix}${key}.`),
  );
}

/** ICU argument names of a message. */
function args(message: string): string[] {
  return [...new Set([...message.matchAll(/\{\s*([a-zA-Z_]+)\s*[,}]/g)].map((m) => m[1]!))].sort();
}

const ERROR_CODES = [
  'REVIEW_NOT_PURCHASED',
  'REVIEW_ORDER_NOT_ELIGIBLE',
  'REVIEW_LINK_INVALID',
  'REVIEW_RATING_INVALID',
  'REVIEW_BODY_TOO_SHORT',
  'REVIEW_BODY_TOO_LONG',
  'REVIEW_TITLE_TOO_LONG',
  'REVIEW_DISPLAY_NAME_INVALID',
  'REVIEW_LOCALE_INVALID',
  'REVIEW_TEXT_INVALID',
  'REVIEW_PRODUCT_NOT_FOUND',
  'REVIEW_NOT_FOUND',
  // Reused codes the write page can meet.
  'STORE_APP_NOT_ENABLED',
  'CUSTOMER_STORE_MISMATCH',
  'AUTH_CAPTCHA_FAILED',
  'AUTH_CAPTCHA_UNAVAILABLE',
  'generic',
];

describe('reviews app key', () => {
  it('is in the mirrored key list', () => {
    expect(STORE_APP_KEYS).toContain('reviews');
  });
});

describe('reviews messages: six locales', () => {
  const reference = paths(en.reviews as unknown as Tree).sort();

  it('the English namespace has the documented keys', () => {
    for (const key of [
      'heading', 'count', 'averageLabel', 'starsLabel', 'distributionRow', 'verified', 'replyFrom', 'empty', 'write',
      'edit', 'previous', 'next', 'pageLabel', 'ratingLine', 'form.title', 'form.intro', 'form.rating',
      'form.ratingRequired', 'form.displayName', 'form.displayNameHint', 'form.reviewTitle', 'form.body', 'form.bodyHint',
      'form.counter', 'form.submit', 'form.submitting', 'form.editingNotice', 'form.signInRequired', 'form.signIn',
      'form.notPurchased', 'form.successPendingTitle', 'form.successPendingText', 'form.successPublishedTitle',
      'form.successPublishedText', 'form.backToProduct', 'form.linkInvalidTitle', 'form.linkInvalidText',
      'form.notEligibleTitle', 'form.notEligibleText', 'status.PENDING', 'status.APPROVED', 'status.REJECTED',
    ]) {
      expect(reference, key).toContain(key);
    }
  });

  for (const [locale, file] of Object.entries(FILES)) {
    it(`${locale}: same keys as English, none empty, same ICU arguments`, () => {
      const tree = file.reviews as Tree;
      expect(paths(tree).sort()).toEqual(reference);
      for (const path of reference) {
        const read = (t: Tree) => path.split('.').reduce<string | Tree>((node, key) => (node as Tree)[key]!, t) as string;
        const text = read(tree);
        expect(text.trim(), `${locale} ${path}`).not.toBe('');
        expect(args(text), `${locale} ${path}`).toEqual(args(read(en.reviews as unknown as Tree)));
      }
    });

    it(`${locale}: account labels and error codes`, () => {
      const account = file.account as Tree;
      for (const key of REVIEWS_ACCOUNT_KEYS) expect(typeof account[key], key).toBe('string');
      const errors = file.errors as Tree;
      for (const code of ERROR_CODES) {
        expect(typeof errors[code], `${locale} ${code}`).toBe('string');
        expect((errors[code] as string).trim(), `${locale} ${code}`).not.toBe('');
      }
    });
  }

  it('translations are not copies of the English text', () => {
    for (const [locale, file] of Object.entries(FILES)) {
      if (locale === 'en') continue;
      expect((file.reviews as Tree).heading, locale).not.toBe(en.reviews.heading);
      expect((file.errors as Tree).REVIEW_LINK_INVALID, locale).not.toBe(en.errors.REVIEW_LINK_INVALID);
    }
  });
});

describe('reviewsClientMessages', () => {
  it('app on: the same object', () => {
    expect(reviewsClientMessages(en, true)).toBe(en);
  });

  it('app off: no review text reaches the client payload', () => {
    for (const [locale, file] of Object.entries(FILES)) {
      const out = reviewsClientMessages(file, false) as Tree;
      expect(out, locale).not.toHaveProperty('reviews');
      expect(Object.keys(out.errors as Tree).filter(isReviewsErrorKey), locale).toEqual([]);
      for (const key of REVIEWS_ACCOUNT_KEYS) expect(out.account, locale).not.toHaveProperty(key);
    }
  });

  it('app off: everything else is kept, in the same order, and the input is not mutated', () => {
    const before = JSON.stringify(en);
    const out = reviewsClientMessages(en, false) as unknown as Tree;
    expect(JSON.stringify(en)).toBe(before);
    expect(Object.keys(out)).toEqual(Object.keys(en).filter((k) => k !== 'reviews'));
    expect(out.cart).toBe((en as unknown as Tree).cart);
    expect((out.errors as Tree).generic).toBe(en.errors.generic);
    expect((out.errors as Tree).STORE_APP_NOT_ENABLED).toBe(en.errors.STORE_APP_NOT_ENABLED);
    expect((out.account as Tree).orders).toBe(en.account.orders);

    // Exactly the catalogue a store had before the app existed.
    const pre = JSON.parse(before) as Tree;
    delete pre.reviews;
    for (const key of Object.keys(pre.errors as Tree)) if (isReviewsErrorKey(key)) delete (pre.errors as Tree)[key];
    for (const key of REVIEWS_ACCOUNT_KEYS) delete (pre.account as Tree)[key];
    expect(JSON.stringify(out)).toBe(JSON.stringify(pre));
  });

  it('a catalogue without review texts passes through', () => {
    const messages = { cart: { a: '1' }, errors: { generic: 'x' } };
    expect(JSON.stringify(reviewsClientMessages(messages, false))).toBe(JSON.stringify(messages));
  });
});
