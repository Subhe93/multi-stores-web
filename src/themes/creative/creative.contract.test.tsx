import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import type { FieldDefinition } from '../types';
import { CREATIVE_SECTION_KEYS, HEADING_OPTION_SECTIONS, IMAGE_REVEAL_SECTIONS } from './constants';
import { CREATIVE_SCHEMAS } from './schemas';

// Cross-repo check: the dashboard keeps a hand-made copy of the creative
// schemas (section-schemas.ts) and injects the options of the existing
// sections. File: DASHBOARD_SCHEMAS_FILE, else the creative dashboard
// worktree, else the main dashboard checkout. Skipped when no file is there
// or the file does not carry the creative schemas yet, so the storefront
// repo alone still passes.

const CANDIDATES = [
  process.env.DASHBOARD_SCHEMAS_FILE,
  resolve(process.cwd(), '../.wt-dashboard-creative/src/lib/section-schemas.ts'),
  resolve(process.cwd(), '../multi-stores-dashboard/src/lib/section-schemas.ts'),
].filter((f): f is string => !!f);

const SCHEMAS_FILE = CANDIDATES.find((f) => existsSync(f));
const source = SCHEMAS_FILE ? readFileSync(SCHEMAS_FILE, 'utf8') : '';
const ready = source.includes("'stage-scenes'") || source.includes('"stage-scenes"');

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

// The dashboard file has no runtime imports, so it is transpiled and
// evaluated on its own (Vite does not serve files outside this project root).
function loadDashboard() {
  const js = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {} as { findSectionSchema: (id: string) => DashboardSchema | undefined };
  new Function('exports', 'require', js)(exports, (id: string) => {
    throw new Error(`unexpected runtime import in ${SCHEMAS_FILE}: ${id}`);
  });
  return (id: string) => {
    const found = exports.findSectionSchema(id);
    if (!found) throw new Error(`dashboard schema missing: ${id}`);
    return found;
  };
}

// Added by the dashboard's heading machinery; the storefront components read
// them from settings without declaring them.
const HEADING_TAG_KEYS = ['heading_level', 'subheading_tag', 'eyebrow_tag'];

/** Type, default, option values, limits, visibility rule and sub-fields of one field. */
function fieldShape(f: FieldDefinition | undefined): unknown {
  if (!f) return undefined;
  return {
    key: f.key,
    type: f.type,
    defaultValue: f.defaultValue,
    options: f.options?.map((o) => o.value),
    min: f.min,
    max: f.max,
    maxLength: f.maxLength,
    maxItems: f.maxItems,
    showIf: f.showIf,
    fields: f.fields?.map(fieldShape),
  };
}

const field = (fields: FieldDefinition[], key: string) => fields.find((f) => f.key === key);

const LOCALES = ['en', 'ar', 'tr', 'de', 'fr', 'sv'];

describe.skipIf(!ready)('creative engine: dashboard and storefront agree', () => {
  it.each([...CREATIVE_SECTION_KEYS])('%s: same fields in the same order, with the same shape', (id) => {
    const dashboard = loadDashboard()(id);
    const web = CREATIVE_SCHEMAS[id];
    const dashboardFields = dashboard.schema.filter((f) => !HEADING_TAG_KEYS.includes(f.key));
    expect(dashboardFields.map((f) => f.key)).toEqual(web.schema.schema.map((f) => f.key));
    for (const f of web.schema.schema) {
      expect(fieldShape(field(dashboard.schema, f.key)), `${id}.${f.key}`).toEqual(fieldShape(f));
    }
  });

  it.each([...CREATIVE_SECTION_KEYS])('%s: same identity, page types, translatable keys and defaults', (id) => {
    const dashboard = loadDashboard()(id);
    const web = CREATIVE_SCHEMAS[id];
    expect(dashboard.id).toBe(web.schema.id);
    expect(dashboard.category).toBe(web.schema.category);
    expect(dashboard.pageTypes).toEqual(web.schema.pageTypes);
    expect(dashboard.chrome).toBe(web.schema.chrome);
    expect(dashboard.translatable).toEqual(web.schema.translatable);
    expect(dashboard.defaultSettings ?? {}).toEqual(web.defaultSettings);
    expect(dashboard.defaultContent ?? {}).toEqual(web.defaultContent);
  });

  it.each([...CREATIVE_SECTION_KEYS])('%s: dashboard labels exist in six locales', (id) => {
    const dashboard = loadDashboard()(id);
    const walk = (fields: FieldDefinition[]) => {
      for (const f of fields) {
        for (const locale of LOCALES) {
          expect(f.label?.[locale]?.trim(), `${id}.${f.key} label ${locale}`).toBeTruthy();
          for (const o of f.options ?? []) {
            expect(o.label?.[locale]?.trim(), `${id}.${f.key}.${o.value} ${locale}`).toBeTruthy();
          }
        }
        if (f.fields) walk(f.fields);
      }
    };
    walk(dashboard.schema);
  });

  it.each([...HEADING_OPTION_SECTIONS])('%s: heading reveal and emphasis options, never stored as defaults', (id) => {
    const dashboard = loadDashboard()(id);
    expect(fieldShape(field(dashboard.schema, 'heading_reveal'))).toMatchObject({
      type: 'select',
      defaultValue: 'none',
      options: ['none', 'lines'],
    });
    expect(fieldShape(field(dashboard.schema, 'heading_emphasis'))).toMatchObject({
      type: 'select',
      defaultValue: 'none',
      options: ['none', 'color', 'italic'],
    });
    expect(fieldShape(field(dashboard.schema, 'heading_emphasis_color'))).toMatchObject({
      type: 'color',
      showIf: { key: 'heading_emphasis', in: ['color', 'italic'] },
    });
    const keys = dashboard.schema.map((f) => f.key);
    expect(keys.slice(keys.indexOf('heading_accent_color') + 1, keys.indexOf('heading_accent_color') + 4)).toEqual([
      'heading_reveal',
      'heading_emphasis',
      'heading_emphasis_color',
    ]);
    for (const key of ['heading_reveal', 'heading_emphasis', 'heading_emphasis_color']) {
      expect(dashboard.translatable).not.toContain(key);
      expect(dashboard.defaultSettings ?? {}).not.toHaveProperty(key);
    }
  });

  it.each([...IMAGE_REVEAL_SECTIONS])('%s: image reveal options, never stored as defaults', (id) => {
    const dashboard = loadDashboard()(id);
    expect(fieldShape(field(dashboard.schema, 'image_reveal'))).toMatchObject({
      type: 'select',
      defaultValue: 'none',
      options: ['none', 'mask'],
    });
    expect(fieldShape(field(dashboard.schema, 'image_reveal_direction'))).toMatchObject({
      type: 'select',
      defaultValue: 'up',
      options: ['up', 'start', 'end'],
      showIf: { key: 'image_reveal', in: ['mask'] },
    });
    expect(dashboard.schema.slice(-2).map((f) => f.key)).toEqual(['image_reveal', 'image_reveal_direction']);
    for (const key of ['image_reveal', 'image_reveal_direction']) {
      expect(dashboard.translatable).not.toContain(key);
      expect(dashboard.defaultSettings ?? {}).not.toHaveProperty(key);
    }
  });

  it('sections outside the two lists carry none of the options', () => {
    const find = loadDashboard();
    for (const id of ['rich-text', 'trust-badges', 'hero-slider', 'hero-video']) {
      const keys = find(id).schema.map((f) => f.key);
      for (const key of ['heading_reveal', 'heading_emphasis', 'image_reveal']) expect(keys, `${id}.${key}`).not.toContain(key);
    }
  });
});
