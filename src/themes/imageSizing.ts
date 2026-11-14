// Image sizing model shared by image blocks (the `single-image` section and
// the `image` block of `layout-columns`). Stored under one settings key,
// `image_size`, edited in the dashboard by the `imageSize` field type.
// Spec: plans/image-sizing/SPEC.md.
//
// Shape follows section `_style` (./sectionStyle.ts): every per-breakpoint
// property is a `Responsive<T>` — a bare value is the desktop value, or an
// object `{ desktop, tablet, mobile }`. Narrower breakpoints inherit from the
// wider one when empty (mobile → tablet → desktop).
//
// DOM contract for a section that uses this helper:
//
//   <style>{css}</style>
//   <div class="{scope}">                    ← frame: width, max-width, alignment
//     <img class="{scope}-img" … />          ← height / aspect-ratio / object-fit
//   </div>
//
// The <img> is an in-flow next/image (width/height props, never `fill`) or,
// when `natural` is true, a plain <img> with a single optimizer rendition (see
// ResolvedImageSizing.natural). Rounded corners / overflow stay with the caller.
//
// Pure module: no React, no DOM, no '@/lib/api' — unit-tested in node.

import type { Breakpoint, Responsive } from './sectionStyle';

export type ImageWidthMode = 'auto' | 'full' | 'px' | 'percent';
export type ImageHeightMode = 'auto' | 'px' | 'ratio';
export type ImageRatio = '1:1' | '4:5' | '3:4' | '2:3' | '9:16' | '4:3' | '3:2' | '16:9' | '21:9';
export type ImageFit = 'cover' | 'contain';
export type ImagePosition = 'center' | 'top' | 'bottom' | 'left' | 'right';
export type ImageAlign = 'start' | 'center' | 'end';

export interface ImageSizeSettings {
  // Per breakpoint.
  width_mode?: Responsive<ImageWidthMode>;
  width_px?: Responsive<number>;        // honoured when width_mode === 'px'
  width_percent?: Responsive<number>;   // honoured when width_mode === 'percent'
  height_mode?: Responsive<ImageHeightMode>;
  height_px?: Responsive<number>;       // honoured when height_mode === 'px'
  ratio?: Responsive<ImageRatio>;       // honoured when height_mode === 'ratio'
  align?: Responsive<ImageAlign>;
  // Flat (all breakpoints).
  max_width_px?: number;
  fit?: ImageFit;                       // honoured when the height is fixed (px / ratio)
  position?: ImagePosition;             // object-position, with fit === 'cover'
}

export const IMAGE_RATIOS: readonly ImageRatio[] = ['1:1', '4:5', '3:4', '2:3', '9:16', '4:3', '3:2', '16:9', '21:9'];
const WIDTH_MODES: readonly ImageWidthMode[] = ['auto', 'full', 'px', 'percent'];
const HEIGHT_MODES: readonly ImageHeightMode[] = ['auto', 'px', 'ratio'];
const ALIGNS: readonly ImageAlign[] = ['start', 'center', 'end'];
const POSITIONS: readonly ImagePosition[] = ['center', 'top', 'bottom', 'left', 'right'];

// Clamp ranges (also the dashboard input min/max).
export const IMAGE_SIZE_LIMITS = {
  width_px: { min: 16, max: 2400 },
  width_percent: { min: 1, max: 100 },
  height_px: { min: 16, max: 2400 },
  max_width_px: { min: 16, max: 4000 },
} as const;

// Defaults when a property is empty at every breakpoint.
export const IMAGE_SIZE_DEFAULTS = {
  width_mode: 'full',
  width_px: 400,
  width_percent: 100,
  height_mode: 'auto',
  height_px: 400,
  ratio: '1:1',
  align: 'start',
  fit: 'cover',
  position: 'center',
} as const;

// Same breakpoints as sectionStyle.ts / the dashboard preview viewports.
const TABLET_DOWN_MQ = '(max-width: 1023px)';
const MOBILE_DOWN_MQ = '(max-width: 767px)';
const BREAKPOINTS: readonly Breakpoint[] = ['desktop', 'tablet', 'mobile'];

