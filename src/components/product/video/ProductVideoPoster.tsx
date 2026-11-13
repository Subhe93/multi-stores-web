import type { ReactNode, SyntheticEvent } from 'react';
import { useTranslations } from 'next-intl';
import { Play } from 'lucide-react';
import { StoreImage } from '@/components/StoreImage';
import { isSvgSrc } from '@/lib/storeMedia';
import { formatVideoDuration, type GalleryVideoItem } from '@/lib/productVideo';

// Static poster + Play button of a product video. No state and no effects:
// it renders on the server like an image slide, and nothing heavy (no
// <video>, no iframe, no player chunk) exists until the visitor clicks Play.

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
  /** Extra layer over the poster (consent notice, "unavailable" chip). */
  overlay?: ReactNode;
}

// Gallery containers handle swipe, click-to-lightbox and hover zoom; a video
// tile keeps those gestures to itself so Play is never hijacked.
const stop = (e: SyntheticEvent) => e.stopPropagation();

export function ProductVideoPoster({
  item,
  onPlay,
  priority = false,
  sizes,
  className = 'absolute inset-0',
  hidePlay = false,
  overlay,
}: ProductVideoPosterProps) {
  const t = useTranslations();
  const duration = formatVideoDuration(item.durationS);
  return (
    <div
      data-gallery-video=""
      className={`${className} overflow-hidden bg-neutral-900`}
      onClick={stop}
      onPointerDown={stop}
      onPointerUp={stop}
      onTouchStart={stop}
      onTouchEnd={stop}
    >
      {item.url ? (
        <StoreImage
          src={item.url}
          alt={item.alt}
          fill
          sizes={sizes}
          preload={priority}
          fetchPriority={priority ? 'high' : undefined}
          loading={priority ? undefined : 'eager'}
          unoptimized={isSvgSrc(item.url)}
          className="object-cover"
          draggable={false}
        />
      ) : null}

      {!hidePlay && (
        <button
          type="button"
          onClick={onPlay}
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

      {overlay}
    </div>
  );
}
