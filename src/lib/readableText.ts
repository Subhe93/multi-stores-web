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
  // #rgb, #rgba, #rrggbb, #rrggbbaa (alpha ignored).
  const m = color.trim().match(/^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i);
  if (!m) return null;
  const h = m[1].length <= 4 ? m[1].slice(0, 3).split('').map((c) => c + c).join('') : m[1].slice(0, 6);
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** WCAG contrast ratio of two colours, or null when either can't be parsed. */
export function contrastRatio(a: string, b: string): number | null {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  if (la === null || lb === null) return null;
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** Text on a background below this ratio is unreadable (e.g. white on yellow, 1.19). */
const UNREADABLE_RATIO = 2;

export function isUnreadable(text: string, background: string): boolean {
  const r = contrastRatio(text, background);
  return r !== null && r < UNREADABLE_RATIO;
}

/**
 * Label colour on `background`: near-black only on clearly light colours
 * (yellows, pastels, white), white otherwise — so medium brand colours keep
 * the white labels they always had. Non-parsable values fall back to white.
 */
export function readableTextOn(background: string | null | undefined): string {
  const l = background ? relativeLuminance(background) : null;
  if (l === null) return LIGHT;
  return l > 0.5 ? DARK : LIGHT;
}
