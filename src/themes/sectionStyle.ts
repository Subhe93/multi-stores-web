// Per-section style overrides stored inside `section.settings._style`. Applied
// uniformly by the SectionRenderer (wraps each section in a wrapper + inner
// div and injects a scoped <style> block per section). Sections themselves
// remain style-agnostic — keeps the schema small and lets creators tune any
// section the same way.
//
// Two cross-cutting concerns drive the shape here:
//
//   1. Responsive — every visual property may carry per-breakpoint overrides
//      (`{ desktop, tablet, mobile }`). Resolution cascades mobile → tablet →
//      desktop via CSS source order + media queries.
//
//   2. 4-sided spacing — padding and margin are stored as
//      `{ top, right, bottom, left }`, each side independent and accepting
//      either a named token (xs/sm/md/lg/xl) or a raw pixel number ("custom").
//
// Visibility (`hide_on`) is a separate concern: a flat array of breakpoints
// where the section should not render at all (display: none).

import { resolveMediaUrl } from '@/lib/api';

export type SpaceToken = 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl';
// A side value is either a preset token or a raw pixel number ("custom").
// Numbers bypass the token table — that's the escape hatch creators asked for.
export type SpaceValue = SpaceToken | number;
export type WidthToken = 'full' | 'container' | 'narrow';
export type RadiusToken = 'none' | 'sm' | 'md' | 'lg';
export type BackgroundToken = 'transparent' | 'surface' | 'primary' | 'accent' | 'custom' | 'image';
export type Breakpoint = 'desktop' | 'tablet' | 'mobile';
export type AnimateToken = 'none' | 'fade-up' | 'fade-in';

export type Responsive<T> = T | Partial<Record<Breakpoint, T>>;

export interface SidesSpacing {
  top?: SpaceValue;
  right?: SpaceValue;
  bottom?: SpaceValue;
  left?: SpaceValue;
}

export interface SectionStyle {
  // 4-sided, responsive. Each side defaults to "unset" — sides aren't
  // forced to share a value.
  padding?: Responsive<SidesSpacing>;
  margin?: Responsive<SidesSpacing>;
  // All four below are responsive too. We make them per-breakpoint because
  // Elementor users expect to flip width, swap background, or recolor text
  // for mobile without touching desktop.
  width?: Responsive<WidthToken>;
  radius?: Responsive<RadiusToken>;
  background?: Responsive<BackgroundToken>;
  background_color?: Responsive<string>;     // honoured only when background === 'custom' at that bp
  // Background image + overlay. Honoured only when background === 'image' at the
  // breakpoint. Kept flat (not per-breakpoint): one image/overlay applies to
  // every breakpoint that selects the 'image' background — switching to another
  // background token at a narrower breakpoint clears it via the cascade.
  background_image?: string;                 // URL (relative /uploads/... or absolute)
  background_overlay_color?: string;         // hex, e.g. '#000000'
  background_overlay_opacity?: number;       // 0–100; 0 (or unset) means no overlay
  text_color?: Responsive<string>;           // empty → theme default
  // Animation runs once on mount; per-breakpoint variation has no meaningful
  // semantics (the active breakpoint is whatever the viewport is at load).
  animate?: AnimateToken;
  // Breakpoints where the section is hidden entirely (display: none).
  hide_on?: Breakpoint[];

  // ── Legacy fields (read-only fallback) ──────────────────────────────
  // The previous schema stored padding/margin as separate top/bottom tokens.
  // Existing _style documents still carry these; the resolver reads them when
  // the new `padding`/`margin` field is absent at that breakpoint. New code
  // should write `padding` / `margin` only.
  padding_top?: Responsive<SpaceToken>;
  padding_bottom?: Responsive<SpaceToken>;
  margin_top?: Responsive<SpaceToken>;
  margin_bottom?: Responsive<SpaceToken>;
}