const PER_BP_KEYS = ['width_mode', 'width_px', 'width_percent', 'height_mode', 'height_px', 'ratio', 'align'] as const;
const FLAT_KEYS = ['max_width_px', 'fit', 'position'] as const;

const POSITION_CSS: Record<ImagePosition, string> = {
  center: 'center',
  top: 'center top',
  bottom: 'center bottom',
  // Physical on purpose: the focal point of a picture does not flip in RTL.
  left: 'left center',
  right: 'right center',
};

const ALIGN_CSS: Record<ImageAlign, [start: string, end: string]> = {
  start: ['0', 'auto'],
  center: ['auto', 'auto'],
  end: ['auto', '0'],
};

/** Value of a Responsive<T> at exactly one breakpoint (no inheritance). */
function own<T>(value: Responsive<T> | undefined, bp: Breakpoint): T | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'object' && !Array.isArray(value)) {
    const v = (value as Partial<Record<Breakpoint, T>>)[bp];
    return v === null || (v as unknown) === '' ? undefined : v;
  }
  return bp === 'desktop' && (value as unknown) !== '' ? (value as T) : undefined;
}

/** Value with the mobile → tablet → desktop cascade applied. */
export function cascade<T>(value: Responsive<T> | undefined, bp: Breakpoint): T | undefined {
  const chain: Breakpoint[] =
    bp === 'mobile' ? ['mobile', 'tablet', 'desktop'] : bp === 'tablet' ? ['tablet', 'desktop'] : ['desktop'];
  for (const b of chain) {
    const v = own(value, b);
    if (v !== undefined) return v;
  }
  return undefined;
}

function oneOf<T extends string>(v: unknown, allowed: readonly T[]): T | undefined {
  return typeof v === 'string' && (allowed as readonly string[]).includes(v) ? (v as T) : undefined;
}

/** Numbers may arrive as strings from form inputs; clamp to the given range. */
function num(v: unknown, range: { min: number; max: number }): number | undefined {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return Math.min(range.max, Math.max(range.min, Math.round(n)));
}

function isDefined(v: unknown): boolean {
  return v !== undefined && v !== null && v !== '';
}

/**
 * True when `value` carries at least one image-size setting. Sections keep
 * their legacy render path (byte-identical output) when this is false.
 */
export function hasImageSize(value: unknown): value is ImageSizeSettings {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  for (const k of FLAT_KEYS) if (isDefined(v[k])) return true;
  for (const k of PER_BP_KEYS) {
    const x = v[k];
    if (x && typeof x === 'object' && !Array.isArray(x)) {
      if (BREAKPOINTS.some((bp) => isDefined((x as Record<string, unknown>)[bp]))) return true;
    } else if (isDefined(x)) {
      return true;
    }
  }
  return false;
}

/** Fully resolved settings at one breakpoint. */
export interface ImageSizeAt {
  width: { mode: 'auto' | 'full' } | { mode: 'px'; px: number } | { mode: 'percent'; percent: number };
  height: { mode: 'auto' } | { mode: 'px'; px: number } | { mode: 'ratio'; ratio: ImageRatio };
  align: ImageAlign;
}

/** Resolve one breakpoint: cascade, validate, clamp, apply defaults. */
export function resolveImageSizeAt(s: ImageSizeSettings | undefined | null, bp: Breakpoint): ImageSizeAt {
  const v = s || {};
  const L = IMAGE_SIZE_LIMITS;
  const D = IMAGE_SIZE_DEFAULTS;

  const heightMode = oneOf(cascade(v.height_mode, bp), HEIGHT_MODES) ?? D.height_mode;
  let height: ImageSizeAt['height'];
  if (heightMode === 'px') height = { mode: 'px', px: num(cascade(v.height_px, bp), L.height_px) ?? D.height_px };
  else if (heightMode === 'ratio') height = { mode: 'ratio', ratio: oneOf(cascade(v.ratio, bp), IMAGE_RATIOS) ?? D.ratio };
  else height = { mode: 'auto' };

  let widthMode: ImageWidthMode = oneOf(cascade(v.width_mode, bp), WIDTH_MODES) ?? D.width_mode;
  // A ratio needs a definite width to derive the height from; "auto" (the
  // natural width) has none before load, so a ratio forces full width.
  if (widthMode === 'auto' && height.mode === 'ratio') widthMode = 'full';
  let width: ImageSizeAt['width'];
  if (widthMode === 'px') width = { mode: 'px', px: num(cascade(v.width_px, bp), L.width_px) ?? D.width_px };
  else if (widthMode === 'percent')
    width = { mode: 'percent', percent: num(cascade(v.width_percent, bp), L.width_percent) ?? D.width_percent };
  else width = { mode: widthMode };

  const align = oneOf(cascade(v.align, bp), ALIGNS) ?? D.align;
  return { width, height, align };
}

