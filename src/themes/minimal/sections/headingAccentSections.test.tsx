import type { ComponentType } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { SectionDefinition, SectionRenderProps } from '../../types';

vi.mock('next-intl', () => ({
  useTranslations: (ns?: string) => (k: string) => (ns ? `${ns}.${k}` : k),
}));

import { minimalTheme } from '../theme';
import { classicTheme } from '../../classic/theme';
import { HEADING_ACCENT_FIELDS } from './_shared/headingAccentFields';

// The heading accent on every section that offers it: unset renders the
// section exactly as before; 'line' / 'brush' add one decorative element
// inside the heading and nothing else.

const minimal = minimalTheme.sections as Record<string, SectionDefinition>;
const classic = classicTheme.sections as Record<string, SectionDefinition>;

const ACCENT_SECTIONS = [
  'hero-banner',
  'hero-split',
  'hero-slider',
  'hero-video',
  'parallax-banner',
  'image-with-text',
  'brand-band',
];

const HEADING = 'Culture in every thread';
const TEXT = { eyebrow: 'New', heading: HEADING, subheading: 'Two lines of text.', body: 'Body text.', cta_text: 'Shop' };

interface Case {
  name: string;
  Component: ComponentType<SectionRenderProps>;
  settings: Record<string, unknown>;
  content: Record<string, unknown>;
  /** `data-align` the accent must carry. */
  align: string;
  /** Headings in the output (the slider has one per slide). */
  headings: number;
}

// The eight components (the classic theme has its own hero banner), with the
// two-variant sections in both variants.
const CASES: Case[] = [
  { name: 'hero-banner (minimal), centred', Component: minimal['hero-banner'].Component, settings: {}, content: TEXT, align: 'center', headings: 1 },
  { name: 'hero-banner (minimal), left, image background', Component: minimal['hero-banner'].Component, settings: { alignment: 'left', layout: 'image-background', image: '/uploads/hero.jpg' }, content: TEXT, align: 'left', headings: 1 },
  { name: 'hero-banner (minimal), right, side by side', Component: minimal['hero-banner'].Component, settings: { alignment: 'right', layout: 'side-by-side', image: '/uploads/hero.jpg' }, content: TEXT, align: 'right', headings: 1 },
  { name: 'hero-banner (classic)', Component: classic['hero-banner'].Component, settings: { alignment: 'left', image: '/uploads/hero.jpg' }, content: TEXT, align: 'left', headings: 1 },
  { name: 'hero-banner (classic), default alignment', Component: classic['hero-banner'].Component, settings: {}, content: TEXT, align: 'center', headings: 1 },
  { name: 'hero-split, framed', Component: minimal['hero-split'].Component, settings: { image: '/uploads/hero.jpg' }, content: TEXT, align: 'start', headings: 1 },
  { name: 'hero-split, bleed', Component: minimal['hero-split'].Component, settings: { variant: 'bleed', image: '/uploads/hero.jpg' }, content: TEXT, align: 'start', headings: 1 },
  {
    name: 'hero-slider',
    Component: minimal['hero-slider'].Component,
    settings: {},
    content: {
      slides: [
        { heading: HEADING, image: '/uploads/a.jpg', alignment: 'right' },
        { heading: HEADING, image: '/uploads/b.jpg', alignment: 'right' },
      ],
    },
    align: 'right',
    headings: 2,
  },
  { name: 'hero-video', Component: minimal['hero-video'].Component, settings: { alignment: 'left' }, content: TEXT, align: 'left', headings: 1 },
  { name: 'parallax-banner', Component: minimal['parallax-banner'].Component, settings: { image: '/uploads/p.jpg' }, content: TEXT, align: 'center', headings: 1 },
  { name: 'image-with-text, framed', Component: minimal['image-with-text'].Component, settings: { image: '/uploads/i.jpg' }, content: TEXT, align: 'start', headings: 1 },
  { name: 'image-with-text, bleed', Component: minimal['image-with-text'].Component, settings: { variant: 'bleed', image: '/uploads/i.jpg' }, content: TEXT, align: 'start', headings: 1 },
  { name: 'brand-band', Component: minimal['brand-band'].Component, settings: { image: '/uploads/b.jpg' }, content: { heading: HEADING, tagline: 'A line' }, align: 'center', headings: 1 },
];

function html({ Component, settings, content }: Case, extra: Record<string, unknown> = {}) {
  return renderToStaticMarkup(
    <Component locale="en" primaryLocale="en" storeSlug="demo" settings={{ ...settings, ...extra }} content={content} />,
  );
}

const ACCENT = /<span aria-hidden="true" class="heading-accent"[^>]*>(?:<svg[^>]*><path[^>]*><\/path><\/svg>)?<\/span>/g;

