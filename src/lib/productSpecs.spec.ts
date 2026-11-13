import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { attrLabel, attrSwatchColor, findAttribute, formatAttrValue, yesNoWords } from './productSpecs';

// Parity with the monolith's specifications tab (ProductDetailClient:
// renderAttrValue + the label chain). ProductDetailClient is not refactored
// onto these helpers, so these cases pin the same rules.

const words = { yes: 'Yes', no: 'No' };
const attr = (type: string | undefined, value: unknown, unit?: string) => ({
  id: 'a',
  value,
  template: { name: 'size', type, unit, translations: [{ locale: 'sv', label: 'Storlek' }, { locale: 'en', label: 'Size' }] },
});

describe('formatAttrValue (monolith renderAttrValue)', () => {
  it('formats every attribute type like the product page', () => {
    expect(formatAttrValue(attr('COLOR', '#ff0000'), words)).toBe('#ff0000');
    expect(attrSwatchColor(attr('COLOR', '#ff0000'))).toBe('#ff0000');
    expect(attrSwatchColor(attr('TEXT', '#ff0000'))).toBeNull();
    expect(formatAttrValue(attr('BOOLEAN', true), words)).toBe('Yes');
    expect(formatAttrValue(attr('BOOLEAN', false), words)).toBe('No');
    expect(formatAttrValue(attr('DIMENSIONS', { w: 10, h: 20, d: 5 }, 'cm'), words)).toBe('10cm × 20cm × 5cm');
    expect(formatAttrValue(attr('DIMENSIONS', { w: 10, h: 20 }), words)).toBe('10 × 20');
    expect(formatAttrValue(attr('MULTI_SELECT', ['a', 'b']), words)).toBe('a, b');
    expect(formatAttrValue(attr('NUMBER', 330, 'ml'), words)).toBe('330 ml');
    expect(formatAttrValue(attr('TEXT', 'Keramik'), words)).toBe('Keramik');
    expect(formatAttrValue(attr('JSON', { x: 1 }), words)).toBe('{"x":1}');
    expect(formatAttrValue(attr(undefined, null), words)).toBe('null');
  });
});

describe('attrLabel (monolith label chain)', () => {
  it('locale label, then first label, then template name', () => {
    expect(attrLabel(attr('TEXT', 'x'), 'en')).toBe('Size');
    expect(attrLabel(attr('TEXT', 'x'), 'de')).toBe('Storlek');
    expect(attrLabel({ id: 'b', value: 1, template: { name: 'raw', translations: [] } }, 'en')).toBe('raw');
  });
});

describe('findAttribute', () => {
  it('matches template name or any label, case-insensitive', () => {
    const list = [attr('TEXT', 'x')];
    expect(findAttribute(list, 'SIZE')).toBe(list[0]);
    expect(findAttribute(list, 'storlek')).toBe(list[0]);
    expect(findAttribute(list, '')).toBeNull();
    expect(findAttribute(list, 'colour')).toBeNull();
  });
});

describe('yesNoWords', () => {
  it('matches common.yes / common.no of every storefront message file', () => {
    for (const locale of ['en', 'ar', 'tr', 'de', 'fr', 'sv']) {
      const file = fileURLToPath(new URL(`../i18n/messages/${locale}.json`, import.meta.url));
      const messages = JSON.parse(readFileSync(file, 'utf8')) as { common: { yes: string; no: string } };
      expect(yesNoWords(locale), locale).toEqual({ yes: messages.common.yes, no: messages.common.no });
    }
    expect(yesNoWords('xx')).toEqual({ yes: 'Yes', no: 'No' });
  });
});
