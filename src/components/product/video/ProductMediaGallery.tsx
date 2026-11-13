'use client';

// Product gallery for a product WITH videos (product video, contract 6.5):
// images and videos in one slide list, a poster + Play per video, the shared
// full-screen viewer (ProductLightbox). ProductGallery loads this module
// through next/dynamic only when the product has videos, so a product without
// videos keeps the pre-video image gallery and never requests this chunk.

import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronLeft, ChevronRight, Star, Maximize2 } from 'lucide-react';
import { StoreImage } from '@/components/StoreImage';
import { isSvgSrc } from '@/lib/storeMedia';
import type { GalleryItem, GalleryVideoItem } from '@/lib/productVideo';
import { ProductLightbox } from '../ProductLightbox';
import { readDirection } from '../readDirection';
import { ProductVideoSlide } from './ProductVideoSlide';
import { ProductVideoThumbBadge } from './ProductVideoThumbBadge';

interface GalleryImage {
  id: string;
  url: string;
  alt?: string;
}

export interface ProductMediaGalleryProps {
  images: GalleryImage[];
  /** Images and videos in gallery order. */
  items: GalleryItem[];
  /** Store slug: YouTube / Vimeo embeds load only with this store's consent. */
  storeSlug?: string;
  activeIndex?: number;
  onIndexChange?: (index: number) => void;
  /** Main-image aspect ratio; defaults to square. */
  aspect?: 'square' | 'portrait' | 'landscape';
}

const GALLERY_ASPECT: Record<string, string> = {
  square: 'aspect-square',
  portrait: 'aspect-[4/5]',
  landscape: 'aspect-[4/3]',
};

type GalleryMedia = GalleryImage | GalleryItem;

function isVideoItem(item: GalleryMedia | undefined): item is GalleryVideoItem {
  return !!item && (item as GalleryItem).kind === 'video';
}

/** A playing video or embed has focus: arrow keys seek / belong to the player. */
function mediaFocused(): boolean {
  const el = document.activeElement;
  return !!el && (el.tagName === 'VIDEO' || el.tagName === 'IFRAME');
}

