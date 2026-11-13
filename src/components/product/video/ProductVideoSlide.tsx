'use client';

import { useCallback, useEffect, useState, type RefObject, type SyntheticEvent } from 'react';
import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import { subscribeConsent } from '@/lib/consent';
import { embedAllowed, type GalleryVideoItem } from '@/lib/productVideo';
import { ProductVideoPoster } from './ProductVideoPoster';

// One product video in a gallery slot or list. Before Play it is only the
// static poster (server-rendered). Play mounts the player chunk; a YouTube /
// Vimeo video mounts it only when the visitor accepted cookies for this
// store, otherwise a notice links out to the provider (no third-party
// request). Callers pass `key={item.id}` so a slide change unmounts the
// player (which pauses and frees it).

// Loaded on the first Play click only. While the chunk downloads the poster
// underneath stays visible, so the loading placeholder renders nothing.
const ProductVideoPlayer = dynamic(() => import('./ProductVideoPlayer'), { ssr: false, loading: () => null });

export interface ProductVideoSlideProps {
  item: GalleryVideoItem;
  storeSlug: string;
  priority?: boolean;
  sizes: string;
  className?: string;
  /** Start playing on mount (lightbox hand-off after a click). */
  autoStart?: boolean;
  /** Seconds to resume from (with autoStart). */
  startAt?: number;
  /** True when the player mounts, false when it goes away. */
  onPlayingChange?(playing: boolean): void;
  /** Receives the file video's <video> element while it is mounted. */
  playerRef?: RefObject<HTMLVideoElement | null>;
}

const stop = (e: SyntheticEvent) => e.stopPropagation();

function canPlayInline(item: GalleryVideoItem, storeSlug: string): boolean {
  return item.source.type === 'file' || embedAllowed(storeSlug);
}

export function ProductVideoSlide({
  item,
  storeSlug,
  priority,
  sizes,
  className = 'absolute inset-0',
  autoStart = false,
  startAt,
  onPlayingChange,
  playerRef,
}: ProductVideoSlideProps) {
  const t = useTranslations();
  // autoStart is used only after a click (lightbox), never on the server.
  const [playing, setPlaying] = useState(() => autoStart && canPlayInline(item, storeSlug));
  const [needsConsent, setNeedsConsent] = useState(() => autoStart && !canPlayInline(item, storeSlug));
  const [failed, setFailed] = useState(false);

  const play = useCallback(() => {
    if (canPlayInline(item, storeSlug)) {
      setNeedsConsent(false);
      setPlaying(true);
    } else {
      setNeedsConsent(true);
    }
  }, [item, storeSlug]);

  // Accepting cookies in the banner while the notice shows starts the embed.
  useEffect(() => {
    if (!needsConsent) return;
    return subscribeConsent(() => {
      if (embedAllowed(storeSlug)) {
        setNeedsConsent(false);
        setPlaying(true);
      }
    });
  }, [needsConsent, storeSlug]);

  // Withdrawing consent while a YouTube / Vimeo embed is mounted unmounts it:
  // back to the poster with the link-out notice.
  const externalPlaying = playing && item.source.type !== 'file';
  useEffect(() => {
    if (!externalPlaying) return;
    return subscribeConsent(() => {
      if (!embedAllowed(storeSlug)) {
        setPlaying(false);
        setNeedsConsent(true);
      }
    });
  }, [externalPlaying, storeSlug]);

  useEffect(() => {
    if (!onPlayingChange) return;
    onPlayingChange(playing);
  }, [playing, onPlayingChange]);
  useEffect(() => {
    if (!onPlayingChange) return;
    return () => onPlayingChange(false);
  }, [onPlayingChange]);

  const handleError = useCallback(() => {
    setPlaying(false);
    setFailed(true);
  }, []);

  if (failed) {
    return (
      <ProductVideoPoster
        item={item}
        onPlay={play}
        priority={priority}
        sizes={sizes}
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

  if (playing) {
    return (
      <div
        data-gallery-video=""
        className={`${className} overflow-hidden bg-black`}
        onClick={stop}
        onPointerDown={stop}
        onPointerUp={stop}
        onTouchStart={stop}
        onTouchEnd={stop}
      >
        {/* Poster stays underneath while the player chunk loads. */}
        <ProductVideoPoster item={item} onPlay={play} priority={priority} sizes={sizes} hidePlay />
        <div className="absolute inset-0 z-20">
          <ProductVideoPlayer item={item} startAt={startAt} videoRef={playerRef} onError={handleError} />
        </div>
      </div>
    );
  }

  const external = item.source.type !== 'file' ? item.source : null;
  const provider = external?.type === 'vimeo' ? 'Vimeo' : 'YouTube';
  return (
    <ProductVideoPoster
      item={item}
      onPlay={play}
      priority={priority}
      sizes={sizes}
      className={className}
      overlay={
        needsConsent && external ? (
          <div
            role="status"
            className="absolute inset-x-2 bottom-2 z-20 rounded-lg bg-black/80 p-3 text-center text-xs leading-relaxed text-white sm:text-sm"
          >
            <p>{t('product.videoConsentNotice', { provider })}</p>
            <a
              href={external.watchUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-block font-semibold underline underline-offset-2"
            >
              {external.type === 'vimeo' ? t('product.watchOnVimeo') : t('product.watchOnYouTube')}
            </a>
          </div>
        ) : null
      }
    />
  );
}
