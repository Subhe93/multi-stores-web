'use client';

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type RefObject,
  type SyntheticEvent,
} from 'react';
import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import { subscribeConsent } from '@/lib/consent';
import { embedAllowed, type GalleryVideoItem } from '@/lib/productVideo';
import { holdAutoplay, registerAutoplay, useAutoplayBlocked } from '@/lib/videoAutoplay';
import { ProductVideoPoster } from './ProductVideoPoster';
import { ExternalVideoFacade } from './ExternalVideoFacade';
import { VideoAutoplayControls } from './VideoAutoplayControls';
import type { ProductVideoPlayerHandle } from './ProductVideoPlayer';

// One product video in a gallery slot, list or story card
// (product-video CONTRACT-AUTOPLAY 6.4). Modes:
//
// - poster: the static poster + Play button (server-rendered; identical to
//   the pre-autoplay markup for a video without `autoplay`);
// - facade: poster + the two-click notice for a YouTube / Vimeo video the
//   visitor has not allowed (after hydration only; nothing is requested from
//   the provider before a click);
// - autoplay: muted inline playback over the poster while this slide is the
//   page's most visible autoplay video (coordinator in lib/videoAutoplay),
//   with pause / mute toggles; never with reduced motion / Save-Data, never
//   for an external video without the external-media consent;
// - player: the visitor's player (controls, sound). Entered by Play, a tap
//   on an autoplaying video (continues at its time) or `autoStart`. While it
//   is mounted every autoplay on the page pauses (holdAutoplay).
//
// Callers pass `key={item.id}` so a slide change unmounts the player (which
// pauses and frees it).

// Loaded on the first Play click (or the first autoplay grant) only. While
// the chunk downloads the poster underneath stays visible, so the loading
// placeholder renders nothing.
const ProductVideoPlayer = dynamic(() => import('./ProductVideoPlayer'), { ssr: false, loading: () => null });

export interface ProductVideoSlideProps {
  item: GalleryVideoItem;
  storeSlug: string;
  priority?: boolean;
  sizes: string;
  className?: string;
  /** Position classes of the autoplay pause / mute toggles (default bottom-2 start-2). */
  controlsClassName?: string;
  /** Compact two-click facade (narrow tiles such as story cards). */
  compactFacade?: boolean;
  /** Start the visitor's player on mount (lightbox / story hand-off after a click). Never autoplay. */
  autoStart?: boolean;
  /** Seconds to resume from (with autoStart). */
  startAt?: number;
  /** True when the visitor's player mounts, false when it goes away (not reported for muted autoplay). */
  onPlayingChange?(playing: boolean): void;
  /** Receives the file video's <video> element while the visitor's player is mounted. */
  playerRef?: RefObject<HTMLVideoElement | null>;
  /** Poster loading when not `priority`: 'eager' (default, gallery) or 'lazy' (story cards). */
  posterLoading?: 'eager' | 'lazy';
}

const stop = (e: SyntheticEvent) => e.stopPropagation();
const noopSubscribe = () => () => {};

