// Utilities for merging theme tokens with creator customizations and converting
// them into CSS custom properties that get injected into the storefront root.

import type { CSSProperties } from 'react';
import type { ColorTokens, ThemeCustomizations, ThemeTokens } from './types';
import { isUnreadable, readableTextOn } from '@/lib/readableText';

type ContrastKey = 'primaryContrast' | 'secondaryContrast' | 'accentContrast';
const CONTRAST_PAIRS: [ContrastKey, 'primary' | 'secondary' | 'accent'][] = [
  ['primaryContrast', 'primary'],
  ['secondaryContrast', 'secondary'],
  ['accentContrast', 'accent'],
];

const filled = (v: unknown): v is string => typeof v === 'string' && v.trim() !== '';

/**
 * Merge colours and resolve the text-on-colour tokens. A contrast colour the
 * store set explicitly always wins; otherwise the theme's own value is kept
 * while its background is untouched, and a customised background gets a
 * computed readable colour (dark on light, white on dark).
 */
export function mergeColors(base: ColorTokens, custom?: Partial<ColorTokens>): ColorTokens {
  const colors: ColorTokens = { ...base };
  // Blank strings mean "automatic" / "not set".
  for (const [k, v] of Object.entries(custom || {})) {
    if (filled(v)) (colors as unknown as Record<string, string>)[k] = v;
  }
  for (const [contrastKey, bgKey] of CONTRAST_PAIRS) {
    const explicit = custom?.[contrastKey];
    if (filled(explicit) && !isUnreadable(explicit, colors[bgKey])) continue;
    const bgCustomised = filled(custom?.[bgKey]) && custom![bgKey] !== base[bgKey];
    const themeValue = base[contrastKey];
    colors[contrastKey] =
      !bgCustomised && filled(themeValue) && !isUnreadable(themeValue, colors[bgKey])
        ? themeValue
        : readableTextOn(colors[bgKey]);
  }
  return colors;
}

/**
 * Text colour for the legacy `--store-primary` fill, which may differ from the
 * token primary (store.theme.primaryColor). An explicit primaryContrast wins.
 */
export function storePrimaryContrast(
  storePrimary: string,
  tokens: ThemeTokens,
  customizations?: ThemeCustomizations,
): string {
  // Explicit / theme values win only while still readable on this fill.
  const explicit = customizations?.colors?.primaryContrast;
  if (filled(explicit) && !isUnreadable(explicit, storePrimary)) return explicit;
  const themeValue = tokens.colors.primaryContrast;
  if (storePrimary === tokens.colors.primary && filled(themeValue) && !isUnreadable(themeValue, storePrimary)) {
    return themeValue;
  }
  return readableTextOn(storePrimary);
}

/**
 * Deep-merge `customizations` over `base`. Only known token shapes are merged;
 * unknown keys are ignored to keep the contract strict.
 */
export function mergeTokens(base: ThemeTokens, customizations?: ThemeCustomizations): ThemeTokens {
  if (!customizations) return { ...base, colors: mergeColors(base.colors) };
  return {
    colors: mergeColors(base.colors, customizations.colors),
    typography: {
      fontFamily: { ...base.typography.fontFamily, ...(customizations.typography?.fontFamily || {}) },
      scale: { ...base.typography.scale, ...(customizations.typography?.scale || {}) },
      lineHeight: { ...base.typography.lineHeight, ...(customizations.typography?.lineHeight || {}) },
      fontWeight: { ...base.typography.fontWeight, ...(customizations.typography?.fontWeight || {}) },
    },
    spacing: {
      radius: { ...base.spacing.radius, ...(customizations.spacing?.radius || {}) },
      shadow: { ...base.spacing.shadow, ...(customizations.spacing?.shadow || {}) },
      containerMaxWidth: customizations.spacing?.containerMaxWidth ?? base.spacing.containerMaxWidth,
    },
  };
}

/**
 * Flatten resolved tokens into a `style` object of CSS custom properties.
 * Naming convention: `--theme-<group>-<key>` so theme components reference them
 * consistently (e.g. `var(--theme-colors-primary)`).
 */
