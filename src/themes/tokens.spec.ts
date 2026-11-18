import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  THEME_BUTTON_SELECTORS,
  arabicBodyCss,
  buttonRadiusOrNull,
  mergeTokens,
  storePrimaryContrast,
  themeButtonCss,
  tokenArabicFamilies,
  tokenArabicFonts,
  tokenFonts,
  tokensToCssVars,
} from './tokens';
import { minimalTokens } from './minimal/tokens';
import type { ThemeCustomizations, ThemeTokens } from './types';

const DARK = '#111827';
const vars = (t: ThemeTokens) => tokensToCssVars(t) as Record<string, string>;

describe('theme contrast tokens', () => {
  it('keeps the theme contrast when the primary is untouched', () => {
    const t = mergeTokens(minimalTokens, undefined);
    expect(t.colors.primaryContrast).toBe('#ffffff');
    expect(vars(t)['--theme-colors-primaryContrast']).toBe('#ffffff');
  });

  it('computes dark text on a light custom primary (Namez yellow)', () => {
    const t = mergeTokens(minimalTokens, { colors: { primary: '#feee4a' } });
    expect(t.colors.primaryContrast).toBe(DARK);
    expect(vars(t)['--theme-colors-primaryContrast']).toBe(DARK);
  });

  it('computes white text on a dark custom primary', () => {
    const t = mergeTokens(minimalTokens, { colors: { primary: '#1e3a8a' } });
    expect(t.colors.primaryContrast).toBe('#ffffff');
  });

  it('lets an explicit contrast win; blank means automatic', () => {
    expect(mergeTokens(minimalTokens, { colors: { primary: '#feee4a', primaryContrast: '#ff0000' } }).colors.primaryContrast).toBe('#ff0000');
    expect(mergeTokens(minimalTokens, { colors: { primary: '#feee4a', primaryContrast: ' ' } }).colors.primaryContrast).toBe(DARK);
  });

  it('computes accent and secondary contrast, and supports rgb()', () => {
    const t = mergeTokens(minimalTokens, { colors: { accent: 'rgb(254, 238, 74)', secondary: '#fef3c7' } });
    expect(vars(t)['--theme-colors-accentContrast']).toBe(DARK);
    expect(vars(t)['--theme-colors-secondaryContrast']).toBe(DARK);
    // Default blue accent keeps white badge text.
    expect(vars(mergeTokens(minimalTokens, undefined))['--theme-colors-accentContrast']).toBe('#ffffff');
  });

  it('emits a price colour only when set (consumers fall back to primary)', () => {
    expect(vars(mergeTokens(minimalTokens, { colors: { primary: '#feee4a' } }))['--theme-colors-price']).toBeUndefined();
    expect(vars(mergeTokens(minimalTokens, { colors: { primary: '#feee4a', price: '#111111' } }))['--theme-colors-price']).toBe('#111111');
    expect(vars(mergeTokens(minimalTokens, { colors: { primary: '#feee4a', price: '' } }))['--theme-colors-price']).toBeUndefined();
  });

  it('blank custom colours do not wipe the theme colour', () => {
    expect(mergeTokens(minimalTokens, { colors: { primary: '' } }).colors.primary).toBe(minimalTokens.colors.primary);
  });

  it('storePrimaryContrast follows the legacy store primary', () => {
    const t = mergeTokens(minimalTokens, undefined);
    expect(storePrimaryContrast('#feee4a', t)).toBe(DARK);
    expect(storePrimaryContrast(t.colors.primary, t)).toBe('#ffffff');
    expect(storePrimaryContrast('#feee4a', t, { colors: { primaryContrast: '#222222' } })).toBe('#222222');
  });
});