const SPACE_PX: Record<SpaceToken, number> = {
  none: 0,
  xs: 8,
  sm: 16,
  md: 32,
  lg: 64,
  xl: 96,
};

export function spaceValueToPx(v: SpaceValue): number {
  return typeof v === 'number' ? v : SPACE_PX[v] ?? 0;
}

// Theme CSS-var references so background colors track the active theme.
const BG_VAR: Record<BackgroundToken, string | null> = {
  transparent: null,
  surface: 'var(--theme-colors-surface)',
  primary: 'var(--theme-colors-primary)',
  accent: 'var(--theme-colors-accent)',
  custom: null,
  image: null, // handled separately in appendBackgroundRules
};

const RADIUS_VAR: Record<RadiusToken, string> = {
  none: '0',
  sm: 'var(--theme-radius-sm)',
  md: 'var(--theme-radius-md)',
  lg: 'var(--theme-radius-lg)',
};

const WIDTH_PX: Record<WidthToken, string | null> = {
  full: null, // wrapper escapes via the full-bleed trick — handled inline below
  container: 'var(--theme-container-max, 1200px)',
  narrow: '720px',
};

// Storefront breakpoints — must match the dashboard's preview viewport widths.
// Desktop is the base (no media query). Tablet and mobile each emit two media
// queries: one open-ended (used by the cascade for spacing/etc.) and one
// "this device only" (used by visibility, where Elementor-style hide_on
// should not bleed across viewports).
const TABLET_DOWN_MQ = '(max-width: 1023px)';   // tablet AND mobile
const MOBILE_DOWN_MQ = '(max-width: 767px)';    // mobile only

const DESKTOP_ONLY_MQ = '(min-width: 1024px)';
const TABLET_ONLY_MQ = '(min-width: 768px) and (max-width: 1023px)';
const MOBILE_ONLY_MQ = '(max-width: 767px)';

/** Pull the value for one breakpoint out of a Responsive<T>. Bare values are
 *  treated as the desktop value (the "base"), so legacy flat data still works. */
function pick<T>(value: Responsive<T> | undefined, bp: Breakpoint): T | undefined {
  if (value === undefined) return undefined;
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return (value as Partial<Record<Breakpoint, T>>)[bp];
  }
  return bp === 'desktop' ? (value as T) : undefined;
}

export interface ResolvedSectionStyle {
  /** Scoped CSS to inject in a <style> tag next to the wrapper. */
  css: string;
  /** Whether the resolver produced any output (renderer can skip the <style>). */
  hasStyle: boolean;
}

/**
 * Build the scoped CSS string for one section. Wrapper rules target
 * `.{wrapperClass}`; inner rules target `.{wrapperClass}-i`. The SectionRenderer
 * owns the actual class names + DOM structure.
 */
export function resolveSectionStyle(
  style: SectionStyle | undefined | null,
  wrapperClass: string,
): ResolvedSectionStyle {
  const s = style || {};
  const innerClass = `${wrapperClass}-i`;
  const wrapperSel = `.${wrapperClass}`;
  const innerSel = `.${innerClass}`;

  let css = '';
  for (const bp of ['desktop', 'tablet', 'mobile'] as const) {
    const wrapperRules: string[] = [];
    const innerRules: string[] = [];

    appendSpacingRules(s, bp, wrapperRules);
    appendWidthRules(s, bp, wrapperRules, innerRules);
    appendBackgroundRules(s, bp, wrapperRules);
    appendRadiusRules(s, bp, wrapperRules);
    appendTextColorRules(s, bp, innerRules);

    if (wrapperRules.length === 0 && innerRules.length === 0) continue;

    const block =
      (wrapperRules.length ? `${wrapperSel}{${wrapperRules.join(';')}}` : '') +
      (innerRules.length ? `${innerSel}{${innerRules.join(';')}}` : '');

    if (bp === 'desktop') {
      css += block;
    } else if (bp === 'tablet') {
      css += `@media ${TABLET_DOWN_MQ}{${block}}`;
    } else {
      css += `@media ${MOBILE_DOWN_MQ}{${block}}`;
    }
  }

  // Visibility — one media query per hidden breakpoint, scoped to that device
  // only (so hiding on tablet doesn't hide on mobile too).
  if (s.hide_on?.length) {
    const seen = new Set<Breakpoint>();
    for (const bp of s.hide_on) {
      if (seen.has(bp)) continue;
      seen.add(bp);
      const mq =
        bp === 'desktop' ? DESKTOP_ONLY_MQ : bp === 'tablet' ? TABLET_ONLY_MQ : MOBILE_ONLY_MQ;
      css += `@media ${mq}{${wrapperSel}{display:none}}`;
    }
  }

  return { css, hasStyle: css.length > 0 };
}

