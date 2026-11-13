'use client';

import { useEffect, useRef, type MutableRefObject, type RefObject } from 'react';
import type { GalleryVideoItem } from '@/lib/productVideo';

// The only player chunk. `ProductVideoSlide` imports it through next/dynamic
// and renders it only after a Play click, so a product page without video
// (or one where nobody clicks) never requests it.

export interface ProductVideoPlayerProps {
  item: GalleryVideoItem;
  /** Seconds to resume from (lightbox hand-off). */
  startAt?: number;
  /** Receives the <video> element of a file video (e.g. to read currentTime). */
  videoRef?: RefObject<HTMLVideoElement | null>;
  /** The file could not be played (404, unsupported codec, network). */
  onError?(): void;
}

export default function ProductVideoPlayer({ item, startAt, videoRef, onError }: ProductVideoPlayerProps) {
  const ownRef = useRef<HTMLVideoElement | null>(null);
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const source = item.source;

  // File: resume, start (the visitor clicked Play) and move focus to the
  // controls; pause when the tab is hidden or the tile scrolls out of view.
  useEffect(() => {
    const video = ownRef.current;
    if (!video) return;
    if (videoRef) (videoRef as MutableRefObject<HTMLVideoElement | null>).current = video;
    if (startAt && startAt > 0) {
      try {
        video.currentTime = startAt;
      } catch {
        // Not seekable yet: start from the beginning.
      }
    }
    try {
      video.focus({ preventScroll: true });
    } catch {
      // Focus is best effort.
    }
    // A rejected play() (autoplay policy) keeps the native controls visible.
    const played = video.play?.();
    if (played && typeof played.catch === 'function') played.catch(() => undefined);

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') video.pause();
    };
    document.addEventListener('visibilitychange', onVisibility);

    let observer: IntersectionObserver | null = null;
    if (typeof IntersectionObserver !== 'undefined') {
      observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) if (!entry.isIntersecting) video.pause();
        },
        { threshold: 0 },
      );
      observer.observe(video);
    }

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      observer?.disconnect();
      video.pause();
      if (videoRef && videoRef.current === video) {
        (videoRef as MutableRefObject<HTMLVideoElement | null>).current = null;
      }
    };
  }, [videoRef, startAt]);

  // Embed: focus the frame so keyboard users land in the provider's player.
  useEffect(() => {
    try {
      frameRef.current?.focus({ preventScroll: true });
    } catch {
      // Focus is best effort.
    }
  }, []);

  if (source.type === 'file') {
    return (
      <video
        ref={ownRef}
        src={source.src}
        controls
        playsInline
        preload="metadata"
        poster={item.url || undefined}
        aria-label={item.alt}
        onError={onError}
        className="h-full w-full bg-black object-contain"
      />
    );
  }

  return (
    <iframe
      ref={frameRef}
      src={source.embedUrl}
      title={item.alt}
      allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
      allowFullScreen
      referrerPolicy="strict-origin-when-cross-origin"
      loading="eager"
      className="h-full w-full border-0 bg-black"
    />
  );
}
