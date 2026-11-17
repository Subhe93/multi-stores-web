// Responsive equal-column grid driven by three CSS variables, so the column
// counts of a section need no generated class names. Breakpoints match the
// renderer: mobile below 768px, tablet 768-1023px, desktop from 1024px.

import type { CSSProperties } from 'react';

export const GRID_COLS_CLASS =
  'grid grid-cols-[repeat(var(--cols-m),minmax(0,1fr))] md:grid-cols-[repeat(var(--cols-t),minmax(0,1fr))] lg:grid-cols-[repeat(var(--cols-d),minmax(0,1fr))]';

/** A stored column count clamped to [min, max]; unset or invalid gives `fallback`. */
export function clampCols(value: unknown, fallback: number, min: number, max: number): number {
  const n = typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : fallback;
  return Math.max(min, Math.min(max, n));
}

export function gridColsStyle(desktop: number, tablet: number, mobile: number): CSSProperties {
  return { '--cols-d': desktop, '--cols-t': tablet, '--cols-m': mobile } as CSSProperties;
}

/**
 * `sizes` of an image that fills one grid cell. `mobileSlot` replaces the
 * mobile width when the cells are not a plain grid there (a scrolling row).
 */
export function gridImageSizes(desktop: number, tablet: number, mobile: number, mobileSlot?: string): string {
  const vw = (cols: number) => `${Math.ceil(100 / cols)}vw`;
  return `(max-width: 767px) ${mobileSlot || vw(mobile)}, (max-width: 1023px) ${vw(tablet)}, ${vw(desktop)}`;
}
