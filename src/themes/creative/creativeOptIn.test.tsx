import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next-intl', () => ({
  useTranslations: (ns?: string) => (k: string) => (ns ? `${ns}.${k}` : k),
}));
vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useRouter: () => ({ push: vi.fn(), prefetch: vi.fn() }),
  useSelectedLayoutSegment: () => null,
}));

import { SectionRenderer, shouldReveal } from '../SectionRenderer';
import { minimalTheme } from '../minimal/theme';
import { classicTheme } from '../classic/theme';
import { boldTheme } from '../bold/theme';
import type { SectionInstance, ThemeCustomizations } from '../types';
import { CREATIVE_SECTION_KEYS } from './constants';
import { creativeAttrs, readCreative } from './creativeAttrs';
import { CREATIVE_SCHEMAS } from './schemas';

// The opt-in rule of the creative engine: a store that does not switch it on
// and does not place a creative section, option or scene renders exactly the
// markup it rendered before the engine existed, with no creative CSS, script
// or island. (Byte-for-byte equality with the pre-nesting renderer is covered
// by SectionRenderer.test.tsx; the per-section snapshots stay untouched.)

const section = (
  id: string,
  section_key: string,
  settings: Record<string, unknown>,
  content: Record<string, unknown>,
): SectionInstance => ({
  id,
  section_key,
  settings,
  sort_order: Number(id.replace(/\D/g, '')) || 0,
  translations: [{ locale: 'en', content }],
});

// A typical stored page: static sections only (no client data fetching).
const STORED_PAGE: SectionInstance[] = [
  section('s1', 'hero-banner', { layout: 'centered', alignment: 'center' }, {
    heading: 'Welcome to *our* store',
    subheading: 'Discover our latest collection',
    cta_text: 'Shop now',
  }),
  section('s2', 'rich-text', {}, { heading: 'About us', body: '<p>Hello</p>' }),
  section('s3', 'image-with-text', { image: '/uploads/a.jpg' }, { heading: 'Made by hand', text: 'Text' }),
  section('s4', 'brand-band', { image: '/uploads/b.jpg' }, { heading: 'Our brand', tagline: 'A line' }),
  section('s5', 'trust-badges', { layout: 'cards' }, { items: [{ icon: 'shield', label: 'Secure payment' }] }),
];

function renderPage(sections: SectionInstance[], theme = minimalTheme) {
  return renderToStaticMarkup(
    <SectionRenderer theme={theme} sections={sections} locale="en" primaryLocale="en" storeSlug="demo" />,
  );
}

const CREATIVE_TRACES = [/data-cx-/, /class="[^"]*\bcx-/, /<script/, /cx-base/, /--cx-/, /data-creative/];

describe('creative engine is opt-in', () => {
  it('a stored non-creative page carries no creative markup, CSS, script or island', () => {
    const html = renderPage(STORED_PAGE);
    expect(html).toContain('Welcome to *our* store');
    for (const trace of CREATIVE_TRACES) expect(html).not.toMatch(trace);
  });

  it('the same holds in the classic and bold themes', () => {
    for (const theme of [classicTheme, boldTheme]) {
      const html = renderPage(STORED_PAGE, theme);
      for (const trace of CREATIVE_TRACES) expect(html, theme.key).not.toMatch(trace);
    }
  });

  it('_style without a scene or a backdrop adds no element, class or attribute', () => {
    const plain = STORED_PAGE.map((s) => ({
      ...s,
      settings: { ...s.settings, _style: { padding: { top: 'lg', bottom: 'lg' }, background: 'surface' } },
    }));
    const withUnsetDecor = STORED_PAGE.map((s) => ({
      ...s,
      settings: {
        ...s.settings,
        _style: {
          padding: { top: 'lg', bottom: 'lg' },
          background: 'surface',
          scene: 'none',
          scene_bg: '',
          backdrop: 'none',
          backdrop_color_1: '',
        },
      },
    }));
    const a = renderPage(plain);
    const b = renderPage(withUnsetDecor);
    expect(b).toBe(a);
    for (const trace of CREATIVE_TRACES) expect(a).not.toMatch(trace);
  });

  it('chrome sections never get the decor hook', () => {
    const html = renderToStaticMarkup(
      <SectionRenderer
        theme={minimalTheme}
        sections={[
          section('c1', 'brand-band', { image: '/uploads/b.jpg', _style: { scene: 'dark', backdrop: 'dots' } }, {
            heading: 'Our brand',
          }),
        ]}
        locale="en"
        primaryLocale="en"
        storeSlug="demo"
        chrome
        collapseWrappers={false}
      />,
    );
    expect(html).not.toMatch(/data-cx-scene|cx-scene-wrap|cx-bd/);
  });

  it('root attributes are absent without the switch', () => {
    const unset: Array<ThemeCustomizations | null | undefined> = [
      undefined,
      null,
      {},
      { motion: { reveal: 'calm', zoom: 'subtle' } },
      { colors: { primary: '#000000' } },
    ];
    for (const c of unset) {
      expect(readCreative(c)).toBeNull();
      expect(Object.keys(creativeAttrs(c))).toHaveLength(0);
    }
  });
});

describe('creative sections are registered', () => {
  it('the ornament divider exists in the minimal theme, built on the frozen schema', () => {
    for (const key of CREATIVE_SECTION_KEYS) {
      const def = minimalTheme.sections[key];
      expect(def, key).toBeTruthy();
      expect(def.schema, key).toBe(CREATIVE_SCHEMAS[key].schema);
      expect(def.defaultSettings, key).toBe(CREATIVE_SCHEMAS[key].defaultSettings);
      expect(def.defaultContent, key).toBe(CREATIVE_SCHEMAS[key].defaultContent);
      expect(def.needsBuilderPreview, key).toBe(true);
      expect(def.Component, key).toBeTruthy();
    }
  });

  it('classic and bold inherit them', () => {
    for (const theme of [classicTheme, boldTheme]) {
      for (const key of CREATIVE_SECTION_KEYS) expect(theme.sections[key], `${theme.key}.${key}`).toBeTruthy();
    }
  });

  it('none of them gets the generic scroll-in wrapper (its transform would break sticky stages)', () => {
    for (const key of CREATIVE_SECTION_KEYS) expect(shouldReveal(key, false), key).toBe(false);
  });

  it('a section with nothing set renders nothing on the live store and a placeholder in the builder', () => {
    for (const key of ['hero-outline', 'hero-sunrise', 'stage-scenes', 'story-pinned', 'sticky-steps', 'motion-path', 'marquee-band'] as const) {
      const empty = [section('e1', key, { ...CREATIVE_SCHEMAS[key].defaultSettings }, {})];
      const live = renderToStaticMarkup(
        <SectionRenderer theme={minimalTheme} sections={empty} locale="en" primaryLocale="en" storeSlug="demo" />,
      );
      expect(live, key).not.toMatch(/data-cx-section|<script/);
      const builder = renderToStaticMarkup(
        <SectionRenderer
          theme={minimalTheme}
          sections={empty}
          locale="en"
          primaryLocale="en"
          storeSlug="demo"
          builderPreview
        />,
      );
      expect(builder, key).toContain(`data-cx-empty="${key}"`);
    }
  });
});
