import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import type { FieldDefinition } from '../types';
import { CREATIVE_SECTION_KEYS } from './constants';
import { CREATIVE_SCHEMAS } from './schemas';
import { EMBLEM_FIELDS } from '../minimal/sections/_shared/emblemFields';

// Cross-repo check: the dashboard keeps a hand-made copy of the ornament
// divider schema (section-schemas.ts). File: DASHBOARD_SCHEMAS_FILE, else the creative dashboard
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
const ready = source.includes("'ornament-line'") || source.includes('"ornament-line"');

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

// The dashboard file is transpiled and evaluated on its own (Vite does not
// serve files outside this project root). Its only runtime imports are the
// per-section schema files beside it (./creative-sections/<key>.ts), which
// are loaded the same way and have no runtime import themselves.
function transpile(code: string): string {
  return ts.transpileModule(code, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
}

function loadDashboard() {
  const exports = {} as { findSectionSchema: (id: string) => DashboardSchema | undefined };
  new Function('exports', 'require', transpile(source))(exports, (id: string) => {
    if (!/^\.\/creative-sections\/[a-z-]+\.ts$/.test(id)) throw new Error(`unexpected runtime import in ${SCHEMAS_FILE}: ${id}`);
    const file = resolve(dirname(SCHEMAS_FILE as string), id);
    const sub = {} as Record<string, unknown>;
    new Function('exports', 'require', transpile(readFileSync(file, 'utf8')))(sub, (inner: string) => {
      throw new Error(`unexpected runtime import in ${file}: ${inner}`);
    });
    return sub;
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
    // A tag key the storefront schema declares itself (cover-hero,
    // script-manifesto) is an ordinary mirrored field, not the dashboard's own.
    const declared = new Set(web.schema.schema.map((f) => f.key));
    const dashboardFields = dashboard.schema.filter((f) => declared.has(f.key) || !HEADING_TAG_KEYS.includes(f.key));
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

  // The compositions of the first draft and its per-section options are gone:
  // motion is automatic (store switch) with one per-section override in _style.
  it('the per-section heading options are not offered', () => {
    const find = loadDashboard();
    for (const id of ['hero-banner', 'hero-split', 'parallax-banner', 'image-with-text', 'brand-band', 'single-image', 'rich-text']) {
      const keys = find(id).schema.map((f) => f.key);
      for (const key of ['heading_reveal', 'heading_emphasis', 'heading_emphasis_color', 'image_reveal', 'image_reveal_direction']) {
        expect(keys, `${id}.${key}`).not.toContain(key);
      }
    }
  });

  // The optional hero emblem: the dashboard carries the same four fields as
  // the last four of hero-split and hero-banner, with six-locale texts.
  it.each(['hero-split', 'hero-banner'])('%s: the emblem fields are mirrored at the end of the schema', (id) => {
    const tail = loadDashboard()(id).schema.slice(-EMBLEM_FIELDS.length);
    expect(tail.map(fieldShape)).toEqual(EMBLEM_FIELDS.map(fieldShape));
    for (const f of tail) {
      for (const locale of LOCALES) {
        expect(f.label?.[locale]?.trim(), `${id}.${f.key} label ${locale}`).toBeTruthy();
        for (const o of f.options ?? []) expect(o.label?.[locale]?.trim(), `${id}.${f.key}.${o.value} ${locale}`).toBeTruthy();
      }
    }
  });
});
