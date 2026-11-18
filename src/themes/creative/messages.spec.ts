import { describe, expect, it } from 'vitest';
import { locales } from '@/i18n/config';
import en from '@/i18n/messages/en.json';
import ar from '@/i18n/messages/ar.json';
import tr from '@/i18n/messages/tr.json';
import de from '@/i18n/messages/de.json';
import fr from '@/i18n/messages/fr.json';
import sv from '@/i18n/messages/sv.json';
import { CREATIVE_SECTION_KEYS } from './constants';

const messages: Record<string, { creative?: unknown }> = { en, ar, tr, de, fr, sv };

function flatten(value: unknown, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {};
  if (!value || typeof value !== 'object') return out;
  for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (v && typeof v === 'object') Object.assign(out, flatten(v, path));
    else out[path] = String(v ?? '');
  }
  return out;
}

const camel = (key: string) => key.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());

describe('i18n namespace "creative"', () => {
  const reference = flatten(en.creative);

  it('has the visitor strings and one empty state per creative section', () => {
    expect(Object.keys(reference).sort()).toEqual(
      [
        'marqueePause',
        'marqueePlay',
        'storySkip',
        'storyHint',
        'storyProgress',
        'loadingPage',
        ...CREATIVE_SECTION_KEYS.map((key) => `empty.${camel(key)}`),
      ].sort(),
    );
  });

  it.each([...locales])('%s: same keys, none empty', (locale) => {
    const flat = flatten(messages[locale].creative);
    expect(Object.keys(flat).sort()).toEqual(Object.keys(reference).sort());
    for (const [key, value] of Object.entries(flat)) expect(value.trim(), `${locale}.${key}`).not.toBe('');
  });

  it.each([...locales])('%s: the progress counter keeps both placeholders', (locale) => {
    const flat = flatten(messages[locale].creative);
    expect(flat.storyProgress).toBe('{current} / {total}');
  });

  it('non-English locales are translated', () => {
    for (const locale of locales) {
      if (locale === 'en') continue;
      const flat = flatten(messages[locale].creative);
      expect(flat.storyHint, locale).not.toBe(reference.storyHint);
      expect(flat.loadingPage, locale).not.toBe(reference.loadingPage);
    }
  });
});
