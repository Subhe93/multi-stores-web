// STUB (owner: B4). Sanitizer of owner-supplied SVG path data for
// ornament-line, see the contract section 4.8. Final signature; the stub
// already applies the allow-list so nothing unsafe can pass through it.

const PATH_DATA = /^[MmLlHhVvCcSsQqTtAaZz0-9\s,.\-]+$/;

/** A path "d" string of at most 600 characters from the command set, else null. */
export function sanitizePathData(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const d = raw.trim();
  if (!d || d.length > 600 || !PATH_DATA.test(d)) return null;
  return d;
}