describe('stored contrast that became unreadable (preset white kept on a yellow primary)', () => {
  it('is replaced by the automatic dark label', () => {
    const colors = { ...minimalTokens.colors, primary: '#feee4a', primaryContrast: '#ffffff' };
    const merged = mergeTokens(minimalTokens, { colors });
    expect(merged.colors.primaryContrast).toBe('#111827');
    expect(storePrimaryContrast('#feee4a', merged, { colors })).toBe('#111827');
  });

  it('keeps a readable explicit choice', () => {
    const colors = { ...minimalTokens.colors, primary: '#feee4a', primaryContrast: '#3a2f00' };
    expect(mergeTokens(minimalTokens, { colors }).colors.primaryContrast).toBe('#3a2f00');
  });
});

describe('price shadow token', () => {
  it('emits a hard shadow for a colour and ignores anything else', () => {
    const vars = <Record<string, string>>tokensToCssVars(mergeTokens(minimalTokens, { colors: { ...minimalTokens.colors, priceShadow: '#000000' } }));
    expect(vars['--theme-price-shadow']).toBe('0 0 1px #000000');
    const bad = <Record<string, string>>tokensToCssVars(mergeTokens(minimalTokens, { colors: { ...minimalTokens.colors, priceShadow: 'red; } body { x' } }));
    expect(bad['--theme-price-shadow']).toBeUndefined();
  });
});

describe('sale badge and price highlight tokens', () => {
  it('emits the sale colour with an automatic readable label', () => {
    const vars = <Record<string, string>>tokensToCssVars(mergeTokens(minimalTokens, { colors: { ...minimalTokens.colors, sale: '#111827' } }));
    expect(vars['--theme-colors-sale']).toBe('#111827');
    expect(vars['--theme-colors-saleContrast']).toBe('#ffffff');
  });

  it('emits a price highlight only for a plain colour', () => {
    const ok = <Record<string, string>>tokensToCssVars(mergeTokens(minimalTokens, { colors: { ...minimalTokens.colors, priceBg: '#feee4a' } }));
    expect(ok['--theme-price-bg']).toBe('#feee4a');
    expect(ok['--theme-price-pad']).toBeTruthy();
    const bad = <Record<string, string>>tokensToCssVars(mergeTokens(minimalTokens, { colors: { ...minimalTokens.colors, priceBg: 'x; } y' } }));
    expect(bad['--theme-price-bg']).toBeUndefined();
  });

  it('emits nothing when unset (other stores unchanged)', () => {
    const vars = <Record<string, string>>tokensToCssVars(mergeTokens(minimalTokens));
    expect(vars['--theme-colors-sale']).toBeUndefined();
    expect(vars['--theme-price-bg']).toBeUndefined();
  });
});

describe('swatch shape token', () => {
  it('defaults to round swatches and emits the radius variable', () => {
    expect(mergeTokens(minimalTokens, undefined).product?.swatchShape).toBe('circle');
    expect(vars(mergeTokens(minimalTokens, {}))['--theme-swatch-radius']).toBe('9999px');
  });
  it('square swatches come from the store customization; unknown values fall back', () => {
    expect(vars(mergeTokens(minimalTokens, { product: { swatchShape: 'square' } }))['--theme-swatch-radius']).toBe('0.5rem');
    expect(mergeTokens(minimalTokens, { product: { swatchShape: 'hex' as never } }).product?.swatchShape).toBe('circle');
  });
});

// ── Arabic font fallback and theme button radius (both optional) ────────

const LATIN_HEADING = minimalTokens.typography.fontFamily.heading;
const BUTTON_RULE =
  '.store-root [data-section-key="hero-banner"] a,.store-root [data-section-key="hero-split"] a,.store-root [data-section-key="image-with-text"] a,.store-root [data-section-key="call-to-action"] a,.store-root [data-section-key="newsletter-signup"] form>*{--theme-radius-full:var(--theme-radius-button);--theme-radius-sm:var(--theme-radius-button)}';

