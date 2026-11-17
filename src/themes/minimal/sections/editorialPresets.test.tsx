import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import { describe, expect, it, vi } from 'vitest';
import type { FieldDefinition, SectionDefinition } from '../../types';

vi.mock('next-intl', () => ({
  useTranslations: (ns?: string) => (k: string) => (ns ? `${ns}.${k}` : k),
}));

import { minimalTheme } from '../theme';
import { classicTheme } from '../../classic/theme';
import { boldTheme } from '../../bold/theme';
import { physicalClasses } from './_shared/testHelpers';

// Cross-repo check of the editorial section set: the dashboard copy of each
// schema and the two dashboard presets, against the storefront definitions
// and components. Reads the sibling dashboard checkout; skipped when it is
// not there (the storefront repo alone still passes).
const DASHBOARD_LIB = resolve(process.cwd(), '../multi-stores-dashboard/src/lib');
const SCHEMAS_FILE = resolve(DASHBOARD_LIB, 'section-schemas.ts');
const PRESETS_FILE = resolve(DASHBOARD_LIB, 'editorialPresets.ts');
const hasDashboard = existsSync(SCHEMAS_FILE) && existsSync(PRESETS_FILE);

// The two dashboard files have no runtime imports, so each is transpiled and
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

const NEW_SECTIONS = ['category-tiles', 'progress-spotlight', 'project-cards'];
const VARIANT_SECTIONS = ['hero-split', 'image-with-text', 'trust-badges'];
const LOCALES = ['en', 'ar', 'sv'];

// Added to every dashboard schema by its heading machinery; the storefront
// components read them from settings without declaring them.
const HEADING_TAG_KEYS = ['heading_level', 'subheading_tag', 'eyebrow_tag'];

interface DashboardSchema {
  id: string;
  translatable: string[];
  schema: FieldDefinition[];
  defaultSettings?: Record<string, unknown>;
  defaultContent?: Record<string, unknown>;
}
interface PresetSection {
  section_key: string;
  settings: Record<string, unknown>;
  content: Record<string, Record<string, unknown>>;
}
interface Preset {
  id: string;
  sections: PresetSection[];
}

const sections = minimalTheme.sections as Record<string, SectionDefinition>;

/** Key, type, option values, limits and visibility rule of each field. */
function shape(fields: FieldDefinition[]): Record<string, unknown> {
  return Object.fromEntries(
    fields
      .filter((f) => !HEADING_TAG_KEYS.includes(f.key))
      .map((f) => [
        f.key,
        {
          type: f.type,
          options: f.options?.map((o) => o.value),
          min: f.min,
          max: f.max,
          maxItems: f.maxItems,
          showIf: f.showIf,
          // Item fields compared as a set: the two sides may order them differently.
          items: f.fields
            ?.map((x) => ({ key: x.key, type: x.type, options: x.options?.map((o) => o.value) }))
            .sort((a, b) => a.key.localeCompare(b.key)),
        },
      ]),
  );
}

function loadDashboard() {
  const schemas = loadModule<{
    findSectionSchema: (id: string) => DashboardSchema | undefined;
  }>(SCHEMAS_FILE);
  const presets = loadModule<{
    buildEditorialPresets: (
      defaultsOf: (key: string) => { settings: Record<string, unknown>; content: Record<string, unknown> },
    ) => Preset[];
  }>(PRESETS_FILE);
  const find = (id: string) => {
    const found = schemas.findSectionSchema(id);
    if (!found) throw new Error(`dashboard schema missing: ${id}`);
    return found;
  };
  return {
    find,
    presets: presets.buildEditorialPresets((key) => ({
      settings: find(key).defaultSettings ?? {},
      content: find(key).defaultContent ?? {},
    })),
  };
}

function render(key: string, settings: Record<string, unknown>, content: Record<string, unknown>, locale = 'en', builderPreview = false) {
  const Component = sections[key].Component;
  return renderToStaticMarkup(
    <Component
      locale={locale}
      primaryLocale="en"
      storeSlug="demo"
      settings={settings}
      content={content}
      builderPreview={builderPreview}
    />,
  );
}

describe.skipIf(!hasDashboard)('editorial section set: dashboard and storefront agree', () => {
  it.each([...NEW_SECTIONS, ...VARIANT_SECTIONS])('%s: same fields, option values and limits on both sides', (key) => {
    const { find } = loadDashboard();
    expect(shape(sections[key].schema.schema)).toEqual(shape(find(key).schema));
  });

  it.each(NEW_SECTIONS)('%s: same translatable keys and defaults; registered in the three themes', (key) => {
    const { find } = loadDashboard();
    const dashboard = find(key);
    expect(sections[key].schema.translatable).toEqual(dashboard.translatable);
    expect(sections[key].defaultSettings).toEqual(dashboard.defaultSettings);
    expect(sections[key].defaultContent).toEqual(dashboard.defaultContent);
    expect((classicTheme.sections as Record<string, unknown>)[key]).toBeTruthy();
    expect((boldTheme.sections as Record<string, unknown>)[key]).toBeTruthy();
  });

  it('every preset section of the set renders its texts in en, ar and sv, with logical classes only', () => {
    const { presets } = loadDashboard();
    const seen = new Set<string>();
    for (const preset of presets) {
      for (const section of preset.sections) {
        if (![...NEW_SECTIONS, ...VARIANT_SECTIONS].includes(section.section_key)) continue;
        seen.add(section.section_key);
        for (const locale of LOCALES) {
          const content = section.content[locale];
          const out = render(section.section_key, section.settings, content, locale);
          const at = `${preset.id} / ${section.section_key} / ${locale}`;
          if (typeof content.heading === 'string') {
            expect(out, at).toMatch(new RegExp(`<h[12][^>]*>${content.heading}</h[12]>`));
          }
          for (const item of (content.items as Record<string, string>[] | undefined) ?? []) {
            expect(out, at).toContain(item.title ?? item.label);
          }
          expect(physicalClasses(out), at).toEqual([]);
        }
      }
    }
    expect([...seen].sort()).toEqual([...NEW_SECTIONS, ...VARIANT_SECTIONS].sort());
  });

  it.each(NEW_SECTIONS)('%s: palette defaults render the heading; no content renders nothing live and a placeholder in the builder', (key) => {
    const { find } = loadDashboard();
    const dashboard = find(key);
    const withDefaults = render(key, dashboard.defaultSettings ?? {}, dashboard.defaultContent ?? {});
    expect(withDefaults).toContain(`>${String(dashboard.defaultContent?.heading)}</h2>`);
    expect(render(key, {}, {})).toBe('');
    expect(render(key, {}, {}, 'en', true)).toContain('sections.empty.');
  });
});
