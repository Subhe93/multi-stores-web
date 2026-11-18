import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('next-intl', () => ({
  useTranslations: (ns?: string) => (k: string) => (ns ? `${ns}.${k}` : k),
}));
vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useRouter: () => ({ push: vi.fn(), prefetch: vi.fn() }),
  useSelectedLayoutSegment: () => null,
}));

import { SectionRenderer } from '../../SectionRenderer';
import { minimalTheme } from '../../minimal/theme';
import type { SectionStyle } from '../../sectionStyle';
import type { SectionInstance } from '../../types';
import { G } from '../css/base.css';
import { DECOR_CSS, PARTICLE_COUNT } from '../css/decor.css';
import { Pattern, patternColor, patternKind } from './Pattern';
import { renderSectionDecor } from './sectionDecor';

const decor = (style: unknown, nested = false) => renderSectionDecor(style as SectionStyle, { nested });
const before = (style: unknown, nested = false) => renderToStaticMarkup(<>{decor(style, nested)!.before}</>);
const dom = (markup: string) => new DOMParser().parseFromString(`<main>${markup}</main>`, 'text/html');

describe('renderSectionDecor', () => {
  it('is null for unset and junk values', () => {
    expect(renderSectionDecor(undefined, { nested: false })).toBeNull();
    expect(decor({})).toBeNull();
    expect(decor({ padding: { top: 'lg' }, background: 'surface' })).toBeNull();
    expect(decor({ scene: 'none', backdrop: 'none' })).toBeNull();
    expect(decor({ scene: 'neon', backdrop: 'stars', scene_bg: 'red', backdrop_color_1: '#fff' })).toBeNull();
    expect(
      decor({ scene: '', scene_bg: '', backdrop: '', backdrop_intensity: 'medium', backdrop_motion: 'still' }),
    ).toBeNull();
    expect(decor({ scene: 3, backdrop: ['dots'] })).toBeNull();
    expect(decor('dark')).toBeNull();
  });

  it('a scene marks the wrapper, bleeds to the viewport and brings the base stylesheet', () => {
    const d = decor({ scene: 'dark' })!;
    expect(d.className).toBe('cx-scene-wrap cx-scene-bleed');
    expect(d.attrs).toEqual({ 'data-cx-scene': 'dark' });
    expect(d.style).toBeUndefined();
    const markup = before({ scene: 'dark' });
    expect(markup).toContain('cx-base');
    expect(markup).toContain('cx-decor');
    // No backdrop: no layer, no script.
    expect(markup).not.toMatch(/class="cx-bd"|<script/);
  });

  it('hex overrides become inline scene variables; anything else is ignored', () => {
    const d = decor({ scene: 'accent', scene_bg: '#B60018', scene_text: 'white', scene_accent: '#fff' })!;
    expect(d.style).toEqual({ '--cx-bg': '#B60018', '--cx-ac': '#fff' });
    // An override without a scene uses the light scene, as in CxSection.
    expect(decor({ scene_bg: '#F7F4EF' })!.attrs).toEqual({ 'data-cx-scene': 'light' });
  });

  it('a nested section does not bleed', () => {
    const d = decor({ scene: 'light', backdrop: 'glow' }, true)!;
    expect(d.className).toBe('cx-scene-wrap cx-bd-host');
    expect(decor({ scene: 'light', backdrop: 'glow' })!.className).toBe(
      'cx-scene-wrap cx-scene-bleed cx-bd-host cx-bd-bleed',
    );
  });

  it('a backdrop alone adds the layer without a scene or the base stylesheet', () => {
    const d = decor({ backdrop: 'dots' })!;
    expect(d.className).toBe('cx-bd-host cx-bd-bleed');
    expect(d.attrs).toEqual({});
    const markup = before({ backdrop: 'dots' });
    expect(markup).not.toContain('cx-base');
    expect(markup).toContain('cx-decor');
    const layer = dom(markup).querySelector('.cx-bd')!;
    expect(layer.getAttribute('data-cx-bd')).toBe('dots');
    expect(layer.getAttribute('aria-hidden')).toBe('true');
    // Soft, slow and round are the defaults: no attribute.
    expect(layer.hasAttribute('data-cx-int')).toBe(false);
    expect(layer.hasAttribute('data-cx-still')).toBe(false);
    expect(layer.hasAttribute('data-cx-loop')).toBe(true);
    // A moving backdrop opens the motion gate itself (no island).
    expect(markup).toContain('<script');
  });

  it('passes intensity, motion, particle and colours to the layer', () => {
    const markup = before({
      backdrop: 'particles',
      backdrop_intensity: 'medium',
      backdrop_motion: 'still',
      backdrop_particle: 'ring',
      backdrop_color_1: '#A38250',
      backdrop_color_2: 'url(javascript:alert(1))',
    });
    const layer = dom(markup).querySelector('.cx-bd')!;
    expect(layer.getAttribute('data-cx-int')).toBe('medium');
    expect(layer.getAttribute('data-cx-particle')).toBe('ring');
    expect(layer.hasAttribute('data-cx-still')).toBe(true);
    expect(layer.hasAttribute('data-cx-loop')).toBe(false);
    expect(layer.getAttribute('style')).toBe('--cx-bd-1:#A38250');
    expect(layer.querySelectorAll('i')).toHaveLength(PARTICLE_COUNT);
    // Still: nothing moves, so no script is needed.
    expect(markup).not.toContain('<script');
  });
});

