'use client';

import {
  useEffect,
  useImperativeHandle,
  useRef,
  type MutableRefObject,
  type RefObject,
} from 'react';
import { toEmbedUrl, type GalleryVideoItem } from '@/lib/productVideo';

// The only player chunk. `ProductVideoSlide` imports it through next/dynamic
// and renders it only after a Play click, or (muted autoplay) once the video
// is granted autoplay while visible, so a product page without video (or one
// where nothing plays) never requests it.
//
// mode 'user' (default): the visitor started it; native controls, sound on.
// mode 'autoplay': muted, inline, no controls and no `poster` attribute (the
// server-rendered poster image stays underneath, so the LCP image is not
// fetched twice). The slide drives it through the imperative handle
// (pause / play / mute) and the `paused` prop (coordinator grant).

export interface ProductVideoPlayerHandle {
  play(): void;
  pause(): void;
  setMuted(muted: boolean): void;
  /** Seconds played (file videos; 0 for embeds). */
  currentTime(): number;
}

export interface ProductVideoPlayerProps {
  item: GalleryVideoItem;
  /** 'autoplay' = muted inline autoplay (CONTRACT-AUTOPLAY 6.4). */
  mode?: 'user' | 'autoplay';
  /** Autoplay mode: whether playback should be paused right now. */
  paused?: boolean;
  /** Autoplay mode: sound off (default) or on after the visitor's toggle. */
  muted?: boolean;
  /** Seconds to resume from (lightbox / autoplay hand-off). */
  startAt?: number;
  /** Receives the <video> element of a file video (e.g. to read currentTime). */
  videoRef?: RefObject<HTMLVideoElement | null>;
  /** Imperative controls (a prop, not `ref`: next/dynamic wraps this component). */
  handleRef?: RefObject<ProductVideoPlayerHandle | null>;
  /** The file could not be played (404, unsupported codec, network). */
  onError?(): void;
  /** Autoplay mode: the first frame is playing (the slide fades the layer in). */
  onPlaying?(): void;
  /** Autoplay mode: play() was refused (iOS Low Power Mode, browser policy). */
  onAutoplayRejected?(): void;
  /** Autoplay mode: the clip ended (only without loop). */
  onEnded?(): void;
}

function postToFrame(frame: HTMLIFrameElement | null, item: GalleryVideoItem, message: object): void {
  const win = frame?.contentWindow;
  if (!win) return;
  const target = item.source.type === 'vimeo' ? 'https://player.vimeo.com' : 'https://www.youtube-nocookie.com';
  try {
    win.postMessage(JSON.stringify(message), target);
  } catch {
    // The provider's own controls remain as a fallback.
  }
}

function youtubeCommand(func: string): object {
  return { event: 'command', func, args: [] };
}