// Stored values that all mean "not set".
const UNSET_INPUTS: Array<[string, ThemeCustomizations | undefined]> = [
  ['undefined', undefined],
  ['{}', {}],
  ['fontFamilyArabic: {}', { typography: { fontFamilyArabic: {} } }],
  ["heading: ''", { typography: { fontFamilyArabic: { heading: '' } } }],
  ['heading: an unknown family', { typography: { fontFamilyArabic: { heading: 'Comic Sans' } } }],
  ['heading: the same as the Latin family', { typography: { fontFamilyArabic: { heading: LATIN_HEADING } } }],
  ['body: a wrong type', { typography: { fontFamilyArabic: { body: 12 as never } } }],
  ['fontFamilyArabic: a wrong type', { typography: { fontFamilyArabic: 'Cairo' as never } }],
  ["radius.button: ''", { spacing: { radius: { button: '' } } }],
  ["radius.button: '12'", { spacing: { radius: { button: '12' } } }],
  ['radius.button: CSS injection', { spacing: { radius: { button: '1px;}body{' } } }],
  ['radius.button: a wrong type', { spacing: { radius: { button: 8 as never } } }],
  ['radius.button: five digits', { spacing: { radius: { button: '10000px' } } }],
  ['radius.button: padded', { spacing: { radius: { button: ' 8px' } } }],
];

describe('Arabic font and button radius: unset equals unchanged', () => {
  const baseline = mergeTokens(minimalTokens, undefined);
  const baselineVars = vars(baseline);
  // The explicit-merge path builds a fresh object; `{}` is its baseline.
  const mergedBaseline = mergeTokens(minimalTokens, {});

  for (const [name, input] of UNSET_INPUTS) {
    it(`${name}: tokens and CSS variables equal those of an untouched store`, () => {
      const merged = mergeTokens(minimalTokens, input);
      expect(merged).toEqual(baseline);
      expect(merged.typography).not.toHaveProperty('fontFamilyArabic');
      expect(merged.spacing.radius).not.toHaveProperty('button');
      // Same keys in the same order, nested objects included.
      expect(JSON.stringify(merged.typography)).toBe(JSON.stringify(baseline.typography));
      expect(JSON.stringify(merged.spacing)).toBe(JSON.stringify(baseline.spacing));
      if (input) expect(JSON.stringify(merged)).toBe(JSON.stringify(mergedBaseline));
      const out = vars(merged);
      expect(out).toEqual(baselineVars);
      expect(Object.keys(out)).toEqual(Object.keys(baselineVars));
      expect(JSON.stringify(out)).toBe(JSON.stringify(baselineVars));
      expect(tokenFonts(merged)).toEqual(tokenFonts(baseline));
      expect(tokenArabicFonts(merged)).toEqual([]);
      expect(tokenArabicFamilies(merged)).toBeNull();
      expect(arabicBodyCss(merged)).toBe('');
      expect(themeButtonCss(merged)).toBe('');
    });
  }

  it('pins the font variables of an untouched store', () => {
    expect(baselineVars['--theme-font-heading']).toBe('"Playfair Display", system-ui, sans-serif');
    expect(baselineVars['--theme-font-body']).toBe('"Inter", system-ui, sans-serif');
    expect(baselineVars).not.toHaveProperty('--theme-radius-button');
    expect(Object.keys(baselineVars).at(-1)).toBe('--theme-swatch-radius');
  });

  it('tokens that skipped mergeTokens are validated again', () => {
    const raw: ThemeTokens = {
      ...minimalTokens,
      typography: { ...minimalTokens.typography, fontFamilyArabic: { heading: 'x", serif;}body{' } },
      spacing: { ...minimalTokens.spacing, radius: { ...minimalTokens.spacing.radius, button: 'calc(1px)' } },
    };
    expect(vars(raw)).toEqual(vars(minimalTokens));
    expect(tokenArabicFonts(raw)).toEqual([]);
    expect(themeButtonCss(raw)).toBe('');
  });
});