export function ProductMediaGallery({ items, storeSlug = '', activeIndex, onIndexChange, aspect = 'square' }: ProductMediaGalleryProps) {
  const t = useTranslations();
  const media: GalleryMedia[] = items;
  const [internalIndex, setInternalIndex] = useState(0);
  const [isZooming, setIsZooming] = useState(false);
  const [zoomPos, setZoomPos] = useState({ x: 50, y: 50 });
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxDir, setLightboxDir] = useState<'ltr' | 'rtl'>('ltr');
  // Lightbox hand-off of a video: the clip it was opened on and where the
  // inline player was. Bumping `inlineGen` remounts the inline slide, which
  // unmounts its player (back to the poster) while the lightbox plays.
  const [lightboxStart, setLightboxStart] = useState<{ id: string; at: number } | null>(null);
  const [inlineGen, setInlineGen] = useState(0);
  const playerRef = useRef<HTMLVideoElement | null>(null);
  // Whether the inline player is mounted (the visitor pressed Play). Only a
  // playing clip continues in the lightbox (click-to-play, D3 / D4).
  const inlinePlaying = useRef(false);
  const handleInlinePlaying = useCallback((playing: boolean) => {
    inlinePlaying.current = playing;
  }, []);

  const mainRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const touchInVideo = useRef(false);
  // A completed swipe fires a click right after touchend on mobile — this flag
  // suppresses that click so swiping never opens/closes the lightbox.
  const didSwipe = useRef(false);

  // Use controlled or internal index
  const selectedIndex = activeIndex !== undefined ? activeIndex : internalIndex;

  const setIndex = useCallback((idx: number) => {
    setInternalIndex(idx);
    onIndexChange?.(idx);
  }, [onIndexChange]);

  const goPrev = useCallback(() => {
    if (selectedIndex > 0) setIndex(selectedIndex - 1);
  }, [selectedIndex, setIndex]);

  const goNext = useCallback(() => {
    if (selectedIndex < media.length - 1) setIndex(selectedIndex + 1);
  }, [selectedIndex, media.length, setIndex]);

  // Sync internal index when activeIndex prop changes
  useEffect(() => {
    if (activeIndex !== undefined) {
      setInternalIndex(activeIndex);
    }
  }, [activeIndex]);

  // Reset index when images change
  useEffect(() => {
    setInternalIndex(0);
    onIndexChange?.(0);
  }, [media.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-scroll active thumbnail into view
  useEffect(() => {
    if (!thumbRef.current) return;
    const activeThumb = thumbRef.current.children[selectedIndex] as HTMLElement;
    if (activeThumb) {
      activeThumb.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [selectedIndex]);

  // Keyboard navigation
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (!mainRef.current?.closest(':hover')) return;
      if (mediaFocused()) return;
      if (e.key === 'ArrowLeft') goPrev();
      if (e.key === 'ArrowRight') goNext();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  });

  if (!media || media.length === 0) {
    return (
      <div className={`${GALLERY_ASPECT[aspect] || GALLERY_ASPECT.square} overflow-hidden rounded-2xl bg-gray-100 flex items-center justify-center text-gray-300`}>
        <svg className="h-20 w-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1}
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
      </div>
    );
  }

  const currentImage = media[selectedIndex] || media[0];
  const currentIsVideo = isVideoItem(currentImage);
  const hasMultiple = media.length > 1;

  // Full-screen viewer (shared ProductLightbox). On a video, the inline
  // player hands its position over and goes back to its poster.
  function openLightbox() {
    let start: { id: string; at: number } | null = null;
    if (isVideoItem(currentImage) && inlinePlaying.current) {
      start = { id: currentImage.id, at: playerRef.current?.currentTime ?? 0 };
      setInlineGen((g) => g + 1);
    }
    setLightboxStart(start);
    setLightboxDir(readDirection(mainRef.current));
    setLightboxOpen(true);
  }

  // Touch swipe handlers
  function handleTouchStart(e: React.TouchEvent) {
    // A video tile keeps its gestures (Play, scrubbing): no slide swipe.
    touchInVideo.current = e.target instanceof Element && !!e.target.closest('[data-gallery-video]');
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  }

  function handleTouchEnd(e: React.TouchEvent) {
    if (touchInVideo.current) return;
    const deltaX = e.changedTouches[0].clientX - touchStartX.current;
    const deltaY = e.changedTouches[0].clientY - touchStartY.current;
    // Only swipe if horizontal movement is dominant
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
      didSwipe.current = true;
      if (deltaX < 0) goNext();
      else goPrev();
    }
  }

  // Main slot tap: the full-screen viewer. A completed swipe fires a click
  // right after touchend on mobile; that click is swallowed.
  function handleMainClick() {
    if (didSwipe.current) {
      didSwipe.current = false;
      return;
    }
    openLightbox();
  }

  // Zoom handlers (desktop only)
  function handleMouseMove(e: React.MouseEvent) {
    if (!mainRef.current) return;
    const rect = mainRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setZoomPos({ x, y });
  }

  function handleMouseEnter() {
    // No hover zoom on a video slide.
    if (currentIsVideo) return;
    // Only enable zoom if pointer is fine (mouse, not touch)
    if (window.matchMedia('(pointer: fine)').matches) {
      setIsZooming(true);
    }
  }

  function handleMouseLeave() {
    setIsZooming(false);
  }

  return (
    // min-w-0 keeps the thumbnail strip's intrinsic width (72px × count) from
    // propagating up and widening the page on mobile.
    <div className="flex flex-col gap-3 min-w-0 max-w-full">
      {/* Main image container */}
      <div
        ref={mainRef}
        className={`relative ${GALLERY_ASPECT[aspect] || GALLERY_ASPECT.square} overflow-hidden rounded-2xl bg-gray-50 group ${currentIsVideo ? 'cursor-default' : 'cursor-crosshair'} select-none`}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onMouseMove={handleMouseMove}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handleMainClick}
      >
        {isVideoItem(currentImage) ? (
          // Video slide: poster + Play (server-rendered); the player mounts on
          // Play. Its tile stops clicks, so tapping it never opens the
          // lightbox. Index 0 is always an image (D6): no preload here.
          <ProductVideoSlide
            key={`${currentImage.id}:${inlineGen}`}
            item={currentImage}
            storeSlug={storeSlug}
            sizes="(min-width: 768px) 50vw, 100vw"
            playerRef={playerRef}
            onPlayingChange={handleInlinePlaying}
          />
        ) : (
          /* Product image — the lead image is the page's LCP, so preload it. */
          <StoreImage
            key={currentImage.id}
            src={currentImage.url}
            alt={currentImage.alt ?? t('product.productImage')}
            fill
            sizes="(min-width: 768px) 50vw, 100vw"
            preload={selectedIndex === 0}
            fetchPriority={selectedIndex === 0 ? 'high' : undefined}
            loading={selectedIndex === 0 ? undefined : 'eager'}
            unoptimized={isSvgSrc(currentImage.url)}
            className="object-cover transition-opacity duration-300"
            draggable={false}
          />
        )}

        {/* Zoom overlay (desktop hover) */}
        {isZooming && !currentIsVideo && (
          <div
            className="absolute inset-0 z-10 pointer-events-none"
            style={{
              backgroundImage: `url(${currentImage.url})`,
              backgroundSize: '250%',
              backgroundPosition: `${zoomPos.x}% ${zoomPos.y}%`,
              backgroundRepeat: 'no-repeat',
            }}
          />
        )}

        {/* Prev/Next arrows */}
        {hasMultiple && (
          <>
            {selectedIndex > 0 && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); goPrev(); }}
                className="absolute left-3 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-white/80 backdrop-blur-sm shadow-lg flex items-center justify-center text-gray-700 hover:bg-white transition-all opacity-100 md:opacity-0 md:group-hover:opacity-100"
                aria-label={t('product.previousImage')}
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}
            {selectedIndex < media.length - 1 && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); goNext(); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-white/80 backdrop-blur-sm shadow-lg flex items-center justify-center text-gray-700 hover:bg-white transition-all opacity-100 md:opacity-0 md:group-hover:opacity-100"
                aria-label={t('product.nextImage')}
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            )}
          </>
        )}

        {/* Expand to full-screen lightbox */}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); openLightbox(); }}
          className="absolute top-3 right-3 z-20 w-9 h-9 rounded-full bg-white/80 backdrop-blur-sm shadow-lg flex items-center justify-center text-gray-700 hover:bg-white transition-all opacity-100 md:opacity-0 md:group-hover:opacity-100"
          aria-label={t('product.viewFullScreen')}
        >
          <Maximize2 className="w-4 h-4" />
        </button>

        {/* Image counter badge */}
        {hasMultiple && (
          <span className="absolute bottom-3 right-3 z-20 px-2.5 py-1 text-xs font-semibold text-white bg-black/50 rounded-full backdrop-blur-sm">
            {selectedIndex + 1} / {media.length}
          </span>
        )}

        {/* Dot indicators (mobile) */}
        {hasMultiple && media.length <= 8 && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex gap-4 md:hidden" /* gap-4: dot centres 24px apart (touch-target spacing) */>
            {media.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={(e) => { e.stopPropagation(); setIndex(i); }}
                className={`w-2 h-2 rounded-full transition-all ${
                  i === selectedIndex
                    ? 'bg-white scale-110'
                    : 'bg-white/50'
                }`}
                aria-label={t('product.goToImage', { number: i + 1 })}
              />
            ))}
          </div>
        )}
      </div>

      {/* Thumbnail strip */}
      {hasMultiple && (
        <div className="relative group/thumbs min-w-0 max-w-full">
          <div
            ref={thumbRef}
            className="flex gap-2 overflow-x-auto scrollbar-none pb-1 scroll-smooth"
          >
            {media.map((image, index) => (
              <button
                key={image.id}
                type="button"
                onClick={() => setIndex(index)}
                aria-label={t('product.viewImage', { number: index + 1 })}
                className={`relative shrink-0 w-[72px] h-[72px] overflow-hidden rounded-xl border-2 transition-all duration-200 ${
                  index === selectedIndex
                    ? 'opacity-100 scale-100 shadow-sm'
                    : 'border-transparent opacity-50 hover:opacity-100 hover:border-gray-200'
                }`}
                style={
                  index === selectedIndex
                    ? { borderColor: 'var(--store-primary, #2563eb)' }
                    : undefined
                }
              >
                {isVideoItem(image) ? (
                  <>
                    {image.url ? (
                      <StoreImage
                        src={image.url}
                        alt={image.alt}
                        fill
                        sizes="72px"
                        unoptimized={isSvgSrc(image.url)}
                        className="object-cover"
                      />
                    ) : (
                      <span className="absolute inset-0 bg-neutral-900" aria-hidden="true" />
                    )}
                    <ProductVideoThumbBadge durationS={image.durationS} />
                  </>
                ) : (
                  <StoreImage
                    src={image.url}
                    alt={image.alt ?? `Thumbnail ${index + 1}`}
                    fill
                    sizes="72px"
                    unoptimized={isSvgSrc(image.url)}
                    className="object-cover"
                  />
                )}
                {index === 0 && !isVideoItem(image) && (
                  <div className="absolute bottom-0.5 left-0.5 bg-amber-500 text-white rounded-full p-0.5">
                    <Star className="w-2.5 h-2.5 fill-current" />
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Full-screen lightbox (ProductLightbox, shared with the block
          gallery layouts): portalled to <body>, so no ancestor stacking
          context (sticky column, reveal/transform wrapper) keeps it under
          later page elements such as the bundle cards. It exists only after
          a click. */}
      {lightboxOpen && (
        <ProductLightbox
          items={media.map((m): GalleryItem =>
            isVideoItem(m)
              ? m
              : { kind: 'image', id: m.id, url: m.url, alt: m.alt ?? t('product.productImage') },
          )}
          index={selectedIndex}
          onIndexChange={(i) => {
            // Leaving the hand-off clip: coming back shows its poster + Play.
            setLightboxStart(null);
            setIndex(i);
          }}
          onClose={() => setLightboxOpen(false)}
          storeSlug={storeSlug}
          dir={lightboxDir}
          autoStartId={lightboxStart?.id}
          startAt={lightboxStart?.at}
        />
      )}
    </div>
  );
}
