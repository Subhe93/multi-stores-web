import { defaultLocale, isStoreLocale, type StoreLocale } from './config';

type Messages = { [key: string]: string | Messages };

// Locales whose message file may be incomplete while it is being translated:
// every key missing (or left empty) in them falls back to the English string.
// The six original locales keep loading their own file untouched.
const ENGLISH_FALLBACK_LOCALES: readonly StoreLocale[] = ['ku'];

/** Deep merge: `over` wins wherever it has a non-empty string. */
export function mergeMessages(base: Messages, over: Messages): Messages {
  const out: Messages = { ...base };
  for (const [key, value] of Object.entries(over)) {
    const prev = out[key];
    if (typeof value === 'string') {
      if (value.trim() !== '' || prev === undefined) out[key] = value;
    } else if (value && typeof value === 'object') {
      out[key] = prev && typeof prev === 'object' ? mergeMessages(prev, value) : value;
    }
  }
  return out;
}

/**
 * The message catalogue for a locale (unknown codes load the default one).
 * Every place that loads messages goes through here so a store-only locale
 * gets the English fallback for strings that are not translated yet.
 */
export async function loadMessages(locale: string): Promise<Messages> {
  const code: StoreLocale = isStoreLocale(locale) ? locale : defaultLocale;
  const own = (await import(`./messages/${code}.json`)).default as Messages;
  if (!(ENGLISH_FALLBACK_LOCALES as readonly string[]).includes(code)) return own;
  const en = (await import('./messages/en.json')).default as Messages;
  return mergeMessages(en, own);
}
