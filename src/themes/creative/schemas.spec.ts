import { describe, expect, it } from 'vitest';
import type { FieldDefinition } from '../types';
import { CREATIVE_SECTION_KEYS } from './constants';
import { CREATIVE_SCHEMAS } from './schemas';

const entries = CREATIVE_SECTION_KEYS.map((key) => [key, CREATIVE_SCHEMAS[key]] as const);

/** Every field of a schema, repeater sub-fields included. */
function allFields(fields: FieldDefinition[]): FieldDefinition[] {
  return fields.flatMap((f) => (f.fields ? [f, ...allFields(f.fields)] : [f]));
}

const isSizeKey = (key: string) => key === 'size' || key.endsWith('_size');

describe('creative section schemas', () => {
  it('one schema per creative section key, with a matching id', () => {
    expect(Object.keys(CREATIVE_SCHEMAS).sort()).toEqual([...CREATIVE_SECTION_KEYS].sort());
    for (const [key, entry] of entries) expect(entry.schema.id).toBe(key);
  });

  // The one exception: the height of the woven band (24 / 48 / 96 px). It is
  // the height of a strip of pattern, not the size of a word or an emblem.
  const isBandHeight = (key: string, field: string) => key === 'pattern-band' && field === 'size';

  it.each(entries)('%s: every size field offers exactly sm / md, default md (no giant words)', (key, entry) => {
    const sizes = allFields(entry.schema.schema).filter((f) => isSizeKey(f.key) && !isBandHeight(key, f.key));
    for (const f of sizes) {
      expect(f.type, f.key).toBe('select');
      expect(f.options?.map((o) => o.value), f.key).toEqual(['sm', 'md']);
      expect(f.defaultValue, f.key).toBe('md');
    }
    // A stored default never asks for more than md either.
    for (const [k, v] of Object.entries(entry.defaultSettings)) {
      if (isSizeKey(k)) expect(v, k).toBe('md');
    }
  });

  it('the size fields exist where the contract puts them', () => {
    const sizeKeys = (key: (typeof CREATIVE_SECTION_KEYS)[number]) =>
      allFields(CREATIVE_SCHEMAS[key].schema.schema)
        .filter((f) => isSizeKey(f.key))
        .map((f) => f.key);
    expect(sizeKeys('sticky-steps')).toEqual(['numeral_size']);
    expect(sizeKeys('motion-path')).toEqual(['artwork_size']);
    expect(sizeKeys('marquee-band')).toEqual(['size']);
  });

  it.each(entries)('%s: no option anywhere is called lg, xl or giant for a decorative size', (key, entry) => {
    for (const f of allFields(entry.schema.schema)) {
      if (!/accent|numeral|artwork|sun_size|^size$|scale/.test(f.key) || isBandHeight(key, f.key)) continue;
      const values = f.options?.map((o) => o.value) ?? [];
      expect(values, f.key).not.toContain('lg');
      expect(values, f.key).not.toContain('xl');
    }
  });

  it.each(entries)('%s: every boolean default is stored in defaultSettings; stored defaults equal field defaults', (_key, entry) => {
    for (const f of entry.schema.schema) {
      if (f.type === 'boolean') {
        expect(typeof f.defaultValue, f.key).toBe('boolean');
        expect(entry.defaultSettings[f.key], f.key).toBe(f.defaultValue);
      }
      if (f.type === 'select') {
        expect(f.options?.map((o) => o.value), f.key).toContain(f.defaultValue);
      }
      if (f.key in entry.defaultSettings && f.defaultValue !== undefined) {
        expect(entry.defaultSettings[f.key], f.key).toBe(f.defaultValue);
      }
    }
  });

  it.each(entries)('%s: defaultSettings only names real, non-translatable fields with valid values', (_key, entry) => {
    for (const [k, v] of Object.entries(entry.defaultSettings)) {
      const f = entry.schema.schema.find((x) => x.key === k);
      expect(f, k).toBeTruthy();
      expect(entry.schema.translatable, k).not.toContain(k);
      if (f?.type === 'select') expect(f.options?.map((o) => o.value), k).toContain(v);
    }
  });

  it.each(entries)('%s: labels, descriptions and option labels exist in en and ar', (_key, entry) => {
    const check = (label: Record<string, string> | undefined, where: string) => {
      expect(label?.en?.trim(), `${where} en`).toBeTruthy();
      expect(label?.ar?.trim(), `${where} ar`).toBeTruthy();
    };
    check(entry.schema.label, 'section label');
    check(entry.schema.description, 'section description');
    for (const f of allFields(entry.schema.schema)) {
      check(f.label, f.key);
      if (f.description) check(f.description, `${f.key} description`);
      for (const o of f.options ?? []) check(o.label, `${f.key}.${o.value}`);
    }
  });

  it.each(entries)('%s: translatable keys exist, are text-like, and settings are not translatable', (_key, entry) => {
    const byKey = new Map(entry.schema.schema.map((f) => [f.key, f]));
    for (const key of entry.schema.translatable) {
      const f = byKey.get(key);
      expect(f, key).toBeTruthy();
      expect(['text', 'textarea', 'richtext', 'repeater'], key).toContain(f!.type);
    }
    for (const f of entry.schema.schema) {
      if (['image', 'url', 'select', 'color', 'boolean', 'number'].includes(f.type)) {
        expect(entry.schema.translatable, f.key).not.toContain(f.key);
      }
    }
    for (const key of Object.keys(entry.defaultContent)) expect(entry.schema.translatable, key).toContain(key);
  });

  it.each(entries)('%s: unique keys, sane limits, visibility rules point at a sibling', (_key, entry) => {
    const walk = (fields: FieldDefinition[]) => {
      const keys = fields.map((f) => f.key);
      expect(new Set(keys).size, keys.join(',')).toBe(keys.length);
      for (const f of fields) {
        if (f.type === 'text' || f.type === 'textarea') expect(f.maxLength, f.key).toBeGreaterThan(0);
        if (f.type === 'repeater') {
          expect(f.maxItems, f.key).toBeGreaterThan(0);
          walk(f.fields ?? []);
        }
        if (f.showIf) {
          const sibling = fields.find((x) => x.key === f.showIf!.key);
          expect(sibling, `${f.key} showIf`).toBeTruthy();
          for (const v of f.showIf.in) expect(sibling!.options?.map((o) => o.value), f.key).toContain(v);
        }
      }
    };
    walk(entry.schema.schema);
  });

  it('page types: brand pages, plus the footer or the product template where the section belongs there', () => {
    const PAGES = ['HOME', 'STATIC', 'LANDING'];
    const expected: Record<string, string[]> = {
      'hero-outline': PAGES,
      'hero-sunrise': PAGES,
      'hero-dawn': PAGES,
      'stage-scenes': PAGES,
      'story-pinned': PAGES,
      'sticky-steps': PAGES,
      'motion-path': PAGES,
      'marquee-band': [...PAGES, 'FOOTER'],
      'ornament-line': [...PAGES, 'FOOTER'],
      'cover-hero': PAGES,
      'look-spread': PAGES,
      'object-study': [...PAGES, 'PRODUCT_TEMPLATE'],
      'script-manifesto': [...PAGES, 'FOOTER'],
      'impact-arc': PAGES,
      'pattern-band': [...PAGES, 'FOOTER'],
      'promise-band': PAGES,
    };
    for (const [key, entry] of entries) expect(entry.schema.pageTypes, key).toEqual(expected[key]);
  });

  it('the ornament is a divider only: no text, button, frame or colour scene fields', () => {
    const keys = CREATIVE_SCHEMAS['ornament-line'].schema.schema.map((f) => f.key);
    expect(keys).toEqual(['tile_width', 'tile_height', 'paths', 'color_a', 'color_b', 'color_c', 'stroke', 'width', 'draw']);
    expect(CREATIVE_SCHEMAS['ornament-line'].schema.translatable).toEqual([]);
  });
});