export interface ImageSizingOptions {
  /**
   * The width of the box the image sits in, per breakpoint, as a CSS length
   * for the `sizes` attribute (e.g. `50vw`, `100vw`, `600px`). Narrower
   * breakpoints inherit like settings do. Default: `100vw` everywhere.
   */
  container?: Partial<Record<Breakpoint, string>>;
  /**
   * The width/height the caller passes to next/image when no ratio applies.
   * Used to restore the attribute-based space reservation when a narrower
   * breakpoint goes back to an auto height. Default 1200x1200 (what the image
   * sections pass today).
   */
  fallbackIntrinsic?: { width: number; height: number };
}

export interface ResolvedImageSizing {
  /** Scoped CSS for `.{scope}` (frame) and `.{scope}-img` (image). */
  css: string;
  /** `sizes` attribute matching the chosen width per breakpoint ('' when natural). */
  sizes: string;
  /**
   * True when any breakpoint uses width_mode 'auto' (natural size). The
   * caller then renders a plain <img> with ONE optimizer rendition and no
   * srcset (optimizedImageUrl(src, 1920) — the optimizer never upscales), so
   * the browser lays it out at the file's real pixel width. A w-descriptor
   * srcset would make the "natural" width equal the sizes slot instead.
   * Trade-off: this applies to every breakpoint (no srcset anywhere, no
   * pre-load space reservation with an auto height). See SPEC.md.
   */
  natural: boolean;
  /** width/height to pass to next/image (ratio of the desktop height, if any). */
  intrinsic: { width: number; height: number };
  /** Resolved settings per breakpoint (for callers and tests). */
  at: Record<Breakpoint, ImageSizeAt>;
}

function ratioParts(r: ImageRatio): [number, number] {
  const [w, h] = r.split(':').map(Number);
  return [w, h];
}

type Decls = Record<string, string>;

function frameDecls(at: ImageSizeAt, maxWidthPx: number | undefined): Decls {
  const d: Decls = {};
  const w = at.width;
  if (w.mode === 'auto') d.width = 'fit-content';
  else if (w.mode === 'px') d.width = `${w.px}px`;
  else if (w.mode === 'percent') d.width = `${w.percent}%`;
  else d.width = '100%';
  d['max-width'] = maxWidthPx ? `min(100%,${maxWidthPx}px)` : '100%';
  const [start, end] = ALIGN_CSS[at.align];
  d['margin-inline-start'] = start;
  d['margin-inline-end'] = end;
  return d;
}

function imgDecls(at: ImageSizeAt, fit: ImageFit, position: ImagePosition, resetRatio: string): Decls {
  const d: Decls = {};
  d.width = at.width.mode === 'auto' ? 'auto' : '100%';
  const h = at.height;
  if (h.mode === 'px') {
    d.height = `${h.px}px`;
    d['aspect-ratio'] = resetRatio;
  } else if (h.mode === 'ratio') {
    const [rw, rh] = ratioParts(h.ratio);
    d.height = 'auto';
    d['aspect-ratio'] = `${rw}/${rh}`;
  } else {
    d.height = 'auto';
    d['aspect-ratio'] = resetRatio;
  }
  // Only a fixed box can crop/letterbox; with an auto height the box already
  // follows the image's own ratio.
  const fixed = h.mode !== 'auto';
  d['object-fit'] = fixed ? fit : 'fill';
  d['object-position'] = fixed && fit === 'cover' ? POSITION_CSS[position] : 'center';
  return d;
}

