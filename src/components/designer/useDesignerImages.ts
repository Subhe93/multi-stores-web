'use client';

// ── Designer editor: image sources for the renderer ───────────────────────
// `images.get(assetId)` for renderDesign: template images from their public
// asset URLs, customer photos from their signed preview URLs, plus local
// (downscaled) bitmaps of photos still uploading or just uploaded, so the
// customer sees the photo at once. The canvas is never exported, so no CORS
// mode is needed on these loads.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ImageLookup, TemplateSpecV1 } from '@/lib/designer/design-renderer';
import { absoluteUrl, templateImageUrls, type DesignPhotoView } from '@/lib/designer/api';

type Source = HTMLImageElement | ImageBitmap;

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('IMAGE_LOAD_FAILED'));
    img.src = url;
  });
}

/** Longest side of the in-browser preview of a picked photo. */
export const LOCAL_PREVIEW_MAX_PX = 1600;

/**
 * Decodes a picked file into a bitmap no larger than LOCAL_PREVIEW_MAX_PX on
 * its longest side (EXIF orientation applied by the browser). Only for the
 * on-screen preview: the original file is what gets uploaded.
 */
export async function downscaleForPreview(file: Blob): Promise<{ bitmap: ImageBitmap; width: number; height: number }> {
  const full = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const { width, height } = full;
  const longest = Math.max(width, height);
  if (longest <= LOCAL_PREVIEW_MAX_PX) return { bitmap: full, width, height };
  const k = LOCAL_PREVIEW_MAX_PX / longest;
  try {
    const small = await createImageBitmap(full, {
      resizeWidth: Math.max(1, Math.round(width * k)),
      resizeHeight: Math.max(1, Math.round(height * k)),
      resizeQuality: 'medium',
    });
    full.close();
    return { bitmap: small, width, height };
  } catch {
    return { bitmap: full, width, height };
  }
}

export function useDesignerImages(spec: TemplateSpecV1, photos: Record<string, DesignPhotoView> | undefined) {
  const cache = useRef(new Map<string, Source>());
  const requested = useRef(new Set<string>());
  const [version, setVersion] = useState(0);
  const [templatePending, setTemplatePending] = useState(true);

  const request = useCallback((key: string, url: string): Promise<void> => {
    if (!url || requested.current.has(key) || cache.current.has(key)) return Promise.resolve();
    requested.current.add(key);
    return loadImage(url).then(
      (img) => {
        cache.current.set(key, img);
        setVersion((v) => v + 1);
      },
      () => {
        // Allow a retry when the URL is offered again (e.g. a refreshed signed link).
        requested.current.delete(key);
      },
    );
  }, []);

  // Template images: the skeleton stays until each one loaded or failed.
  useEffect(() => {
    const urls = templateImageUrls(spec);
    let cancelled = false;
    setTemplatePending(urls.size > 0);
    Promise.all([...urls].map(([id, url]) => request(id, url))).finally(() => {
      if (!cancelled) setTemplatePending(false);
    });
    return () => {
      cancelled = true;
    };
  }, [spec, request]);

  // Customer photos: signed previews (skipped when a local bitmap exists).
  useEffect(() => {
    for (const p of Object.values(photos || {})) {
      if (p.preview_url) void request(p.asset_id, absoluteUrl(p.preview_url));
    }
  }, [photos, request]);

  /** Registers a local bitmap under a key (an uploaded asset id or a pending slot key). */
  const setLocal = useCallback((key: string, source: Source | null) => {
    if (source) cache.current.set(key, source);
    else cache.current.delete(key);
    setVersion((v) => v + 1);
  }, []);

  const lookup: ImageLookup = useMemo(
    () => ({ get: (id: string) => cache.current.get(id) }),
    // A new object per load so consumers re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [version],
  );

  return { images: lookup, version, templatePending, setLocal };
}
