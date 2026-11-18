// Owner-supplied SVG path data for "ornament-line" (contract section 4.8).
// The strings come from the builder, so they are treated as untrusted: only
// path commands, digits and separators pass, and the result is only ever
// written into the `d` attribute of a <path> the section builds itself.

const PATH_DATA = /^[MmLlHhVvCcSsQqTtAaZz0-9\s,.\-]+$/;
const MAX_LENGTH = 600;

/** A path "d" string of at most 600 characters from the command set, else null. */
export function sanitizePathData(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const d = raw.trim();
  if (!d || d.length > MAX_LENGTH || !PATH_DATA.test(d)) return null;
  return d;
}

export type OrnamentColor = 'a' | 'b' | 'c';

export interface OrnamentPath {
  d: string;
  color: OrnamentColor;
}

/**
 * The stored repeater as drawable paths: at most `max` entries are read,
 * entries whose path data does not pass the sanitizer are skipped, and an
 * unknown colour reads as 'a'.
 */
export function ornamentPaths(raw: unknown, max: number): OrnamentPath[] {
  if (!Array.isArray(raw)) return [];
  const out: OrnamentPath[] = [];
  for (const item of raw.slice(0, max)) {
    if (!item || typeof item !== 'object') continue;
    const entry = item as Record<string, unknown>;
    const d = sanitizePathData(entry.d);
    if (!d) continue;
    out.push({ d, color: entry.color === 'b' || entry.color === 'c' ? entry.color : 'a' });
  }
  return out;
}
