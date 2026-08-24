'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronLeft, ChevronRight, Star, Maximize2, X } from 'lucide-react';

interface GalleryImage {
  id: string;
  url: string;
  alt?: string;
}

interface ProductGalleryProps {
  images: GalleryImage[];
  activeIndex?: number;
  onIndexChange?: (index: number) => void;
  /** Main-image aspect ratio; defaults to square (existing behavior). */
  aspect?: 'square' | 'portrait' | 'landscape';
}

const GALLERY_ASPECT: Record<string, string> = {
  square: 'aspect-square',
  portrait: 'aspect-[4/5]',
  landscape: 'aspect-[4/3]',
};

export function ProductGallery({ images, activeIndex, onIndexChange, aspect = 'square' }: ProductGalleryProps) {
  const t = useTranslations();
  const [internalIndex, setInternalIndex] = useState(0);
  const [isZooming, setIsZooming] = useState(false);
  const [zoomPos, setZoomPos] = useState({ x: 50, y: 50 });
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const mainRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
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
    if (selectedIndex < images.length - 1) setIndex(selectedIndex + 1);
  }, [selectedIndex, images.length, setIndex]);

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
  }, [images.length]); // eslint-disable-line react-hooks/exhaustive-deps

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
      if (e.key === 'ArrowLeft') goPrev();
      if (e.key === 'ArrowRight') goNext();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }); // eslint-disable-line react-hooks/exhaustive-deps

  // Lightbox: lock body scroll while open, and wire Escape / arrow keys.
  useEffect(() => {
    if (!lightboxOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setLightboxOpen(false);
      else if (e.key === 'ArrowLeft') goPrev();
      else if (e.key === 'ArrowRight') goNext();
    }
    window.addEventListener('keydown', handleKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', handleKey);
    };
  }, [lightboxOpen, selectedIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!images || images.length === 0) {
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

  const currentImage = images[selectedIndex] || images[0];
  const hasMultiple = images.length > 1;

  // Touch swipe handlers
  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  }

  function handleTouchEnd(e: React.TouchEvent) {
    const deltaX = e.changedTouches[0].clientX - touchStartX.current;
    const deltaY = e.changedTouches[0].clientY - touchStartY.current;
    // Only swipe if horizontal movement is dominant
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
      didSwipe.current = true;
      if (deltaX < 0) goNext();
      else goPrev();
    }
  }

  // Swallow the click that follows a swipe; let real taps through.
  function guardedClick(action: () => void) {
    return () => {
      if (didSwipe.current) {
        didSwipe.current = false;
        return;
      }
      action();
    };
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
        className={`relative ${GALLERY_ASPECT[aspect] || GALLERY_ASPECT.square} overflow-hidden rounded-2xl bg-gray-50 group cursor-crosshair select-none`}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onMouseMove={handleMouseMove}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={guardedClick(() => setLightboxOpen(true))}
      >
        {/* Product image */}
        <img
          key={currentImage.id}
          src={currentImage.url}
          alt={currentImage.alt ?? t('product.productImage')}
          className="h-full w-full object-cover transition-opacity duration-300"
          draggable={false}
        />

        {/* Zoom overlay (desktop hover) */}
        {isZooming && (
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
            {selectedIndex < images.length - 1 && (
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
          onClick={(e) => { e.stopPropagation(); setLightboxOpen(true); }}
          className="absolute top-3 right-3 z-20 w-9 h-9 rounded-full bg-white/80 backdrop-blur-sm shadow-lg flex items-center justify-center text-gray-700 hover:bg-white transition-all opacity-100 md:opacity-0 md:group-hover:opacity-100"
          aria-label={t('product.viewFullScreen')}
        >
          <Maximize2 className="w-4 h-4" />
        </button>

        {/* Image counter badge */}
        {hasMultiple && (
          <span className="absolute bottom-3 right-3 z-20 px-2.5 py-1 text-xs font-semibold text-white bg-black/50 rounded-full backdrop-blur-sm">
            {selectedIndex + 1} / {images.length}
          </span>
        )}

        {/* Dot indicators (mobile) */}
        {hasMultiple && images.length <= 8 && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex gap-1.5 md:hidden">
            {images.map((_, i) => (
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
            {images.map((image, index) => (
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
                <img
                  src={image.url}
                  alt={image.alt ?? `Thumbnail ${index + 1}`}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
                {index === 0 && (
                  <div className="absolute bottom-0.5 left-0.5 bg-amber-500 text-white rounded-full p-0.5">
                    <Star className="w-2.5 h-2.5 fill-current" />
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Full-screen lightbox */}
      {lightboxOpen && (
        <div
          className="fixed inset-0 z-100 bg-black/90 flex items-center justify-center p-4 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200"
          onClick={guardedClick(() => setLightboxOpen(false))}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          role="dialog"
          aria-modal="true"
          aria-label={t('product.imageViewer')}
        >
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setLightboxOpen(false); }}
            className="absolute top-4 right-4 z-10 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
            aria-label={t('common.close')}
          >
            <X className="w-5 h-5" />
          </button>

          <img
            src={currentImage.url}
            alt={currentImage.alt ?? t('product.productImage')}
            className="max-h-[90vh] max-w-[92vw] object-contain select-none"
            onClick={(e) => { e.stopPropagation(); didSwipe.current = false; }}
            draggable={false}
          />

          {hasMultiple && (
            <>
              {selectedIndex > 0 && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); goPrev(); }}
                  className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
                  aria-label={t('product.previousImage')}
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
              )}
              {selectedIndex < images.length - 1 && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); goNext(); }}
                  className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
                  aria-label={t('product.nextImage')}
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
              )}
              <span className="absolute bottom-5 left-1/2 -translate-x-1/2 px-3 py-1 text-sm font-semibold text-white bg-white/10 rounded-full backdrop-blur-sm">
                {selectedIndex + 1} / {images.length}
              </span>
            </>
          )}
        </div>
      )}
    </div>
  );
}
