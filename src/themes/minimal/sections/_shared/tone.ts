// Section tone: a named background with the text colours that read on it.
// Shared by the edge-to-edge split sections and the progress spotlight.

export type Tone = 'none' | 'surface' | 'primary' | 'accent';

export interface ToneColors {
  /** Section background. */
  bg: string;
  /** Main text colour on that background. */
  text: string;
  /** Secondary text colour on that background. */
  muted: string;
  /** Small label above the heading. */
  eyebrow: string;
  /** Colour an image edge fades into (the visible background). */
  blend: string;
}

const TONES: readonly Tone[] = ['none', 'surface', 'primary', 'accent'];

/** Stored tone value; unset or unknown reads as `fallback`. */
export function toneValue(raw: unknown, fallback: Tone): Tone {
  return typeof raw === 'string' && (TONES as readonly string[]).includes(raw) ? (raw as Tone) : fallback;
}

function solid(name: 'primary' | 'accent'): ToneColors {
  const bg = `var(--theme-colors-${name})`;
  const text = `var(--theme-colors-${name}Contrast, #fff)`;
  return {
    bg,
    text,
    muted: `color-mix(in srgb, var(--theme-colors-${name}Contrast, #fff) 80%, transparent)`,
    eyebrow: text,
    blend: bg,
  };
}

/**
 * Colours of a tone. `bgOverride` (a `bg_color` setting) replaces the
 * background and the blend colour only; text colours stay those of the tone.
 */
export function toneColors(tone: Tone, bgOverride?: unknown): ToneColors {
  let colors: ToneColors;
  if (tone === 'primary' || tone === 'accent') {
    colors = solid(tone);
  } else {
    const bg = tone === 'surface' ? 'var(--theme-colors-surface)' : 'transparent';
    colors = {
      bg,
      text: 'var(--theme-colors-text)',
      muted: 'var(--theme-colors-muted)',
      eyebrow: 'var(--theme-colors-accent)',
      blend: tone === 'surface' ? bg : 'var(--theme-colors-background)',
    };
  }
  if (typeof bgOverride === 'string' && bgOverride) {
    return { ...colors, bg: bgOverride, blend: bgOverride };
  }
  return colors;
}
