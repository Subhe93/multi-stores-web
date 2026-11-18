import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';
import { describe, expect, it, vi } from 'vitest';
import type { FieldDefinition, SectionDefinition } from '../../types';

vi.mock('next-intl', () => ({
  useTranslations: (ns?: string) => (k: string) => (ns ? `${ns}.${k}` : k),
}));

import { minimalTheme } from '../theme';
import { classicTheme } from '../../classic/theme';

// Cross-repo check of the "page touches" batch: the dashboard copy of the
// brand-band schema, of the heading accent pair and of the header setting
// compact_on_scroll, against the storefront definitions. Reads the sibling
// dashboard checkout (same loader as editorialPresets.test.tsx); skipped
// when it is not there, so the storefront repo alone still passes.
const SCHEMAS_FILE = resolve(process.cwd(), '../multi-stores-dashboard/src/lib/section-schemas.ts');
const hasDashboard = existsSync(SCHEMAS_FILE);

// The dashboard file has no runtime imports, so it is transpiled and
// evaluated on its own (Vite does not serve files outside this project root).
function loadModule<T>(file: string): T {
  const js = ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {} as T;
  new Function('exports', 'require', js)(exports, (id: string) => {
    throw new Error(`unexpected runtime import in ${file}: ${id}`);
  });
  return exports;
}

interface DashboardSchema {
  id: string;
  category?: string;
  icon?: string;
  pageTypes?: string[];
  chrome?: boolean;
  translatable: string[];
  schema: FieldDefinition[];
  defaultSettings?: Record<string, unknown>;
  defaultContent?: Record<string, unknown>;
}

// Added to the dashboard schemas by its heading machinery; the storefront
// components read them from settings without declaring them.
const HEADING_TAG_KEYS = ['heading_level', 'subheading_tag', 'eyebrow_tag'];

const ACCENT_SECTIONS = [
  'hero-banner',
  'hero-split',
  'hero-slider',
  'hero-video',
  'parallax-banner',
  'image-with-text',
  'brand-band',
];
const ACCENT_KEYS = ['heading_accent', 'heading_accent_color'];

const sections = minimalTheme.sections as Record<string, SectionDefinition>;

/** Type, default, option values, limits and visibility rule of one field. */
function fieldShape(f: FieldDefinition | undefined) {
  if (!f) return undefined;
  return {
    type: f.type,
    defaultValue: f.defaultValue,
    options: f.options?.map((o) => o.value),
    min: f.min,
    max: f.max,
    maxLength: f.maxLength,
    maxItems: f.maxItems,
    showIf: f.showIf,
  };
}

function loadDashboard() {
  const { findSectionSchema } = loadModule<{ findSectionSchema: (id: string) => DashboardSchema | undefined }>(SCHEMAS_FILE);
  return (id: string) => {
    const found = findSectionSchema(id);
    if (!found) throw new Error(`dashboard schema missing: ${id}`);
    return found;
  };
}

const field = (fields: FieldDefinition[], key: string) => fields.find((f) => f.key === key);

describe.skipIf(!hasDashboard)('page touches: dashboard and storefront agree', () => {
  it('brand-band: same fields in the same order, with the same shape', () => {
    const dashboard = loadDashboard()('brand-band');
    const web = sections['brand-band'];
    const dashboardFields = dashboard.schema.filter((f) => !HEADING_TAG_KEYS.includes(f.key));
    expect(dashboardFields.map((f) => f.key)).toEqual(web.schema.schema.map((f) => f.key));
    for (const f of web.schema.schema) {
      expect(fieldShape(field(dashboard.schema, f.key)), f.key).toEqual(fieldShape(f));
    }
  });

  it('brand-band: the dashboard adds the heading level (h2) right after the heading, and no other tag field', () => {
    const dashboard = loadDashboard()('brand-band');
    const keys = dashboard.schema.map((f) => f.key);
    expect(keys[keys.indexOf('heading') + 1]).toBe('heading_level');
    expect(keys[keys.indexOf('heading_level') + 1]).toBe('heading_accent');
    expect(field(dashboard.schema, 'heading_level')?.defaultValue).toBe('h2');
    expect(keys).not.toContain('subheading_tag');
    expect(keys).not.toContain('eyebrow_tag');
  });

  it('brand-band: same identity, page types, translatable keys and defaults', () => {
    const dashboard = loadDashboard()('brand-band');
    const web = sections['brand-band'];
    expect(dashboard.id).toBe(web.schema.id);
    expect(dashboard.category).toBe(web.schema.category);
    expect(dashboard.icon).toBe(web.schema.icon);
    expect(dashboard.pageTypes).toEqual(web.schema.pageTypes);
    expect(dashboard.chrome).toBe(web.schema.chrome);
    expect(dashboard.translatable).toEqual(web.schema.translatable);
    expect(dashboard.defaultSettings).toEqual(web.defaultSettings);
    expect(dashboard.defaultContent).toEqual(web.defaultContent);
  });

  it.each(ACCENT_SECTIONS)('%s: the heading accent pair is identical on both sides', (id) => {
    const dashboard = loadDashboard()(id);
    const web = sections[id];
    for (const key of ACCENT_KEYS) {
      const webField = field(web.schema.schema, key);
      expect(webField, `${id}.${key} (web)`).toBeTruthy();
      expect(fieldShape(field(dashboard.schema, key)), `${id}.${key}`).toEqual(fieldShape(webField));
    }
    // Settings on both sides, never a stored default.
    for (const key of ACCENT_KEYS) {
      expect(dashboard.translatable).not.toContain(key);
      expect(web.schema.translatable).not.toContain(key);
      expect(dashboard.defaultSettings ?? {}).not.toHaveProperty(key);
      expect(web.defaultSettings ?? {}).not.toHaveProperty(key);
    }
  });

  it('the classic hero banner carries the same pair as the dashboard hero-banner', () => {
    const dashboard = loadDashboard()('hero-banner');
    const classic = (classicTheme.sections as Record<string, SectionDefinition>)['hero-banner'];
    for (const key of ACCENT_KEYS) {
      expect(fieldShape(field(classic.schema.schema, key)), key).toEqual(fieldShape(field(dashboard.schema, key)));
    }
  });

  it('header-bar: compact_on_scroll is identical and sits right after sticky_mode on both sides', () => {
    const dashboard = loadDashboard()('header-bar');
    const web = sections['header-bar'];
    expect(fieldShape(field(dashboard.schema, 'compact_on_scroll'))).toEqual(
      fieldShape(field(web.schema.schema, 'compact_on_scroll')),
    );
    expect(field(web.schema.schema, 'compact_on_scroll')).toMatchObject({ type: 'boolean', defaultValue: false });
    for (const keys of [dashboard.schema.map((f) => f.key), web.schema.schema.map((f) => f.key)]) {
      expect(keys[keys.indexOf('sticky_mode') + 1]).toBe('compact_on_scroll');
    }
    expect(dashboard.defaultSettings ?? {}).not.toHaveProperty('compact_on_scroll');
    expect(web.defaultSettings ?? {}).not.toHaveProperty('compact_on_scroll');
  });
});