describe('Arabic font fallback token', () => {
  it('puts the Arabic family after the Latin one, per slot', () => {
    const t = mergeTokens(minimalTokens, {
      typography: { fontFamilyArabic: { heading: 'Noto Naskh Arabic', body: 'Noto Sans Arabic' } },
    });
    expect(t.typography.fontFamilyArabic).toEqual({ heading: 'Noto Naskh Arabic', body: 'Noto Sans Arabic' });
    expect(vars(t)['--theme-font-heading']).toBe('"Playfair Display", "Noto Naskh Arabic", system-ui, sans-serif');
    expect(vars(t)['--theme-font-body']).toBe('"Inter", "Noto Sans Arabic", system-ui, sans-serif');
    expect(tokenArabicFonts(t)).toEqual(['Noto Naskh Arabic', 'Noto Sans Arabic']);
    // The Latin families and their request are untouched.
    expect(t.typography.fontFamily).toEqual(minimalTokens.typography.fontFamily);
    expect(tokenFonts(t)).toEqual(['Playfair Display', 'Inter']);
    // No new variable: only the two font stacks differ.
    const base = vars(mergeTokens(minimalTokens, undefined));
    expect(Object.keys(vars(t))).toEqual(Object.keys(base));
    const changed = Object.keys(base).filter((k) => vars(t)[k] !== base[k]);
    expect(changed).toEqual(['--theme-font-heading', '--theme-font-body']);
  });

  it('one slot only: the other keeps its exact stack', () => {
    const t = mergeTokens(minimalTokens, { typography: { fontFamilyArabic: { body: ' Cairo ' } } });
    expect(t.typography.fontFamilyArabic).toEqual({ body: 'Cairo' });
    expect(vars(t)['--theme-font-heading']).toBe('"Playfair Display", system-ui, sans-serif');
    expect(vars(t)['--theme-font-body']).toBe('"Inter", "Cairo", system-ui, sans-serif');
    expect(tokenArabicFonts(t)).toEqual(['Cairo']);
  });

  it('one family for both slots is requested once', () => {
    const t = mergeTokens(minimalTokens, {
      typography: { fontFamilyArabic: { heading: 'Noto Naskh Arabic', body: 'Noto Naskh Arabic' } },
    });
    expect(tokenArabicFonts(t)).toEqual(['Noto Naskh Arabic']);
  });

  it('drops a slot whose Arabic family is its own Latin family, and invalid slots', () => {
    const t = mergeTokens(minimalTokens, {
      typography: {
        fontFamily: { heading: 'Cairo' },
        fontFamilyArabic: { heading: 'Cairo', body: 'Noto Kufi Arabic' },
      },
    });
    expect(t.typography.fontFamilyArabic).toEqual({ body: 'Noto Kufi Arabic' });
    expect(vars(t)['--theme-font-heading']).toBe('"Cairo", system-ui, sans-serif');
    const mixed = mergeTokens(minimalTokens, {
      typography: { fontFamilyArabic: { heading: 'Amiri', body: 'Markazi Text' } },
    });
    expect(mixed.typography.fontFamilyArabic).toEqual({ body: 'Markazi Text' });
    expect(vars(mixed)['--theme-font-heading']).toBe('"Playfair Display", system-ui, sans-serif');
  });
});

