// Utilities for merging theme tokens with creator customizations and converting
// them into CSS custom properties that get injected into the storefront root.

import type { CSSProperties } from 'react';
import type { ThemeCustomizations, ThemeTokens } from './types';

/**
 * Deep-merge `customizations` over `base`. Only known token shapes are merged;
 * unknown keys are ignored to keep the contract strict.
 */
export function mergeTokens(base: ThemeTokens, customizations?: ThemeCustomizations): ThemeTokens {
  if (!customizations) return base;
  return {
    colors: { ...base.colors, ...(customizations.colors || {}) },
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
