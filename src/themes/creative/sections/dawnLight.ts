// Colours of the WebGL dawn light of "hero-dawn" (engine/behaviors/dawn.ts).
// The shader mixes five colours; each follows one owner colour group of the
// hero (css/heroDawn.css.ts) by the same offset as the stylesheet shades, so
// the light and the CSS fallback always agree. Pure module.

import { HD_GROUPS } from './dawnTones';
import { groupOffsets, type Rgb } from './tones';

/** Shader colours (0..1) in uniform order, with their group. */
export const LIGHT_COLORS: ReadonlyArray<readonly [name: string, group: string, rgb: Rgb]> = [
  ['uTop', 'sky', [0.04, 0.037, 0.037]],
  ['uEmber', 'warm', [0.105, 0.048, 0.034]],
  ['uHaze', 'warm', [0.22, 0.095, 0.05]],
  ['uGold', 'gold', [0.96, 0.74, 0.46]],
  ['uEmb', 'accent', [0.6, 0.12, 0.07]],
];

/** The 15 numbers of the light colours as one attribute value, or undefined when every group is built-in. */
export function lightColorsAttr(settings: Record<string, unknown>): string | undefined {
  const offsets = groupOffsets(HD_GROUPS, settings);
  if (!LIGHT_COLORS.some(([, group]) => offsets[group])) return undefined;
  const out: string[] = [];
  for (const [, group, rgb] of LIGHT_COLORS) {
    const d = offsets[group];
    for (let i = 0; i < 3; i++) {
      const v = Math.max(0, Math.min(1, rgb[i] + (d ? d[i] / 255 : 0)));
      out.push(String(+v.toFixed(4)));
    }
  }
  return out.join(' ');
}

/** Parses the attribute back into the five colours (defaults when absent or broken). */
export function readLightColors(raw: string | null): Rgb[] {
  const nums = (raw || '').trim().split(/\s+/).map(Number);
  if (nums.length === 15 && nums.every((n) => Number.isFinite(n))) {
    return LIGHT_COLORS.map((_, i) => [nums[i * 3], nums[i * 3 + 1], nums[i * 3 + 2]] as Rgb);
  }
  return LIGHT_COLORS.map(([, , rgb]) => rgb);
}
