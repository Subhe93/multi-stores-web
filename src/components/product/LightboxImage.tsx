'use client';

import { useState, type CSSProperties, type MouseEvent } from 'react';
import { responsiveImgProps } from '@/lib/storeMedia';

// Full-size image of a lightbox with a placeholder while it downloads.
//
// The full-screen viewer requests a 92vw rendition that is not in the cache
// yet, so on a slow connection the viewer stayed black for 2-4 s (QA
// 2026-11-14, noroj). Until the full image has loaded a spinner shows. When
// the page already displays this image (gallery slide, Masonry tile), the
// exact file that <img> loaded (its `currentSrc`) fills the same box under
// the spinner: that URL is in the cache, so nothing new is downloaded. An
// image the page never loaded (lazy off-screen tile, a slide not shown yet)
// gets the spinner only; requesting a gallery-size rendition for it would
// compete with the full image for bandwidth. The full image keeps its
// natural size and in-flow position, so click / close behaviour is
// unchanged; the placeholder ignores pointer events (a click on it reaches
// the backdrop).

export interface LightboxImageProps {
  src: string;
  alt: string;
  /** `sizes` of the full-screen rendition (e.g. '92vw'). */
  sizes: string;
  className?: string;
  style?: CSSProperties;
  /** Box the placeholder fills (same max size as the full image). */
  placeholderClassName?: string;
  onClick?(e: MouseEvent<HTMLImageElement>): void;
  /** Screen-reader text while loading (omit for a silent spinner). */
  loadingLabel?: string;
}

/** Original source of an <img src>: the `url` param of a /_next/image URL, else the URL itself. */
function sourceKey(value: string): string {
  try {
    const url = new URL(value, 'http://local.invalid');
    if (url.pathname.endsWith('/_next/image')) return url.searchParams.get('url') ?? value;
  } catch {
    // Not a URL: compare as is.
  }
  return value;
}

/**
 * URL of a rendition of `src` that an <img> on the page has already loaded
 * (largest one wins), or null. Only fully decoded images count, so a lazy
 * tile that never loaded is skipped.
 */
export function findLoadedRendition(src: string): string | null {
  if (typeof document === 'undefined' || !src) return null;
  const key = sourceKey(responsiveImgProps(src, '100vw').src);
  let best: string | null = null;
  let bestWidth = 0;
  for (const img of Array.from(document.images)) {
    if (img.hasAttribute('data-lightbox-full')) continue;
    if (!img.complete || img.naturalWidth <= bestWidth) continue;
    const attr = img.getAttribute('src');
    if (!attr || sourceKey(attr) !== key) continue;
    const loaded = img.currentSrc || img.src;
    if (!loaded) continue;
    best = loaded;
    bestWidth = img.naturalWidth;
  }
  return best;
}

export function LightboxImage({
  src,
  alt,
  sizes,
  className,
  style,
  placeholderClassName = 'h-[90vh] w-[92vw]',
  onClick,
  loadingLabel,
}: LightboxImageProps) {
  const [loaded, setLoaded] = useState(false);
  // The lightbox is created on the client after a click (callers key it by
  // image), so the page's images can be inspected once, on mount. Its load
  // event (also for a cached file) always reaches onLoad.
  const [placeholderSrc] = useState(() => findLoadedRendition(src));

  return (
    <>
      {!loaded && (
        <span
          data-lightbox-placeholder=""
          className="pointer-events-none absolute inset-0 m-auto flex items-center justify-center"
          style={{ maxWidth: '100%', maxHeight: '100%' }}
        >
          {placeholderSrc && (
            // eslint-disable-next-line @next/next/no-img-element -- exact file the page already loaded (cached)
            <img
              src={placeholderSrc}
              alt=""
              aria-hidden="true"
              decoding="async"
              className={`${placeholderClassName} object-contain opacity-90 select-none`}
              draggable={false}
            />
          )}
          <span
            role={loadingLabel ? 'status' : undefined}
            aria-hidden={loadingLabel ? undefined : true}
            className="absolute inset-0 flex items-center justify-center"
          >
            <span className="size-10 rounded-full border-4 border-white/25 border-t-white motion-safe:animate-spin" />
            {loadingLabel && <span className="sr-only">{loadingLabel}</span>}
          </span>
        </span>
      )}
      {/* eslint-disable-next-line @next/next/no-img-element -- natural-ratio full-screen view; optimized srcset */}
      <img
        {...responsiveImgProps(src, sizes)}
        data-lightbox-full=""
        decoding="async"
        alt={alt}
        className={`${className ?? ''} relative transition-opacity duration-200 ${loaded ? 'opacity-100' : 'opacity-0'}`}
        style={style}
        onLoad={() => setLoaded(true)}
        onError={() => setLoaded(true)}
        onClick={onClick}
        draggable={false}
      />
    </>
  );
}
