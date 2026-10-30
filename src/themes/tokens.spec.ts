import { describe, expect, it } from 'vitest';
import { mergeTokens, storePrimaryContrast, tokensToCssVars } from './tokens';
import { minimalTokens } from './minimal/tokens';
import type { ThemeTokens } from './types';

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
    expect(vars['--theme-price-shadow']).toBe('1.5px 1.5px 0 #000000');
    const bad = <Record<string, string>>tokensToCssVars(mergeTokens(minimalTokens, { colors: { ...minimalTokens.colors, priceShadow: 'red; } body { x' } }));
    expect(bad['--theme-price-shadow']).toBeUndefined();
  });
});
