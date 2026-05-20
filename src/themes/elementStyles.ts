// Helpers for applying per-element style overrides from section settings.
// Sections expose optional `*_color` / `*_border_*` / `*_radius` knobs in the
// dashboard schema; the storefront calls these helpers to merge those
// overrides with the theme defaults so the inline style always lands a value.

import type { CSSProperties } from 'react';

/** Returns the override color if set, else the fallback (theme variable). */
export function colorOr(override: unknown, fallback: string): string {
  return typeof override === 'string' && override ? override : fallback;
}

/** Returns the override number if set (incl. 0), else the fallback. */
export function numberOr(override: unknown, fallback: number): number {
  return typeof override === 'number' && Number.isFinite(override) ? override : fallback;
}

/** Returns the override pixel string if a number override is set, else fallback. */
export function pxOr(override: unknown, fallback: string): string {
  return typeof override === 'number' && Number.isFinite(override) ? `${override}px` : fallback;
}

/**
 * Inline style for a "premium" media treatment: rounded corners + a soft,
 * slightly elevated shadow. Sections use this so product/lifestyle imagery
 * reads consistently across the storefront. Pass `rounded: false` for
 * full-bleed images that shouldn't carry a radius.
 */
export function mediaFx(opts: { rounded?: boolean; radius?: string; shadow?: string } = {}): CSSProperties {
  const { rounded = true, radius = 'var(--theme-radius-lg)', shadow = 'var(--theme-shadow-md)' } = opts;
  return {
    borderRadius: rounded ? radius : '0',
    boxShadow: rounded ? shadow : 'none',
    overflow: 'hidden',
  };
}

export interface ButtonOverrides {
  bg?: unknown;
  text?: unknown;
  borderColor?: unknown;
  borderWidth?: unknown;
  borderRadius?: unknown;
}

export interface ButtonDefaults {
  bg: string;
  text: string;
  /** Falsy for borderless defaults; pass when the theme button has a default border. */
  border?: string;
  /** Defaults to '0' (no border) when omitted. */
  borderWidth?: string;
  radius: string;
}

/**
 * Compose the inline style object for a CTA. All overrides are optional;
 * each falls back to the matching default. The border falls back to:
 *   width: borderWidth override → defaults.borderWidth → '0'
 *   color: borderColor override → defaults.border → 'transparent'
 * so a zero-width default plus an explicit color still produces a visible
 * border once the user picks any width.
 */
export function buttonStyles(overrides: ButtonOverrides, defaults: ButtonDefaults): CSSProperties {
  const borderWidth = pxOr(overrides.borderWidth, defaults.borderWidth || '0');
  const borderColor = colorOr(overrides.borderColor, defaults.border || 'transparent');
  return {
    backgroundColor: colorOr(overrides.bg, defaults.bg),
    color: colorOr(overrides.text, defaults.text),
    borderRadius: pxOr(overrides.borderRadius, defaults.radius),
    border: `${borderWidth} solid ${borderColor}`,
  };
}
