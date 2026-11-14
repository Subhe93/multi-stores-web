'use client';

import { useRef, type ReactNode, type SyntheticEvent, type TouchEvent as ReactTouchEvent } from 'react';
import { useTranslations } from 'next-intl';
import { Play } from 'lucide-react';
import { StoreImage } from '@/components/StoreImage';
import { isSvgSrc } from '@/lib/storeMedia';
import { formatVideoDuration, type GalleryVideoItem } from '@/lib/productVideo';

// Static poster + Play button of a product video. No state beyond a swipe
// guard and no effects: it renders on the server like an image slide, and nothing heavy (no
// <video>, no iframe, no player chunk) exists until the visitor clicks Play
// (or a muted autoplay is granted, see ProductVideoSlide).

export interface ProductVideoPosterProps {
  item: GalleryVideoItem;
  onPlay(): void;
  /** Same rule as an image at this index: preload + high fetch priority. */
  priority?: boolean;
  sizes: string;
  /** Wrapper classes; defaults to filling the positioned parent. */
  className?: string;
  /** Hide the Play button (e.g. while the player covers the poster, or after an error). */
  hidePlay?: boolean;
  /** Extra layer over the poster (external-video facade, "unavailable" chip). */
  overlay?: ReactNode;
  /** Hide the duration chip (while a muted autoplay runs over the poster). */
  hideDuration?: boolean;
  /** Optional corner badge (unused by default). */
  badge?: ReactNode;
  /**
   * Loading of a non-priority poster: 'eager' (default, gallery slides) or
   * 'lazy' (story cards, which may sit far off-screen).
   */
  loading?: 'eager' | 'lazy';
}

// A click never reaches the gallery (no lightbox on tap). Touch and pointer
// events do bubble, so a swipe that starts on a poster (e.g. a featured
// video in slot 0) still moves the gallery; the Play button ignores the
// click that ends such a swipe.
const stop = (e: SyntheticEvent) => e.stopPropagation();

/** A touch that moved further than this is a swipe, not a tap on Play. */
const SWIPE_SLOP_PX = 10;

export function ProductVideoPoster({
  item,
  onPlay,
  priority = false,
  sizes,
  className = 'absolute inset-0',
  hidePlay = false,
  overlay,
  hideDuration = false,
  badge,
  loading = 'eager',
}: ProductVideoPosterProps) {
  const t = useTranslations();
  const duration = hideDuration ? null : formatVideoDuration(item.durationS);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const swiped = useRef(false);
  const onTouchStart = (e: ReactTouchEvent) => {
    const p = e.touches[0];
    touchStart.current = p ? { x: p.clientX, y: p.clientY } : null;
    swiped.current = false;
  };
  const onTouchMove = (e: ReactTouchEvent) => {
    const start = touchStart.current;
    const p = e.touches[0];
    if (!start || !p) return;
    if (Math.abs(p.clientX - start.x) > SWIPE_SLOP_PX || Math.abs(p.clientY - start.y) > SWIPE_SLOP_PX) {
      swiped.current = true;
    }
  };
  const handlePlay = () => {
    if (swiped.current) {
      swiped.current = false;
      return;
    }
    onPlay();
  };
  return (
    <div
      data-gallery-video="poster"
      className={`${className} overflow-hidden bg-neutral-900`}
      onClick={stop}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
    >
      {item.url ? (
        <StoreImage
          src={item.url}
          alt={item.alt}
          fill
          sizes={sizes}
          preload={priority}
          fetchPriority={priority ? 'high' : undefined}
          loading={priority ? undefined : loading}
          unoptimized={isSvgSrc(item.url)}
          className="object-cover"
          draggable={false}
        />
      ) : null}

      {!hidePlay && (
        <button
          type="button"
          onClick={handlePlay}
          aria-label={t('product.playVideoNamed', { alt: item.alt })}
          className="absolute inset-0 z-10 flex items-center justify-center focus-visible:outline-none group/play"
        >
          {/* The Play triangle points right in every direction (not mirrored in RTL). */}
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-black/55 text-white shadow-lg transition-transform group-hover/play:scale-105 group-focus-visible/play:ring-4 group-focus-visible/play:ring-white/80">
            <Play className="h-7 w-7 translate-x-[2px] fill-current" aria-hidden="true" />
          </span>
        </button>
      )}

      {duration && (
        <span
          dir="ltr"
          className="pointer-events-none absolute bottom-2 end-2 z-10 rounded bg-black/65 px-1.5 py-0.5 text-xs font-medium tabular-nums text-white"
        >
          {duration}
        </span>
      )}

      {badge}
      {overlay}
    </div>
  );
}