export default function ProductVideoPlayer({
  item,
  mode = 'user',
  paused = false,
  muted = true,
  startAt,
  videoRef,
  handleRef,
  onError,
  onPlaying,
  onAutoplayRejected,
  onEnded,
}: ProductVideoPlayerProps) {
  const ownRef = useRef<HTMLVideoElement | null>(null);
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const source = item.source;
  const autoplay = mode === 'autoplay';
  const loop = autoplay && item.loop === true;

  // Latest callbacks without re-running the media effects.
  const cbs = useRef({ onPlaying, onAutoplayRejected });
  const mutedRef = useRef(muted);
  // Declared first so it runs before the media effects below.
  useEffect(() => {
    cbs.current = { onPlaying, onAutoplayRejected };
    mutedRef.current = muted;
  });

  useImperativeHandle(
    handleRef,
    () => ({
      play() {
        const video = ownRef.current;
        if (video) {
          const p = video.play?.();
          if (p && typeof p.catch === 'function') p.catch(() => undefined);
          return;
        }
        postToFrame(frameRef.current, item, source.type === 'vimeo' ? { method: 'play' } : youtubeCommand('playVideo'));
      },
      pause() {
        const video = ownRef.current;
        if (video) {
          video.pause();
          return;
        }
        postToFrame(frameRef.current, item, source.type === 'vimeo' ? { method: 'pause' } : youtubeCommand('pauseVideo'));
      },
      setMuted(muted: boolean) {
        const video = ownRef.current;
        if (video) {
          video.muted = muted;
          return;
        }
        postToFrame(
          frameRef.current,
          item,
          source.type === 'vimeo' ? { method: 'setMuted', value: muted } : youtubeCommand(muted ? 'mute' : 'unMute'),
        );
      },
      currentTime() {
        return ownRef.current?.currentTime ?? 0;
      },
    }),
    [item, source.type],
  );

  // File, user mode: resume, start (the visitor clicked Play) and move focus
  // to the controls; pause when the tab is hidden or the tile scrolls out of
  // view. Autoplay mode: the slide's coordinator handles visibility.
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
    if (autoplay) {
      return () => {
        video.pause();
        if (videoRef && videoRef.current === video) {
          (videoRef as MutableRefObject<HTMLVideoElement | null>).current = null;
        }
      };
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
  }, [videoRef, startAt, autoplay]);

  // File, autoplay mode: follow the grant (muted before every play()).
  useEffect(() => {
    if (!autoplay) return;
    const video = ownRef.current;
    if (!video) return;
    if (paused) {
      video.pause();
      return;
    }
    video.defaultMuted = true;
    video.muted = mutedRef.current;
    const played = video.play?.();
    if (played && typeof played.catch === 'function') {
      played.catch((err: unknown) => {
        // AbortError = a pause() interrupted the start; not a refusal.
        if (err && typeof err === 'object' && (err as { name?: string }).name === 'AbortError') return;
        cbs.current.onAutoplayRejected?.();
      });
    }
  }, [autoplay, paused]);

  // Autoplay mode: the visitor's mute / unmute toggle.
  const firstMute = useRef(true);
  useEffect(() => {
    if (!autoplay) return;
    if (firstMute.current) {
      firstMute.current = false;
      if (muted) return;
    }
    const video = ownRef.current;
    if (video) {
      video.muted = muted;
      return;
    }
    postToFrame(
      frameRef.current,
      item,
      source.type === 'vimeo' ? { method: 'setMuted', value: muted } : youtubeCommand(muted ? 'mute' : 'unMute'),
    );
  }, [autoplay, muted, item, source.type]);

  // Embed, autoplay mode: pause / resume through the provider's API.
  const firstGrant = useRef(true);
  useEffect(() => {
    if (!autoplay || source.type === 'file') return;
    if (firstGrant.current) {
      // The embed URL already autoplays; nothing to send on mount.
      firstGrant.current = false;
      if (!paused) return;
    }
    postToFrame(
      frameRef.current,
      item,
      source.type === 'vimeo'
        ? { method: paused ? 'pause' : 'play' }
        : youtubeCommand(paused ? 'pauseVideo' : 'playVideo'),
    );
  }, [autoplay, paused, item, source.type]);

  // Embed, user mode: focus the frame so keyboard users land in the provider's player.
  useEffect(() => {
    if (autoplay) return;
    try {
      frameRef.current?.focus({ preventScroll: true });
    } catch {
      // Focus is best effort.
    }
  }, [autoplay]);

  if (source.type === 'file') {
    if (autoplay) {
      return (
        <video
          ref={(el) => {
            ownRef.current = el;
            if (el) {
              // React does not reflect `muted` as an attribute; iOS needs the
              // property set before play().
              el.muted = true;
              el.defaultMuted = true;
            }
          }}
          src={source.src}
          muted
          playsInline
          loop={loop}
          // play() fetches what it needs; no read-ahead of the whole file
          // (the slide also unmounts this layer when the grant is lost).
          preload="metadata"
          disableRemotePlayback
          aria-label={item.alt}
          onError={onError}
          onPlaying={() => cbs.current.onPlaying?.()}
          onEnded={loop ? undefined : onEnded}
          className="h-full w-full bg-transparent object-cover"
        />
      );
    }
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

  const src = autoplay
    ? toEmbedUrl(
        { kind: source.type, id: source.videoId, hash: source.hash },
        { autoplayMuted: true, loop, origin: typeof location !== 'undefined' ? location.origin : undefined },
      )
    : source.embedUrl;

  return (
    <iframe
      ref={frameRef}
      src={src}
      title={item.alt}
      allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
      allowFullScreen
      referrerPolicy="strict-origin-when-cross-origin"
      loading="eager"
      onLoad={autoplay ? () => cbs.current.onPlaying?.() : undefined}
      className="h-full w-full border-0 bg-black"
    />
  );
}
