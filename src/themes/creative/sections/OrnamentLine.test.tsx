import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { SectionRenderProps } from '../../types';

vi.mock('next-intl', () => ({
  useTranslations: (ns?: string) => (k: string) => (ns ? `${ns}.${k}` : k),
}));
// The island is covered by engine/core.test.tsx.
vi.mock('../engine/core', () => ({ register: () => () => {} }));

import { classTokens, physicalClasses } from '../../minimal/sections/_shared/testHelpers';
import { G } from '../css/base.css';
import { ORNAMENT_LINE_CSS } from '../css/ornamentLine.css';
import { CREATIVE_SCHEMAS } from '../schemas';
import { ornamentLineSection } from './OrnamentLine';

const OrnamentLine = ornamentLineSection.Component;

function html(props: Partial<SectionRenderProps> = {}) {
  const markup = renderToStaticMarkup(
    <OrnamentLine locale="en" primaryLocale="en" storeSlug="demo" settings={{}} content={{}} {...props} />,
  );
  // Without the hoisted <style> blocks and the flag script.
  return markup.replace(/<style[^>]*>[\s\S]*?<\/style>/g, '').replace(/<script[^>]*>[\s\S]*?<\/script>/g, '');
}

const DEFAULTS = CREATIVE_SCHEMAS['ornament-line'].defaultSettings;
const PATHS = [
  { d: 'M0 1 H120', color: 'a' },
  { d: 'M36 16 L44 24 L36 32 L28 24 Z', color: 'b' },
  { d: 'M60 24 H90 V14 H102 V20 H96', color: 'c' },
];
const count = (markup: string, re: RegExp) => (markup.match(re) || []).length;