describe.each(CASES)('heading accent: $name', (c) => {
  it('unset, none, empty and unknown values render the same markup, without any accent', () => {
    const base = html(c);
    expect(base).toContain(HEADING);
    expect(base).not.toContain('heading-accent');
    expect(html(c, { heading_accent: 'none' })).toBe(base);
    expect(html(c, { heading_accent: '' })).toBe(base);
    expect(html(c, { heading_accent: 'wave' })).toBe(base);
    expect(html(c, { heading_accent: null })).toBe(base);
    // A colour alone does nothing.
    expect(html(c, { heading_accent_color: '#B60018' })).toBe(base);
    expect(html(c, { heading_accent: 'none', heading_accent_color: '#B60018' })).toBe(base);
  });

  it.each(['brush', 'line'])('%s adds exactly one accent per heading, as the last child inside it', (variant) => {
    const base = html(c);
    const out = html(c, { heading_accent: variant });
    const accents = out.match(ACCENT) ?? [];
    expect(accents).toHaveLength(c.headings);
    for (const accent of accents) {
      expect(accent).toContain(`data-variant="${variant}"`);
      expect(accent).toContain(`data-align="${c.align}"`);
      expect(accent).toContain('style="color:var(--theme-colors-accent);font-size:inherit"');
    }
    // Right after the heading text and right before the heading's end tag.
    const inside = new RegExp(`${HEADING}<span aria-hidden="true" class="heading-accent"[^>]*>(?:<svg.*?</svg>)?</span></h[1-6]>`, 'g');
    expect(out.match(inside) ?? []).toHaveLength(c.headings);
    // Nothing else changed.
    expect(out.replace(ACCENT, '')).toBe(base);
  });

  it('uses the stored accent colour', () => {
    const out = html(c, { heading_accent: 'brush', heading_accent_color: '#B60018' });
    const accents = out.match(ACCENT) ?? [];
    expect(accents).toHaveLength(c.headings);
    for (const accent of accents) expect(accent).toContain('style="color:#B60018;font-size:inherit"');
  });

  it('renders no accent without a heading', () => {
    const content = { ...c.content, heading: '', slides: [{ image: '/uploads/a.jpg', subheading: 'Only a subheading' }] };
    const out = renderToStaticMarkup(
      <c.Component locale="en" primaryLocale="en" storeSlug="demo" settings={{ ...c.settings, heading_accent: 'brush' }} content={content} />,
    );
    expect(out).not.toContain('heading-accent');
  });
});

describe('heading accent: schema', () => {
  const pair = (def: SectionDefinition) =>
    def.schema.schema
      .filter((f) => f.key === 'heading_accent' || f.key === 'heading_accent_color')
      .map((f) => ({ key: f.key, type: f.type, defaultValue: f.defaultValue, options: f.options?.map((o) => o.value), showIf: f.showIf }));

  const EXPECTED = [
    { key: 'heading_accent', type: 'select', defaultValue: 'none', options: ['none', 'line', 'brush'], showIf: undefined },
    { key: 'heading_accent_color', type: 'color', defaultValue: undefined, options: undefined, showIf: { key: 'heading_accent', in: ['line', 'brush'] } },
  ];

  it.each(ACCENT_SECTIONS)('%s declares both fields at the top level, as settings', (id) => {
    const def = minimal[id];
    expect(pair(def)).toEqual(EXPECTED);
    expect(def.schema.translatable).not.toContain('heading_accent');
    expect(def.schema.translatable).not.toContain('heading_accent_color');
    expect(def.defaultSettings ?? {}).not.toHaveProperty('heading_accent');
    expect(def.defaultSettings ?? {}).not.toHaveProperty('heading_accent_color');
    expect(def.defaultContent ?? {}).not.toHaveProperty('heading_accent');
  });

  it('the classic hero banner declares the same pair', () => {
    expect(classic['hero-banner']).not.toBe(minimal['hero-banner']);
    expect(pair(classic['hero-banner'])).toEqual(EXPECTED);
    expect(classic['hero-banner'].defaultSettings ?? {}).not.toHaveProperty('heading_accent');
  });

  it('no other section of the theme declares them', () => {
    const others = Object.entries(minimal)
      .filter(([id]) => !ACCENT_SECTIONS.includes(id))
      .filter(([, def]) => def.schema.schema.some((f) => f.key === 'heading_accent' || f.key === 'heading_accent_color'))
      .map(([id]) => id);
    expect(others).toEqual([]);
  });

  it('the shared pair is the one every section spreads', () => {
    for (const id of ACCENT_SECTIONS) {
      for (const field of HEADING_ACCENT_FIELDS) expect(minimal[id].schema.schema).toContain(field);
    }
  });
});
