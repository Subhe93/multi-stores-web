import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { motionAttrs } from './tokens';
import type { ThemeCustomizations } from './types';

const junk = (v: unknown) => v as ThemeCustomizations;

describe('motionAttrs', () => {
  it('gives no attribute for an unset store', () => {
    expect(motionAttrs()).toEqual({});
    expect(motionAttrs(undefined)).toEqual({});
    expect(motionAttrs(null)).toEqual({});
    expect(motionAttrs({})).toEqual({});
    expect(motionAttrs({ motion: {} })).toEqual({});
    expect(motionAttrs({ colors: { primary: '#000000' }, customCss: 'a{}' })).toEqual({});
  });

  it("gives no attribute for 'default'", () => {
    expect(motionAttrs({ motion: { reveal: 'default', zoom: 'default' } })).toEqual({});
  });

  it('gives no attribute for junk', () => {
    const cases: unknown[] = [
      'calm',
      5,
      true,
      null,
      [],
      ['calm'],
      { reveal: 'fast', zoom: 'big' },
      { reveal: 1, zoom: {} },
      { reveal: 'CALM' },
      // Each value belongs to the other key.
      { reveal: 'subtle', zoom: 'calm' },
    ];
    for (const motion of cases) expect(motionAttrs(junk({ motion }))).toEqual({});
    expect(motionAttrs(junk('calm'))).toEqual({});
  });

  it('maps the four real values', () => {
    expect(motionAttrs({ motion: { reveal: 'calm' } })).toEqual({ 'data-motion-reveal': 'calm' });
    expect(motionAttrs({ motion: { reveal: 'off' } })).toEqual({ 'data-motion-reveal': 'off' });
    expect(motionAttrs({ motion: { zoom: 'subtle' } })).toEqual({ 'data-motion-zoom': 'subtle' });
    expect(motionAttrs({ motion: { zoom: 'off' } })).toEqual({ 'data-motion-zoom': 'off' });
    expect(motionAttrs({ motion: { reveal: 'calm', zoom: 'subtle' } })).toEqual({
      'data-motion-reveal': 'calm',
      'data-motion-zoom': 'subtle',
    });
  });

  it('keeps the valid half when the other half is default or junk', () => {
    expect(motionAttrs({ motion: { reveal: 'default', zoom: 'off' } })).toEqual({ 'data-motion-zoom': 'off' });
    expect(motionAttrs(junk({ motion: { reveal: 'off', zoom: 'huge' } }))).toEqual({ 'data-motion-reveal': 'off' });
  });
});

describe('globals.css motion rules', () => {
  const css = readFileSync(fileURLToPath(new URL('../app/globals.css', import.meta.url)), 'utf8').replace(/\r\n/g, '\n');

  /** Body of the rule whose selector list ends with `selector`. */
  const ruleBody = (selector: string) => {
    const at = css.indexOf(`${selector} {`);
    expect(at, selector).toBeGreaterThan(-1);
    return css.slice(at, css.indexOf('}', at));
  };

  /** Every selector of every rule that mentions `needle`, comments removed. */
  const selectorsWith = (needle: string) =>
    [...css.matchAll(/([^{}]*)\{/g)]
      .map((m) => m[1].replace(/\/\*[\s\S]*?\*\//g, ''))
      .filter((list) => list.includes(needle))
      .flatMap((list) => list.split(/,\s*\n/))
      .map((s) => s.trim())
      .filter(Boolean);

  it("keeps today's values as the fallbacks of the new variables", () => {
    expect(css).toContain('[data-reveal="up"][data-reveal-state="pending"] { transform: translateY(var(--reveal-distance, 22px)); }');
    expect(css).toContain('[data-reveal="down"][data-reveal-state="pending"] { transform: translateY(calc(-1 * var(--reveal-distance, 22px))); }');
    expect(css).toContain('[data-reveal="left"][data-reveal-state="pending"] { transform: translateX(var(--reveal-distance, 22px)); }');
    expect(css).toContain('[data-reveal="right"][data-reveal-state="pending"] { transform: translateX(calc(-1 * var(--reveal-distance, 22px))); }');
    expect(css).toContain('[data-reveal="scale"][data-reveal-state="pending"] { transform: scale(var(--reveal-scale, 0.96)); }');
    expect(css).toContain('transform: translateY(var(--stagger-distance, 18px));');
    expect(css.match(/var\(--stagger-duration, 0\.55s\)/g)).toHaveLength(3);
    expect(css).toContain('var(--reveal-duration, 0.6s)');
    expect(css).toContain('var(--stagger-step, 0.08s)');
    // No literal is left behind in the reveal / stagger rules.
    expect(css).not.toMatch(/data-reveal-state="pending"\] \{ transform: translate[XY]\(-?22px\)/);
    expect(css).not.toMatch(/opacity 0\.55s/);
  });

  it('sets the variables only under the store attribute', () => {
    for (const name of ['--reveal-distance', '--reveal-scale', '--stagger-distance', '--stagger-duration']) {
      expect(css.match(new RegExp(`${name}:`, 'g')) ?? [], name).toHaveLength(1);
    }
    const calm = ruleBody('.store-root[data-motion-reveal="calm"]');
    for (const decl of [
      '--reveal-distance: 12px',
      '--reveal-duration: 0.9s',
      '--reveal-scale: 0.98',
      '--stagger-distance: 10px',
      '--stagger-duration: 0.8s',
      '--stagger-step: 0.12s',
    ]) {
      expect(calm).toContain(decl);
    }
  });

  it('"off" shows armed reveal and stagger elements at once', () => {
    expect(css).toContain('.store-root[data-motion-reveal="off"] [data-reveal][data-reveal-state],');
    const off = ruleBody('.store-root[data-motion-reveal="off"] [data-stagger-item][data-stagger-state]');
    expect(off).toContain('opacity: 1;');
    expect(off).toContain('transform: none;');
    expect(off).toContain('transition: none;');
  });

  it('every zoom selector targets media only', () => {
    const selectors = selectorsWith('data-motion-zoom');
    expect(selectors.length).toBeGreaterThanOrEqual(5);
    for (const sel of selectors) {
      expect(sel.includes(':is(img, video)') || sel.endsWith('.card-media-lift'), sel).toBe(true);
    }
    // The zoom is written with the `scale` property, as the utilities are.
    expect(css).toMatch(/data-motion-zoom="subtle"\] :is\(img, video\)\[class\*="hover:scale-"\]:hover \{\n\s*scale: 1\.03;/);
    expect(css).toMatch(/data-motion-zoom="off"\] :is\(img, video\)\[class\*="hover:scale-"\]:hover \{\n\s*scale: none;/);
  });

  it('every motion-profile rule is scoped to the store root attribute', () => {
    const selectors = [...selectorsWith('data-motion-reveal'), ...selectorsWith('data-motion-zoom')];
    expect(selectors.length).toBeGreaterThanOrEqual(9);
    for (const sel of selectors) expect(sel, sel).toMatch(/^\.store-root(\[|:is\(\[)data-motion-/);
  });
});