describe('ornament-line', () => {
  it('with nothing set draws two plain rails (no motif ships with the platform)', () => {
    const out = html({ settings: { ...DEFAULTS } });
    expect(out).toContain('data-cx-section="ornament-line"');
    expect(out).toContain('data-cx-variant="divider"');
    expect(count(out, /<line\b/g)).toBe(2);
    expect(count(out, /<path\b/g)).toBe(0);
    expect(out).toContain('data-cx-behavior="draw"');
    expect(out).toContain('data-cx-draw="once"');
  });

  it('divider: repeats the tile along the line with a running index, fixed height, decorative', () => {
    const out = html({ settings: { ...DEFAULTS, paths: PATHS } });
    // 1400 px to cover / 120 = 12 tiles, 3 paths each.
    expect(count(out, /<g class="cx-ol-t"/g)).toBe(12);
    expect(count(out, /<path\b/g)).toBe(36);
    expect(out).toMatch(/class="cx-ol-t" transform="translate\(240 0\)" style="--cx-i:2"/);
    expect(out).toMatch(/class="cx-ol-band" aria-hidden="true" style="block-size:48px"/);
    expect(out).toMatch(/<svg class="cx-ol-strip" width="1440" height="48" viewBox="0 0 1440 48"/);
    expect(out).toContain('--cx-n:12');
    // Every stroke is normalised for the line-draw and carries its colour slot.
    expect(count(out, /pathLength="1"/g)).toBe(36);
    expect(out).toMatch(/d="M36 16 L44 24 L36 32 L28 24 Z" data-c="b"/);
    expect(out).toContain('--cx-ol-tw:120px');
  });

  it('full width covers a wide screen; tile size is clamped; the tile count is capped', () => {
    const full = html({ settings: { ...DEFAULTS, paths: PATHS, width: 'full' } });
    expect(count(full, /<g class="cx-ol-t"/g)).toBe(22);
    expect(full).toContain('data-cx-width="full"');
    const tiny = html({ settings: { ...DEFAULTS, paths: PATHS, tile_width: 2, tile_height: 900, width: 'full' } });
    expect(tiny).toContain('--cx-ol-tw:24px');
    expect(tiny).toContain('--cx-ol-th:120px');
    expect(count(tiny, /<g class="cx-ol-t"/g)).toBe(32);
  });

  it('never renders owner strings as markup: unsafe path data is skipped', () => {
    const out = html({
      settings: {
        ...DEFAULTS,
        paths: [
          { d: 'M0 0"/><script>alert(1)</script>', color: 'a' },
          { d: 'url(#x)', color: 'a' },
          { d: 'M0 1 H120', color: '"><img src=x>' },
        ],
      },
    });
    expect(out).not.toMatch(/<script|<img|url\(|alert/);
    expect(count(out, /<path\b/g)).toBe(12);
    expect(out).toMatch(/d="M0 1 H120" data-c="a"/);
    // At most 12 paths are read.
    const many = html({ settings: { ...DEFAULTS, tile_width: 400, paths: Array.from({ length: 20 }, () => PATHS[0]) } });
    expect(count(many, /<path\b/g)).toBe(4 * 12);
  });

  it('is a divider only: stored frame settings and texts of an older draft are ignored', () => {
    const divider = html({
      settings: { ...DEFAULTS, variant: 'frame', paths: PATHS, corner_paths: [{ d: 'M0 20 H12', color: 'a' }], scene: 'dark' },
      content: { heading: 'Title', text: 'Body', cta_text: 'More' },
    });
    expect(divider).not.toMatch(/<h2|Title|Body|More|cx-ol-corner|cx-ol-frame|data-cx-scene|<a /);
    expect(divider).toMatch(/^<div /);
    expect(divider).toContain('data-cx-variant="divider"');
  });

  it('draw "none" is static and ships no island; "scroll" is marked for the behaviour', () => {
    const none = html({ settings: { ...DEFAULTS, paths: PATHS, draw: 'none' } });
    expect(none).not.toMatch(/data-cx-behavior|data-cx-draw|data-cx-reveal|data-cx-anchor/);
    const scroll = html({ settings: { ...DEFAULTS, paths: PATHS, draw: 'scroll' } });
    expect(scroll).toContain('data-cx-draw="scroll"');
    expect(scroll).toContain('data-cx-anchor');
  });

  it('colours and stroke weight', () => {
    const out = html({
      settings: { ...DEFAULTS, paths: PATHS, color_a: '#111111', color_b: '#B60018', color_c: '#A38250', stroke: 'thin' },
    });
    expect(out).toContain('--cx-ol-ca:#111111');
    expect(out).toContain('--cx-ol-cb:#B60018');
    expect(out).toContain('--cx-ol-cc:#A38250');
    expect(out).toContain('data-cx-stroke="thin"');
  });

  it('the hidden start state exists only behind the gate and a marker set by the behaviour', () => {
    const hidden = ORNAMENT_LINE_CSS.split('}').filter((rule) => /stroke-dashoffset:(1|clamp)/.test(rule));
    expect(hidden).toHaveLength(2);
    expect(hidden[0]).toContain(`${G} [data-cx-draw="once"][data-cx-armed] .cx-ol-p`);
    expect(hidden[1]).toContain(`${G} [data-cx-draw="scroll"][data-cx-live] .cx-ol-p`);
    // In RTL the draw order runs from the other end; the motif is not mirrored.
    expect(ORNAMENT_LINE_CSS).toContain('.store-root[dir="rtl"] .cx-ol-t{--cx-k:calc(var(--cx-n,1) - 1 - var(--cx-i,0))}');
    expect(ORNAMENT_LINE_CSS).not.toMatch(/\.cx-ol-(strip|t|ft|corner)[^{]*\{[^}]*scaleX\(-1\)/);
  });

  it('Arabic: same motif, logical classes only, nothing mirrored in the markup', () => {
    const settings = { ...DEFAULTS, paths: PATHS };
    const en = html({ settings });
    const ar = html({ settings, locale: 'ar' });
    expect(physicalClasses(ar)).toEqual([]);
    expect(ar).not.toMatch(/scaleX\(-1\)|scale-x/);
    const paths = (m: string) => [...m.matchAll(/<path[^>]*\bd="([^"]*)"/g)].map((x) => x[1]);
    expect(paths(ar)).toEqual(paths(en));
    const foreign = classTokens(ar).filter((c) => !c.startsWith('cx-') && !c.startsWith('focus-visible:'));
    expect(foreign).toEqual([]);
  });

});