// ── Per-property emitters ──────────────────────────────────────────────

function appendSpacingRules(s: SectionStyle, bp: Breakpoint, wrapperRules: string[]) {
  const padding = pick(s.padding, bp);
  pushSide(wrapperRules, 'padding-top', padding?.top);
  pushSide(wrapperRules, 'padding-right', padding?.right);
  pushSide(wrapperRules, 'padding-bottom', padding?.bottom);
  pushSide(wrapperRules, 'padding-left', padding?.left);

  const margin = pick(s.margin, bp);
  pushSide(wrapperRules, 'margin-top', margin?.top);
  pushSide(wrapperRules, 'margin-right', margin?.right);
  pushSide(wrapperRules, 'margin-bottom', margin?.bottom);
  pushSide(wrapperRules, 'margin-left', margin?.left);

  // Legacy fallback — only when the matching new-shape side wasn't provided.
  if (padding?.top === undefined) pushLegacy(wrapperRules, 'padding-top', pick(s.padding_top, bp), bp);
  if (padding?.bottom === undefined) pushLegacy(wrapperRules, 'padding-bottom', pick(s.padding_bottom, bp), bp);
  if (margin?.top === undefined) pushLegacy(wrapperRules, 'margin-top', pick(s.margin_top, bp), bp);
  if (margin?.bottom === undefined) pushLegacy(wrapperRules, 'margin-bottom', pick(s.margin_bottom, bp), bp);
}

function pushSide(out: string[], prop: string, val: SpaceValue | undefined) {
  if (val === undefined) return;
  out.push(`${prop}:${spaceValueToPx(val)}px`);
}

function pushLegacy(out: string[], prop: string, token: SpaceToken | undefined, bp: Breakpoint) {
  if (token === undefined) return;
  // Mirror the old "skip 'none' on desktop" optimisation so the legacy payload
  // expands exactly as it did before.
  if (bp === 'desktop' && token === 'none') return;
  out.push(`${prop}:${SPACE_PX[token]}px`);
}

function appendWidthRules(
  s: SectionStyle,
  bp: Breakpoint,
  wrapperRules: string[],
  innerRules: string[],
) {
  const width = pick(s.width, bp);
  if (width === undefined) return;
  if (width === 'full') {
    // Classic full-bleed trick: pull the wrapper out to viewport edges so the
    // section escapes the Layout's max-width container. Inner reset is needed
    // when a wider breakpoint had set inner.maxWidth via 'container'/'narrow'.
    wrapperRules.push(
      'width:100vw',
      'max-width:100vw',
      'margin-left:calc(50% - 50vw)',
      'margin-right:calc(50% - 50vw)',
    );
    innerRules.push('max-width:none', 'margin-left:0', 'margin-right:0');
  } else {
    const max = WIDTH_PX[width];
    if (max) {
      // Reset any wider-breakpoint full-bleed wrapper styles via the cascade.
      wrapperRules.push('width:auto', 'max-width:none', 'margin-left:0', 'margin-right:0');
      innerRules.push(`max-width:${max}`, 'margin-left:auto', 'margin-right:auto');
    }
  }
}