export function ProductVideoSlide({
  item,
  storeSlug,
  priority,
  sizes,
  className = 'absolute inset-0',
  controlsClassName = 'bottom-2 start-2',
  compactFacade = false,
  autoStart = false,
  startAt,
  onPlayingChange,
  playerRef,
  posterLoading = 'eager',
}: ProductVideoSlideProps) {
  const t = useTranslations();
  const instance = useId();
  const external = item.source.type !== 'file' ? item.source : null;
  // Server snapshots: not hydrated, embeds not allowed, autoplay blocked, so
  // SSR (and the hydration render) is the poster only.
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const allowed = useSyncExternalStore(subscribeConsent, () => embedAllowed(storeSlug), () => false);
  const blocked = useAutoplayBlocked();

  // The visitor asked for the player (Play, autoStart, tap on autoplay).
  const [requested, setRequested] = useState(autoStart);
  // [Play video] on the facade: this one embed may load without the grant.
  const [oneOff, setOneOff] = useState(false);
  const [failed, setFailed] = useState(false);
  const [resumeAt, setResumeAt] = useState<number | undefined>(undefined);

  const canInline = !external || allowed || oneOff;
  const playerActive = requested && canInline && !failed;

  // Clearing the external-media grant unmounts a mounted embed (also a
  // one-off one): back to the poster with the facade. State adjusted during
  // render on the transition (no effect cascade).
  const [prevAllowed, setPrevAllowed] = useState(allowed);
  if (prevAllowed !== allowed) {
    setPrevAllowed(allowed);
    if (prevAllowed && !allowed && external) {
      setOneOff(false);
      setRequested(false);
    }
  }

  const startPlayer = useCallback((once: boolean) => {
    if (once) setOneOff(true);
    setResumeAt(undefined);
    setRequested(true);
  }, []);
  // The poster's centre Play on a facade is [Play video]: this embed only.
  const play = useCallback(() => startPlayer(!!external && !allowed), [startPlayer, external, allowed]);

  useEffect(() => {
    if (!onPlayingChange) return;
    onPlayingChange(playerActive);
  }, [playerActive, onPlayingChange]);
  useEffect(() => {
    if (!onPlayingChange) return;
    return () => onPlayingChange(false);
  }, [onPlayingChange]);

  // A user-started player pauses every muted autoplay on the page.
  useEffect(() => {
    if (!playerActive) return;
    return holdAutoplay();
  }, [playerActive]);

  // ── Muted autoplay ──
  const [granted, setGranted] = useState(false);
  const [autoMounted, setAutoMounted] = useState(false);
  const [layerVisible, setLayerVisible] = useState(false);
  const [userPaused, setUserPaused] = useState(false);
  const [muted, setMuted] = useState(true);
  // Refused by the browser, or ended without loop: no retry in this page view.
  const [autoStopped, setAutoStopped] = useState(false);
  // Where a file video's muted layer stopped when it lost the grant (its
  // <video> is unmounted so it stops buffering); the next grant resumes here.
  const [autoResumeAt, setAutoResumeAt] = useState<number | undefined>(undefined);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const handleRef = useRef<ProductVideoPlayerHandle | null>(null);

  const autoEligible =
    item.autoplay === true &&
    !autoStart &&
    hydrated &&
    !blocked &&
    (!external || allowed) &&
    !requested &&
    !failed &&
    !autoStopped;

  useEffect(() => {
    const el = rootRef.current;
    if (!autoEligible || !el) return;
    const isFile = item.source.type === 'file';
    const unregister = registerAutoplay(`${item.id}:${instance}`, el, (g) => {
      setGranted(g);
      if (g) {
        setAutoMounted(true);
        return;
      }
      // Every automatic resume starts muted; only the toggle unmutes the
      // clip that is playing now.
      setMuted(true);
      if (isFile) {
        // Off-screen (or another video won): drop the <video> so a paused
        // layer never keeps downloading; remember the time to resume from.
        const at = handleRef.current?.currentTime() ?? 0;
        setAutoResumeAt(at > 0 ? at : undefined);
        setAutoMounted(false);
        setLayerVisible(false);
      }
    });
    return () => {
      unregister();
      setGranted(false);
      setMuted(true);
    };
  }, [autoEligible, item.id, item.source.type, instance]);

  // Leaving autoplay (player, refusal, end, block, consent cleared) drops
  // the muted layer (adjusted during render on the transition).
  const [prevEligible, setPrevEligible] = useState(autoEligible);
  if (prevEligible !== autoEligible) {
    setPrevEligible(autoEligible);
    if (!autoEligible) {
      setAutoMounted(false);
      setLayerVisible(false);
    }
  }

  const onAutoplayStopped = useCallback(() => setAutoStopped(true), []);
  const onLayerPlaying = useCallback(() => setLayerVisible(true), []);

  // Tap on the autoplaying video: the visitor's player, with sound, at the
  // same time (file videos).
  const takeOver = useCallback(() => {
    const at = handleRef.current?.currentTime() ?? 0;
    setResumeAt(at > 0 ? at : undefined);
    setRequested(true);
  }, []);

  const handleError = useCallback(() => {
    setRequested(false);
    setFailed(true);
  }, []);

  if (failed) {
    return (
      <ProductVideoPoster
        item={item}
        onPlay={play}
        priority={priority}
        sizes={sizes}
        loading={posterLoading}
        className={className}
        hidePlay
        overlay={
          <span role="status" className="absolute inset-x-0 bottom-3 z-20 mx-auto w-fit rounded bg-black/75 px-2 py-1 text-xs text-white">
            {t('product.videoUnavailable')}
          </span>
        }
      />
    );
  }

  if (playerActive) {
    return (
      <div
        data-gallery-video="player"
        className={`${className} overflow-hidden bg-black`}
        onClick={stop}
        onPointerDown={stop}
        onPointerUp={stop}
        onTouchStart={stop}
        onTouchEnd={stop}
      >
        {/* Poster stays underneath while the player chunk loads. */}
        <ProductVideoPoster item={item} onPlay={play} priority={priority} sizes={sizes} loading={posterLoading} hidePlay />
        <div className="absolute inset-0 z-20">
          <ProductVideoPlayer item={item} startAt={resumeAt ?? startAt} videoRef={playerRef} onError={handleError} />
        </div>
      </div>
    );
  }

  const facade =
    hydrated && external && !allowed ? (
      <ExternalVideoFacade
        provider={external.type}
        watchUrl={external.watchUrl}
        storeSlug={storeSlug}
        compact={compactFacade}
        onPlayOnce={() => startPlayer(true)}
      />
    ) : null;

  // A video without autoplay keeps the pre-autoplay markup (poster only).
  if (item.autoplay !== true) {
    return (
      <ProductVideoPoster
        item={item}
        onPlay={play}
        priority={priority}
        sizes={sizes}
        loading={posterLoading}
        className={className}
        overlay={facade}
      />
    );
  }

  const paused = !granted || userPaused;
  return (
    <div ref={rootRef} className={`${className} overflow-hidden`} data-video-autoplay="">
      <ProductVideoPoster
        item={item}
        onPlay={play}
        priority={priority}
        sizes={sizes}
        loading={posterLoading}
        hidePlay={autoMounted}
        hideDuration={autoMounted}
        overlay={facade}
      />
      {autoMounted && (
        <>
          <div
            data-gallery-video="autoplay"
            className={`absolute inset-0 z-10 transition-opacity duration-300 ${layerVisible ? 'opacity-100' : 'opacity-0'}`}
          >
            <ProductVideoPlayer
              item={item}
              mode="autoplay"
              startAt={autoResumeAt}
              paused={paused}
              muted={muted}
              handleRef={handleRef}
              onError={handleError}
              onPlaying={onLayerPlaying}
              onAutoplayRejected={onAutoplayStopped}
              onEnded={onAutoplayStopped}
            />
          </div>
          {/* Tap anywhere on the muted video: the full player with sound. */}
          <button
            type="button"
            className="absolute inset-0 z-20 cursor-pointer focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-white/80"
            aria-label={t('product.playVideoNamed', { alt: item.alt })}
            onClick={(e) => {
              e.stopPropagation();
              takeOver();
            }}
          />
          <VideoAutoplayControls
            className={controlsClassName}
            paused={paused}
            muted={muted}
            // A manual pause is sticky: the coordinator does not resume this
            // slide until the visitor presses play again.
            onTogglePaused={() => setUserPaused((p) => !p)}
            onToggleMuted={() => setMuted((m) => !m)}
          />
        </>
      )}
    </div>
  );
}