describe('Pattern', () => {
  it('renders one decorative layer per known kind and nothing for junk', () => {
    for (const kind of ['dots', 'particles', 'glow'] as const) {
      const doc = dom(renderToStaticMarkup(<Pattern kind={kind} />));
      expect(doc.querySelectorAll('.cx-bd')).toHaveLength(1);
      expect(doc.querySelector('.cx-bd')!.getAttribute('data-cx-bd')).toBe(kind);
    }
    expect(renderToStaticMarkup(<Pattern kind={'stars' as never} />)).toBe('');
    expect(patternKind('none')).toBeNull();
  });

  it('draws at most fourteen particles and none for the other kinds', () => {
    expect(PARTICLE_COUNT).toBeLessThanOrEqual(14);
    expect(dom(renderToStaticMarkup(<Pattern kind="dots" />)).querySelectorAll('.cx-bd > *')).toHaveLength(0);
  });

  it('accepts hex colours and plain variable references only', () => {
    expect(patternColor('#fff')).toBe('#fff');
    expect(patternColor(' #A38250 ')).toBe('#A38250');
    expect(patternColor('var(--theme-colors-accent)')).toBe('var(--theme-colors-accent)');
    for (const bad of ['red', 'rgb(0,0,0)', '#12', 'var(--a);color:red', 'url(x)', '', null, 7]) {
      expect(patternColor(bad)).toBeUndefined();
    }
  });
});

describe('decor stylesheet', () => {
  const rules = DECOR_CSS.split('}').map((r) => r + '}');

  it('moves only behind the motion gate; a still backdrop never animates', () => {
    const animated = rules.filter((r) => /animation:/.test(r));
    expect(animated.length).toBeGreaterThan(0);
    for (const rule of animated) {
      expect(rule.startsWith(G), rule).toBe(true);
      expect(rule, rule).toContain(':not([data-cx-still])');
    }
    expect(DECOR_CSS).not.toContain('prefers-reduced-motion');
  });

  it('particles are hidden on phones', () => {
    expect(DECOR_CSS).toContain('@media (max-width:767px){.cx-bd[data-cx-bd="particles"]{display:none}}');
  });

  it('scene typography: plain text follows the scene above the store typography rule', () => {
    const rule = rules.find((r) => r.startsWith('.store-root .cx-scene-wrap '))!;
    expect(rule).toContain('{color:inherit}');
    // Two classes and :where() only: specificity (0,2,0), above the store
    // typography rule `.store-root main :is(p, li, span)` (0,1,2) and not
    // above the engine's own text rules.
    const selector = rule.slice(0, rule.indexOf('{'));
    expect(selector.replace(/:where\((?:[^()]|\([^()]*\))*\)/g, '')).toBe('.store-root .cx-scene-wrap ');
    // Left alone: inline colours, engine elements, white text on photos, status colours.
    for (const kept of ['[style*="color"]', '[class^="cx-"]', '[class*=" cx-"]', '[class*="text-white"]', '.store-muted']) {
      expect(selector).toContain(kept);
    }
  });

  it('the scene colour bleeds without changing the layout', () => {
    expect(DECOR_CSS).toContain('.cx-scene-bleed{box-shadow:0 0 0 100vmax var(--cx-bg);clip-path:inset(0 -100vmax)}');
    expect(DECOR_CSS).not.toMatch(/\.cx-scene-(?:wrap|bleed)\{[^}]*(?:width|inline-size|margin)/);
  });
});

describe('decor through SectionRenderer', () => {
  const section = (
    id: string,
    key: string,
    settings: Record<string, unknown>,
    content: Record<string, unknown>,
  ): SectionInstance => ({
    id,
    section_key: key,
    settings,
    sort_order: 0,
    translations: [{ locale: 'en', content }],
  });
  const page = (sections: SectionInstance[]) =>
    dom(
      renderToStaticMarkup(
        <SectionRenderer theme={minimalTheme} sections={sections} locale="en" primaryLocale="en" storeSlug="demo" />,
      ),
    );

  it('the wrapper of an existing section carries the scene and holds the layer before the section', () => {
    const doc = page([
      section('s1', 'rich-text', { _style: { scene: 'dark', scene_bg: '#111111', backdrop: 'dots' } }, {
        heading: 'About us',
        html: '<p>Hello</p>',
      }),
    ]);
    const wrapper = doc.querySelector('[data-section-key="rich-text"]')!;
    expect(wrapper.getAttribute('data-cx-scene')).toBe('dark');
    expect(wrapper.classList.contains('cx-scene-wrap')).toBe(true);
    expect(wrapper.classList.contains('cx-bd-host')).toBe(true);
    expect(wrapper.getAttribute('style')).toContain('--cx-bg:#111111');
    const layer = wrapper.querySelector(':scope > .cx-bd')!;
    const inner = wrapper.querySelector(':scope > [class$="-i"]')!;
    expect(layer.compareDocumentPosition(inner) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(inner.textContent).toContain('About us');
  });

  it('a section without scene or backdrop keeps a wrapper with no creative trace', () => {
    const doc = page([section('s1', 'rich-text', { _style: { padding: { top: 'lg' } } }, { heading: 'About us' })]);
    const wrapper = doc.querySelector('[data-section-key="rich-text"]')!;
    expect(wrapper.outerHTML).not.toMatch(/cx-|data-cx/);
  });
});
