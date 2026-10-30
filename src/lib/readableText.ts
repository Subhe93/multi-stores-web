// Text colour that stays readable on a given background (WCAG contrast).
// Store primary colours can be light (e.g. a yellow brand colour), where the
// usual white label is unreadable. Non-hex inputs (CSS variables) fall back
// to white, as before.

const DARK = '#111827';
const LIGHT = '#ffffff';

function channel(v: number): number {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(color: string): number | null {
  // rgb()/rgba() as returned by getComputedStyle.
  const rgb = color.trim().match(/^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/i);
  if (rgb) {
    const [r, g, b] = rgb.slice(1, 4).map(Number);
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
  }
  const m = color.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return null;
  const h = m[1].length === 3 ? m[1].split('').map((c) => c + c).join('') : m[1];
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** White or near-black, whichever contrasts more with `background`. */
export function readableTextOn(background: string | null | undefined): string {
  const l = background ? relativeLuminance(background) : null;
  if (l === null) return LIGHT;
  const withWhite = 1.05 / (l + 0.05);
  const withDark = (l + 0.05) / (relativeLuminance(DARK)! + 0.05);
  return withDark > withWhite ? DARK : LIGHT;
}