function appendBackgroundRules(s: SectionStyle, bp: Breakpoint, wrapperRules: string[]) {
  const bg = pick(s.background, bp);
  if (bg === undefined) return;

  if (bg === 'image') {
    const url = s.background_image;
    if (url) {
      // Stack a flat colour layer over the image via a 2-stop gradient — this
      // is the overlay, with no extra DOM/pseudo-element needed. Same colour
      // for both stops keeps it uniform.
      let bgImage = `url("${sanitizeCssUrl(resolveMediaUrl(url))}")`;
      const overlay = s.background_overlay_color;
      const opacity = s.background_overlay_opacity;
      if (overlay && typeof opacity === 'number' && opacity > 0) {
        const rgba = hexToRgba(overlay, Math.min(100, opacity) / 100);
        bgImage = `linear-gradient(${rgba},${rgba}),${bgImage}`;
      }
      wrapperRules.push(
        `background-image:${bgImage}`,
        'background-size:cover',
        'background-position:center',
        'background-repeat:no-repeat',
      );
    } else {
      // 'image' picked but no URL yet — clear any image inherited from a wider
      // breakpoint so the section doesn't keep painting it.
      wrapperRules.push('background-image:none');
    }
    return;
  }

  // Non-image backgrounds clear any inherited image so a narrower breakpoint can
  // override an image set on a wider one.
  wrapperRules.push('background-image:none');

  if (bg === 'transparent') {
    wrapperRules.push('background-color:transparent');
    return;
  }
  if (bg === 'custom') {
    const c = pick(s.background_color, bp);
    if (c) wrapperRules.push(`background-color:${c}`);
    return;
  }
  const v = BG_VAR[bg];
  if (v) wrapperRules.push(`background-color:${v}`);
}

// Defuse characters that would break out of the url("...") wrapper. Upload
// paths are safe already; this guards against pasted URLs with quotes/parens.
const CSS_URL_ESCAPES: Record<string, string> = {
  '"': '%22',
  "'": '%27',
  '(': '%28',
  ')': '%29',
  '\\': '%5C',
};
function sanitizeCssUrl(url: string): string {
  return url.replace(/["'()\\]/g, (c) => CSS_URL_ESCAPES[c] ?? c);
}

// Convert a #RGB / #RRGGBB hex to an rgba() string at the given alpha (0–1).
function hexToRgba(hex: string, alpha: number): string {
  let h = hex.trim().replace(/^#/, '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (h.length !== 6 || /[^0-9a-fA-F]/.test(h)) return `rgba(0,0,0,${alpha})`;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function appendRadiusRules(s: SectionStyle, bp: Breakpoint, wrapperRules: string[]) {
  const r = pick(s.radius, bp);
  if (r === undefined) return;
  if (r === 'none') {
    wrapperRules.push('border-radius:0');
    return;
  }
  wrapperRules.push(`border-radius:${RADIUS_VAR[r]}`);
}

function appendTextColorRules(s: SectionStyle, bp: Breakpoint, innerRules: string[]) {
  const c = pick(s.text_color, bp);
  if (!c) return;
  innerRules.push(`color:${c}`);
}

// ── Public helpers used by the renderer ────────────────────────────────

export function animationClass(animate: AnimateToken | undefined): string {
  // Tailwind's animation utilities cover what we need; the storefront's
  // globals.css can extend these later for richer scroll-triggered animations.
  switch (animate) {
    case 'fade-in':
      return 'motion-safe:animate-in motion-safe:fade-in motion-safe:duration-500';
    case 'fade-up':
      return 'motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4 motion-safe:duration-500';
    default:
      return '';
  }
}

/** Read style from a section's settings. */
export function readSectionStyle(
  settings: Record<string, unknown> | undefined | null,
): SectionStyle | undefined {
  if (!settings) return undefined;
  const raw = (settings as Record<string, unknown>)._style;
  if (!raw || typeof raw !== 'object') return undefined;
  return raw as SectionStyle;
}

