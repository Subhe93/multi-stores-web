// Content of the motion demo route (/dev/creative-demo). The route replays a
// real store home (header, home sections, footer, a story page, a listing and
// a product page) so the motion can be judged on real sections.
//
// No client content lives in the repository: the fixture is a JSON file
// OUTSIDE it. Its path comes from the environment variable
// CREATIVE_DEMO_FIXTURE or from the git-ignored file
// <project root>/creative-demo.local.json ({ "fixture": "<absolute path>" }).
// Without one (or when the file cannot be read) the neutral placeholder
// fixture of ./neutral.ts is used.
//
// Server only (reads the file system). Never imported outside the demo route.

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { NavMenu, SectionInstance, ThemeCustomizations } from '../../types';
import { NEUTRAL_FIXTURE } from './neutral';

/** One section: settings plus content per locale. */
export interface DemoSection {
  section_key: string;
  settings: Record<string, unknown>;
  content: Record<string, Record<string, unknown>>;
}

export interface DemoFixture {
  version: 1;
  name: string;
  description?: string;
  currency: string;
  primaryLocale: string;
  secondaryLocales: string[];
  logoUrl?: string;
  themeCustomizations: ThemeCustomizations;
  tax?: unknown;
  pages: Array<{ slug: string; translations: { locale: string; title: string }[] }>;
  menus: NavMenu[];
  header: DemoSection[];
  footer: DemoSection[];
  home: DemoSection[];
  story: DemoSection[];
  /** Rows of GET /storefront/:slug/products. */
  products: Array<Record<string, unknown>>;
  /** One row of GET /storefront/:slug/products/:productSlug (null = no product view). */
  product: Record<string, unknown> | null;
  /**
   * Optional collections of the filtered listing demo (rows link to them
   * with `_collections: [slug]`). Labels per locale.
   */
  collections?: Array<{ slug: string; label: Record<string, string>; parent?: string | null }>;
}

export interface LoadedFixture {
  fixture: DemoFixture;
  /** 'file' = the external JSON, 'neutral' = the built-in placeholder content. */
  source: 'file' | 'neutral';
}

const LOCAL_POINTER = 'creative-demo.local.json';

const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

function isSections(v: unknown): v is DemoSection[] {
  return (
    Array.isArray(v) &&
    v.every((s) => isRecord(s) && typeof s.section_key === 'string' && isRecord(s.settings) && isRecord(s.content))
  );
}

/** Shape check of an external fixture; anything else falls back to the neutral one. */
export function parseFixture(raw: unknown): DemoFixture | null {
  if (!isRecord(raw) || raw.version !== 1) return null;
  if (typeof raw.name !== 'string' || typeof raw.currency !== 'string') return null;
  if (!isSections(raw.home) || !isSections(raw.header) || !isSections(raw.footer)) return null;
  return {
    version: 1,
    name: raw.name,
    description: typeof raw.description === 'string' ? raw.description : undefined,
    currency: raw.currency,
    primaryLocale: typeof raw.primaryLocale === 'string' ? raw.primaryLocale : 'en',
    secondaryLocales: Array.isArray(raw.secondaryLocales) ? raw.secondaryLocales.filter((l) => typeof l === 'string') : [],
    logoUrl: typeof raw.logoUrl === 'string' && raw.logoUrl ? raw.logoUrl : undefined,
    themeCustomizations: isRecord(raw.themeCustomizations) ? (raw.themeCustomizations as ThemeCustomizations) : {},
    tax: raw.tax ?? null,
    pages: Array.isArray(raw.pages) ? (raw.pages as DemoFixture['pages']) : [],
    menus: Array.isArray(raw.menus) ? (raw.menus as NavMenu[]) : [],
    header: raw.header,
    footer: raw.footer,
    home: raw.home,
    story: isSections(raw.story) ? raw.story : [],
    products: Array.isArray(raw.products) ? raw.products.filter(isRecord) : [],
    product: isRecord(raw.product) ? raw.product : null,
    collections: Array.isArray(raw.collections)
      ? (raw.collections.filter(
          (c) => isRecord(c) && typeof c.slug === 'string' && isRecord(c.label),
        ) as DemoFixture['collections'])
      : undefined,
  };
}

async function fixturePath(): Promise<string | null> {
  const fromEnv = process.env.CREATIVE_DEMO_FIXTURE;
  if (fromEnv) return fromEnv;
  try {
    const pointer = JSON.parse(await readFile(path.join(process.cwd(), LOCAL_POINTER), 'utf8')) as unknown;
    return isRecord(pointer) && typeof pointer.fixture === 'string' && pointer.fixture ? pointer.fixture : null;
  } catch {
    return null;
  }
}

export async function loadFixture(): Promise<LoadedFixture> {
  const file = await fixturePath();
  if (file) {
    try {
      const parsed = parseFixture(JSON.parse(await readFile(file, 'utf8')));
      if (parsed) return { fixture: parsed, source: 'file' };
    } catch {
      // Unreadable or invalid: the neutral fixture below.
    }
  }
  return { fixture: NEUTRAL_FIXTURE, source: 'neutral' };
}

/** Demo sections as section instances (`prefix` keeps ids unique per area). */
export function toInstances(sections: DemoSection[], prefix: string): SectionInstance[] {
  return sections.map((s, i) => ({
    id: `${prefix}-${i + 1}`,
    section_key: s.section_key,
    settings: s.settings,
    sort_order: i,
    translations: Object.entries(s.content).map(([locale, content]) => ({ locale, content })),
  }));
}
