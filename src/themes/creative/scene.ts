// Scene colour themes. A scene element re-scopes the store's theme colour
// variables (css/base.css.ts), so every section, button and card inside
// follows with no code change. Three scenes derived from the store palette,
// each colour replaceable by a hex override.

import type { CSSProperties } from 'react';

export const SCENES = ['dark', 'light', 'accent'] as const;
export type Scene = (typeof SCENES)[number];

/** The stored scene as a known value; 'none', unset or junk reads as null. */
export function sceneValue(raw: unknown): Scene | null {
  return typeof raw === 'string' && (SCENES as readonly string[]).includes(raw) ? (raw as Scene) : null;
}

export interface SceneOverrides {
  bg?: unknown;
  text?: unknown;
  accent?: unknown;
}

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

function hex(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const v = raw.trim();
  return HEX.test(v) ? v : null;
}

/**
 * Attribute and inline variables of a scene element. No scene and no valid
 * override gives an empty object (no attribute, no style). An override
 * without a scene uses the 'light' scene as its base.
 */
export function sceneProps(
  scene: Scene | null,
  o?: SceneOverrides,
): { 'data-cx-scene'?: Scene; style?: CSSProperties } {
  const bg = hex(o?.bg);
  const fg = hex(o?.text);
  const ac = hex(o?.accent);
  const hasOverride = !!(bg || fg || ac);
  if (!scene && !hasOverride) return {};
  const out: { 'data-cx-scene'?: Scene; style?: CSSProperties } = { 'data-cx-scene': scene ?? 'light' };
  if (hasOverride) {
    const style: Record<string, string> = {};
    if (bg) style['--cx-bg'] = bg;
    if (fg) style['--cx-fg'] = fg;
    if (ac) style['--cx-ac'] = ac;
    out.style = style as CSSProperties;
  }
  return out;
}