describe('theme button radius token', () => {
  it('emits the variable last and the re-scoping rule, only for a px value', () => {
    for (const value of ['0px', '4px', '8px', '9999px']) {
      const t = mergeTokens(minimalTokens, { spacing: { radius: { button: value } } });
      expect(t.spacing.radius.button).toBe(value);
      const out = vars(t);
      expect(out['--theme-radius-button']).toBe(value);
      expect(Object.keys(out).at(-1)).toBe('--theme-radius-button');
      expect(themeButtonCss(t)).toBe(BUTTON_RULE);
    }
  });

  it('leaves every other variable and its order as they were', () => {
    const base = vars(mergeTokens(minimalTokens, undefined));
    const out = vars(mergeTokens(minimalTokens, { spacing: { radius: { button: '0px' } } }));
    expect(Object.keys(out).slice(0, -1)).toEqual(Object.keys(base));
    for (const k of Object.keys(base)) expect(out[k], k).toBe(base[k]);
    // The sibling radius tokens are not replaced by it.
    expect(out['--theme-radius-full']).toBe('9999px');
    expect(out['--theme-radius-sm']).toBe('10px');
  });

  it('pins the selectors the rule is built from', () => {
    expect([...THEME_BUTTON_SELECTORS]).toEqual([
      '.store-root [data-section-key="hero-banner"] a',
      '.store-root [data-section-key="hero-split"] a',
      '.store-root [data-section-key="image-with-text"] a',
      '.store-root [data-section-key="call-to-action"] a',
      '.store-root [data-section-key="newsletter-signup"] form>*',
    ]);
    expect(buttonRadiusOrNull('12px')).toBe('12px');
    expect(buttonRadiusOrNull('1.5px')).toBeNull();
    expect(buttonRadiusOrNull('1rem')).toBeNull();
  });
});

// The Arabic body family on <body> itself: text outside the theme layout
// (mobile menu drawer, lightboxes, consent UI) inherits the body font.
describe('Arabic body font rule', () => {
  const withArabic = (fontFamilyArabic: Record<string, unknown>) =>
    mergeTokens(minimalTokens, { typography: { fontFamilyArabic: fontFamilyArabic as never } });

  it('is one exact rule when the body slot holds a family', () => {
    const t = withArabic({ heading: 'Noto Kufi Arabic', body: 'Noto Naskh Arabic' });
    expect(arabicBodyCss(t)).toBe(`body{font-family:'Inter',"Noto Naskh Arabic",system-ui,-apple-system,sans-serif}`);
    expect(tokenArabicFamilies(t)).toEqual({ heading: 'Noto Kufi Arabic', body: 'Noto Naskh Arabic' });
    expect(arabicBodyCss(withArabic({ body: 'Cairo' }))).toBe(
      `body{font-family:'Inter',"Cairo",system-ui,-apple-system,sans-serif}`,
    );
  });

  it('is empty without a body family: heading only, invalid, or the Latin family itself', () => {
    expect(arabicBodyCss(withArabic({ heading: 'Cairo' }))).toBe('');
    expect(tokenArabicFamilies(withArabic({ heading: 'Cairo' }))).toEqual({ heading: 'Cairo' });
    for (const body of ['', 'Comic Sans', 'x",serif}html{', minimalTokens.typography.fontFamily.body, 12, null]) {
      expect(arabicBodyCss(withArabic({ body })), String(body)).toBe('');
    }
    expect(arabicBodyCss(minimalTokens)).toBe('');
    expect(tokenArabicFamilies(minimalTokens)).toBeNull();
  });

  it('validates tokens that skipped mergeTokens', () => {
    const raw: ThemeTokens = {
      ...minimalTokens,
      typography: { ...minimalTokens.typography, fontFamilyArabic: { body: 'x", serif;}body{' } },
    };
    expect(arabicBodyCss(raw)).toBe('');
    expect(tokenArabicFamilies(raw)).toBeNull();
  });

  it('mirrors the body rule of globals.css (update arabicBodyCss when that rule changes)', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/app/globals.css'), 'utf8');
    const body = /(?:^|\n)body\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';
    const fontFamily = /font-family:\s*([^;]+);/.exec(body)?.[1]?.trim();
    expect(fontFamily).toBe("'Inter', system-ui, -apple-system, sans-serif");
    // The same stack with the Arabic family placed after its Latin font.
    const rule = arabicBodyCss(withArabic({ body: 'Cairo' }));
    expect(rule.replace('"Cairo",', '')).toBe(`body{font-family:${fontFamily!.replace(/,\s+/g, ',')}}`);
  });
});
