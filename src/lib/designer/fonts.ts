// ── Designer editor: template fonts (M4.2 §7.1) ───────────────────────────
// Loads the template faces through the FontFace API from the payload URLs
// (the same files the server renderer uses, G1) and adds them to
// `document.fonts`. NPP waited up to 6 s; after that the editor renders with
// whatever is ready and shows a notice, and re-renders when a late face lands.

import type { FontLookup, FontStyle } from '@multi-stores/core/designer';
import { absoluteUrl, type DesignerFont } from './api';

export const FONT_TIMEOUT_MS = 6000;

export function fontKey(family: string, weight: number, style: FontStyle): string {
  return `${family}|${weight}|${style === 'italic' ? 'italic' : 'normal'}`;
}

/** Faces loaded in this page, by URL (shared across editor mounts). */
const loadedByUrl = new Map<string, Promise<boolean>>();
const readyKeys = new Set<string>();

/** Lookup the renderer can use (`fonts.has`): only faces that finished loading. */
export const loadedFonts: FontLookup = {
  has(family, weight, style) {
    return readyKeys.has(fontKey(family, weight, style));
  },
};

function loadOne(font: DesignerFont): Promise<boolean> {
  const url = absoluteUrl(font.url);
  const cached = loadedByUrl.get(url);
  if (cached) return cached;
  const p = (async () => {
    if (typeof FontFace === 'undefined' || typeof document === 'undefined') return false;
    try {
      const face = new FontFace(font.family, `url(${JSON.stringify(url)})`, {
        weight: String(font.weight),
        style: font.style,
        display: 'block',
      });
      await face.load();
      document.fonts.add(face);
      readyKeys.add(fontKey(font.family, font.weight, font.style));
      return true;
    } catch {
      loadedByUrl.delete(url); // allow a retry on the next mount
      return false;
    }
  })();
  loadedByUrl.set(url, p);
  return p;
}

export interface FontLoadResult {
  /** Faces that failed or were still loading at the timeout. */
  pending: string[];
  timedOut: boolean;
}

/**
 * Loads every face; resolves when all settled or after `timeoutMs`.
 * `onLate` fires when a face that missed the timeout finishes later.
 */
export async function loadDesignerFonts(
  fonts: DesignerFont[],
  opts: { timeoutMs?: number; onLate?: () => void } = {},
): Promise<FontLoadResult> {
  if (fonts.length === 0) return { pending: [], timedOut: false };
  let settled = false;
  const all = Promise.all(
    fonts.map((f) =>
      loadOne(f).then((ok) => {
        if (settled && ok) opts.onLate?.();
        return ok;
      }),
    ),
  );
  const timeout = new Promise<'timeout'>((resolve) =>
    setTimeout(() => resolve('timeout'), opts.timeoutMs ?? FONT_TIMEOUT_MS),
  );
  const res = await Promise.race([all, timeout]);
  settled = true;
  const pending = fonts
    .filter((f) => !readyKeys.has(fontKey(f.family, f.weight, f.style)))
    .map((f) => fontKey(f.family, f.weight, f.style));
  return { pending, timedOut: res === 'timeout' };
}

/**
 * Lookup for the renderer's `fonts` input: a face of the payload counts as
 * available only once it finished loading (until then its text is skipped
 * and reported in `missing`, never fitted with a fallback font). Faces the
 * payload does not ship are left to the browser, so such text still shows.
 */
export function payloadFontLookup(fonts: DesignerFont[], loaded: FontLookup = loadedFonts): FontLookup {
  const managed = new Set(fonts.map((f) => fontKey(f.family, f.weight, f.style)));
  return {
    has(family, weight, style) {
      return !managed.has(fontKey(family, weight, style)) || loaded.has(family, weight, style);
    },
  };
}

/** Payload faces that have not finished loading (keys `family|weight|style`). */
export function missingFontKeys(fonts: DesignerFont[], loaded: FontLookup = loadedFonts): string[] {
  return fonts
    .filter((f) => !loaded.has(f.family, f.weight, f.style))
    .map((f) => fontKey(f.family, f.weight, f.style));
}