// Turn a fixed rem heading size into a fluid clamp() so large headings scale
// down gracefully on small screens without a media query in every section.
// max = the token value; min ≈ 64% of it; preferred grows with viewport width.
function fluidRem(rem: number): string {
  const max = rem;
  const min = Math.max(1, +(rem * 0.64).toFixed(3));
  const base = +(rem * 0.5).toFixed(3);
  return `clamp(${min}rem, ${base}rem + 2.2vw, ${max}rem)`;
}

export function tokensToCssVars(tokens: ThemeTokens): CSSProperties {
  const vars: Record<string, string> = {
    '--theme-colors-primary': tokens.colors.primary,
    '--theme-colors-secondary': tokens.colors.secondary,
    '--theme-colors-accent': tokens.colors.accent,
    '--theme-colors-background': tokens.colors.background,
    '--theme-colors-surface': tokens.colors.surface,
    '--theme-colors-text': tokens.colors.text,
    '--theme-colors-muted': tokens.colors.muted,
    '--theme-colors-border': tokens.colors.border,
    // Text on primary/secondary/accent fills; fall back to a computed colour
    // when tokens did not go through mergeTokens.
    '--theme-colors-primaryContrast': tokens.colors.primaryContrast || readableTextOn(tokens.colors.primary),
    '--theme-colors-secondaryContrast': tokens.colors.secondaryContrast || readableTextOn(tokens.colors.secondary),
    '--theme-colors-accentContrast': tokens.colors.accentContrast || readableTextOn(tokens.colors.accent),
    '--theme-font-heading': `"${tokens.typography.fontFamily.heading}", system-ui, sans-serif`,
    '--theme-font-body': `"${tokens.typography.fontFamily.body}", system-ui, sans-serif`,
    '--theme-scale-h1': fluidRem(tokens.typography.scale.h1),
    '--theme-scale-h2': fluidRem(tokens.typography.scale.h2),
    '--theme-scale-h3': fluidRem(tokens.typography.scale.h3),
    '--theme-scale-h4': `${tokens.typography.scale.h4}rem`,
    '--theme-scale-h5': `${tokens.typography.scale.h5}rem`,
    '--theme-scale-h6': `${tokens.typography.scale.h6}rem`,
    '--theme-scale-body': `${tokens.typography.scale.body}rem`,
    '--theme-scale-small': `${tokens.typography.scale.small}rem`,
    '--theme-line-heading': String(tokens.typography.lineHeight.heading),
    '--theme-line-body': String(tokens.typography.lineHeight.body),
    '--theme-weight-heading': String(tokens.typography.fontWeight.heading),
    '--theme-weight-body': String(tokens.typography.fontWeight.body),
    '--theme-weight-bold': String(tokens.typography.fontWeight.bold),
    // Tighter tracking pairs with the larger headline scale for a premium feel.
    '--theme-tracking-heading': '-0.02em',
    '--theme-radius-sm': tokens.spacing.radius.sm,
    '--theme-radius-md': tokens.spacing.radius.md,
    '--theme-radius-lg': tokens.spacing.radius.lg,
    '--theme-radius-full': tokens.spacing.radius.full,
    '--theme-shadow-sm': tokens.spacing.shadow.sm,
    '--theme-shadow-md': tokens.spacing.shadow.md,
    '--theme-shadow-lg': tokens.spacing.shadow.lg,
    '--theme-container-max': tokens.spacing.containerMaxWidth,
  };
  // Price colour only when set: consumers fall back to their own primary
  // (`var(--theme-colors-price, var(--theme-colors-primary))`).
  if (tokens.colors.price) vars['--theme-colors-price'] = tokens.colors.price;
  // Text links (fallback: the price colour, then primary).
  if (tokens.colors.link) vars['--theme-colors-link'] = tokens.colors.link;
  return vars as CSSProperties;
}

/**
 * Returns the unique set of Google Fonts referenced by a token set so the
 * storefront layout can inject a single Google Fonts <link>.
 */
export function tokenFonts(tokens: ThemeTokens): string[] {
  return Array.from(new Set([
    tokens.typography.fontFamily.heading,
    tokens.typography.fontFamily.body,
  ]));
}
