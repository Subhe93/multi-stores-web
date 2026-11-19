// Colour tones of the dawn sections (hero-dawn, promise-band). Each section
// keeps a table of the exact shades its stylesheet uses, every shade tied to
// one owner colour setting (a "group") and its default. The stylesheet reads
// a shade as `rgb(var(--<prefix><name>, r g b) / alpha)`, so with nothing set
// it draws the built-in palette exactly. When the owner picks a colour, every
// shade of that group moves by the same offset (picked colour minus the
// group default) and is written as an inline variable on the section root.
//
// Pure module: safe in server components and in engine chunks.

export type Rgb = readonly [number, number, number];

export interface ToneGroup {
  /** Settings key of the owner colour. */
  setting: string;
  /** The built-in colour of the group. */
  base: Rgb;
}

/** name -> [group, built-in shade]. */
export type ToneTable = Record<string, readonly [group: string, rgb: Rgb]>;

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

/** An owner colour as RGB (3 or 6 hex digits), or null. */
export function parseHex(raw: unknown): Rgb | null {
  if (typeof raw !== 'string') return null;
  const v = raw.trim();
  if (!HEX.test(v)) return null;
  const hex = v.length === 4 ? v.slice(1).replace(/./g, (c) => c + c) : v.slice(1);
  return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
}

const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));

/** Offset of each group whose owner colour differs from its default (groups left alone are absent). */
export function groupOffsets(groups: Record<string, ToneGroup>, settings: Record<string, unknown>): Record<string, Rgb> {
  const out: Record<string, Rgb> = {};
  for (const [name, group] of Object.entries(groups)) {
    const picked = parseHex(settings[group.setting]);
    if (!picked) continue;
    const d: Rgb = [picked[0] - group.base[0], picked[1] - group.base[1], picked[2] - group.base[2]];
    if (d[0] || d[1] || d[2]) out[name] = d;
  }
  return out;
}

/** A shade moved by an offset. */
export function shift(rgb: Rgb, d: Rgb | undefined): Rgb {
  if (!d) return rgb;
  return [clamp(rgb[0] + d[0]), clamp(rgb[1] + d[1]), clamp(rgb[2] + d[2])];
}

/** Inline variables for the shades of the changed groups. */
export function toneVars(
  prefix: string,
  table: ToneTable,
  groups: Record<string, ToneGroup>,
  settings: Record<string, unknown>,
): Record<string, string> {
  const offsets = groupOffsets(groups, settings);
  const vars: Record<string, string> = {};
  for (const [name, [group, rgb]] of Object.entries(table)) {
    const d = offsets[group];
    if (d) vars[`${prefix}${name}`] = shift(rgb, d).join(' ');
  }
  return vars;
}

/** The stylesheet reference of a shade, with its built-in value as the fallback. */
export function toneRef(prefix: string, table: ToneTable, name: string, alpha = 1): string {
  const entry = table[name];
  if (!entry) throw new Error(`unknown tone ${name}`);
  const rgb = entry[1].join(' ');
  return alpha === 1 ? `rgb(var(${prefix}${name},${rgb}))` : `rgb(var(${prefix}${name},${rgb}) / ${alpha})`;
}