function serialize(d: Decls): string {
  return Object.entries(d)
    .map(([k, v]) => `${k}:${v}`)
    .join(';');
}

/** Declarations in `next` that differ from `prev` (the inherited state). */
function diff(prev: Decls, next: Decls): Decls {
  const out: Decls = {};
  for (const [k, v] of Object.entries(next)) if (prev[k] !== v) out[k] = v;
  return out;
}

function scaleLength(container: string, percent: number): string {
  if (percent === 100) return container;
  const m = /^(\d+(?:\.\d+)?)(vw|px)$/.exec(container.trim());
  if (m) {
    const n = Math.round(((Number(m[1]) * percent) / 100) * 100) / 100;
    return `${n}${m[2]}`;
  }
  return `calc(${container} * ${percent / 100})`;
}

// Narrowest viewport width at which each breakpoint applies (desktop is
// >= 1024px, tablet 768-1023px; mobile is taken as >= 320px, the narrowest
// phone in practice). Used to resolve `min()` statically.
const BP_MIN_VIEWPORT: Record<Breakpoint, number> = { desktop: 1024, tablet: 768, mobile: 320 };

function parseLength(s: string): { n: number; unit: 'px' | 'vw' } | null {
  const m = /^(\d+(?:\.\d+)?)(vw|px)$/.exec(s.trim());
  return m ? { n: Number(m[1]), unit: m[2] as 'px' | 'vw' } : null;
}

/**
 * The smaller of two `sizes` lengths at breakpoint `bp`. Resolved statically
 * when both are px (or both vw), or when a vw length is already at least the
 * px one at the breakpoint's narrowest viewport; otherwise CSS `min()`
 * (valid in `sizes` in current browsers).
 */
function minLength(a: string, b: string, bp: Breakpoint): string {
  if (a === b) return a;
  const pa = parseLength(a);
  const pb = parseLength(b);
  if (pa && pb) {
    if (pa.unit === pb.unit) return pa.n <= pb.n ? a : b;
    const [vw, px, pxStr] = pa.unit === 'vw' ? [pa, pb, b] : [pb, pa, a];
    if ((vw.n / 100) * BP_MIN_VIEWPORT[bp] >= px.n) return pxStr;
  }
  return `min(${a}, ${b})`;
}

/**
 * The rendered width at one breakpoint as a `sizes` length: the chosen width,
 * capped by max_width_px and by the container (the frame has max-width 100%).
 */
function sizeAt(at: ImageSizeAt, container: string, maxWidthPx: number | undefined, bp: Breakpoint): string {
  const w = at.width;
  if (w.mode === 'px') {
    const px = maxWidthPx ? Math.min(w.px, maxWidthPx) : w.px;
    return minLength(`${px}px`, container, bp);
  }
  // full (and auto, which never uses the sizes string)
  const len = w.mode === 'percent' ? scaleLength(container, w.percent) : container;
  return maxWidthPx ? minLength(len, `${maxWidthPx}px`, bp) : len;
}

/**
 * Turn `image_size` settings into scoped responsive CSS + a `sizes` string.
 * `scope` is a CSS-safe class name unique on the page (e.g. from useId()).
 */
export function resolveImageSizing(
  settings: ImageSizeSettings | undefined | null,
  scope: string,
  options: ImageSizingOptions = {},
): ResolvedImageSizing {
  const s = settings || {};
  const maxWidthPx = num(s.max_width_px, IMAGE_SIZE_LIMITS.max_width_px);
  const fit = oneOf(s.fit, ['cover', 'contain'] as const) ?? IMAGE_SIZE_DEFAULTS.fit;
  const position = oneOf(s.position, POSITIONS) ?? IMAGE_SIZE_DEFAULTS.position;
  const fallback = options.fallbackIntrinsic ?? { width: 1200, height: 1200 };

  const at = {
    desktop: resolveImageSizeAt(s, 'desktop'),
    tablet: resolveImageSizeAt(s, 'tablet'),
    mobile: resolveImageSizeAt(s, 'mobile'),
  };

  const natural = BREAKPOINTS.some((bp) => at[bp].width.mode === 'auto');

  // next/image dimensions: the desktop ratio when set, so the attribute-based
  // reservation already matches before the stylesheet applies.
  const dh = at.desktop.height;
  const intrinsic =
    dh.mode === 'ratio'
      ? (() => {
          const [rw, rh] = ratioParts(dh.ratio);
          return { width: 1200, height: Math.round((1200 * rh) / rw) };
        })()
      : { ...fallback };
  // Resetting a wider breakpoint's ratio: go back to the attribute-derived
  // reservation (`auto W/H` = natural ratio once loaded) rather than to plain
  // `auto`, which would drop the pre-load space reservation.
  const resetRatio = `auto ${intrinsic.width}/${intrinsic.height}`;

  const frameSel = `.${scope}`;
  const imgSel = `.${scope}-img`;
  let css = '';
  let prevFrame: Decls = {};
  let prevImg: Decls = {};
  for (const bp of BREAKPOINTS) {
    const f = frameDecls(at[bp], maxWidthPx);
    const i = imgDecls(at[bp], fit, position, resetRatio);
    const fOut = bp === 'desktop' ? { position: 'relative', ...f } : diff(prevFrame, f);
    const iOut = bp === 'desktop' ? { display: 'block', 'max-width': '100%', ...i } : diff(prevImg, i);
    prevFrame = f;
    prevImg = i;
    const block =
      (Object.keys(fOut).length ? `${frameSel}{${serialize(fOut)}}` : '') +
      (Object.keys(iOut).length ? `${imgSel}{${serialize(iOut)}}` : '');
    if (!block) continue;
    if (bp === 'desktop') css += block;
    else css += `@media ${bp === 'tablet' ? TABLET_DOWN_MQ : MOBILE_DOWN_MQ}{${block}}`;
  }

  // sizes: first matching media condition wins, so narrowest first; entries
  // equal to the next wider one are dropped.
  let sizes = '';
  if (!natural) {
    const cont = (bp: Breakpoint) => cascade(options.container, bp) ?? '100vw';
    const d = sizeAt(at.desktop, cont('desktop'), maxWidthPx, 'desktop');
    const t = sizeAt(at.tablet, cont('tablet'), maxWidthPx, 'tablet');
    const m = sizeAt(at.mobile, cont('mobile'), maxWidthPx, 'mobile');
    const parts: string[] = [];
    if (m !== t) parts.push(`${MOBILE_DOWN_MQ} ${m}`);
    if (t !== d) parts.push(`${TABLET_DOWN_MQ} ${t}`);
    parts.push(d);
    sizes = parts.join(', ');
  }

  return { css, sizes, natural, intrinsic, at };
}

// ── Legacy mapping (used to seed the editor; renderers keep the old path) ──

const LEGACY_ASPECT_RATIO: Record<string, ImageRatio | undefined> = {
  square: '1:1',
  portrait: '3:4',
  landscape: '4:3',
  wide: '16:9',
};

/**
 * The `image_size` value equivalent to a section's / block's legacy keys
 * (`aspect`, `fit`, `width_px`). The dashboard seeds the imageSize editor
 * with this when `image_size` is empty; renderers do NOT use it — without
 * `image_size` they keep their legacy markup byte-for-byte.
 */
export function imageSizeFromLegacy(legacy: Record<string, unknown> | undefined | null): ImageSizeSettings {
  const l = legacy || {};
  const out: ImageSizeSettings = {};
  const widthPx = num(l.width_px, IMAGE_SIZE_LIMITS.width_px);
  if (widthPx) {
    out.width_mode = 'px';
    out.width_px = widthPx;
  } else {
    out.width_mode = 'full';
  }
  const ratio = typeof l.aspect === 'string' ? LEGACY_ASPECT_RATIO[l.aspect] : undefined;
  if (ratio) {
    out.height_mode = 'ratio';
    out.ratio = ratio;
  } else {
    out.height_mode = 'auto';
  }
  out.fit = l.fit === 'contain' ? 'contain' : 'cover';
  out.align = 'start';
  return out;
}
