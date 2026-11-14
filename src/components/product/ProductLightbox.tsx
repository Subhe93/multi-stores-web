'use client';

import { useEffect, useRef, type TouchEvent as ReactTouchEvent } from 'react';
import { createPortal } from 'react-dom';
import { useTranslations } from 'next-intl';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { lockScroll } from '@/lib/scrollLock';
import type { GalleryItem } from '@/lib/productVideo';
import { holdAutoplay } from '@/lib/videoAutoplay';
import { ProductVideoSlide } from './video/ProductVideoSlide';
import { LightboxImage } from './LightboxImage';

// Full-screen product media viewer for products WITH videos: the monolith's
// ProductMediaGallery and each product-gallery block layout. A product
// without videos keeps the pre-video viewers (the monolith's inline
// lightbox; no viewer in the non-classic block layouts), so its markup and
// behaviour do not change.
// Portalled to <body> (M94): an ancestor of a gallery (sticky column,
// reveal/transform wrapper) creates its own stacking context, which kept an
// inline overlay under later page elements such as the bundle cards. The
// portal leaves the page's `dir` element, so the caller passes the direction
// and the arrows (logical inset-s / inset-e, mirrored icons) and arrow keys
// follow it. Video items play here too (lightbox hand-off: the clip the
// viewer was opened on starts at `startAt`).

export interface ProductLightboxProps {
  items: GalleryItem[];
  index: number;
  onIndexChange(index: number): void;
  onClose(): void;
  /** Store slug: YouTube / Vimeo embeds load only with this store's consent. */
  storeSlug?: string;
  /** Reading direction of the page the gallery sits in. */
  dir?: 'ltr' | 'rtl';
  /** The video the viewer was opened on; it starts playing when shown. */
  autoStartId?: string | null;
  /** Seconds that video resumes from. */
  startAt?: number;
}

/** A swipe that starts inside a started player (native controls) is the player's. */
function inVideo(target: EventTarget | null): boolean {
  return target instanceof Element && !!target.closest('[data-gallery-video="player"]');
}

/** A playing video or embed has focus: arrow keys seek / belong to the player. */
function mediaFocused(): boolean {
  const el = typeof document !== 'undefined' ? document.activeElement : null;
  return !!el && (el.tagName === 'VIDEO' || el.tagName === 'IFRAME');
}

export function ProductLightbox({
  items,
  index,
  onIndexChange,
  onClose,
  storeSlug = '',
  dir = 'ltr',
  autoStartId = null,
  startAt,
}: ProductLightboxProps) {
  const t = useTranslations();
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const touchInVideo = useRef(false);
  // A completed swipe fires a click right after touchend on mobile; this flag
  // suppresses that click so swiping never closes the viewer.
  const didSwipe = useRef(false);

  const count = items.length;
  const rtl = dir === 'rtl';

  function goPrev() {
    if (index > 0) onIndexChange(index - 1);
  }
  function goNext() {
    if (index < count - 1) onIndexChange(index + 1);
  }

  // Muted autoplay videos on the page pause while the viewer is open
  // (nothing autoplays inside it).
  useEffect(() => holdAutoplay(), []);

  // Lock page scroll while open (lib/scrollLock: robust on iOS and with
  // <html overflow-x: clip>; restores the scroll position on close).
  useEffect(() => lockScroll(), []);

  // Escape closes; the arrow keys move along the reading direction, except
  // while a video / embed has focus (they seek there).
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (mediaFocused()) return;
      if (e.key === (rtl ? 'ArrowRight' : 'ArrowLeft')) goPrev();
      else if (e.key === (rtl ? 'ArrowLeft' : 'ArrowRight')) goNext();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  });

  const current = items[index] ?? items[0];
  if (!current || typeof document === 'undefined') return null;

  function handleTouchStart(e: ReactTouchEvent) {
    touchInVideo.current = inVideo(e.target);
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  }

  function handleTouchEnd(e: ReactTouchEvent) {
    if (touchInVideo.current) return;
    const deltaX = e.changedTouches[0].clientX - touchStartX.current;
    const deltaY = e.changedTouches[0].clientY - touchStartY.current;
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
      didSwipe.current = true;
      // Swiping towards the start of the line shows the next item.
      const towardStart = rtl ? deltaX > 0 : deltaX < 0;
      if (towardStart) goNext();
      else goPrev();
    }
  }

  function handleBackdropClick() {
    if (didSwipe.current) {
      didSwipe.current = false;
      return;
    }
    onClose();
  }

  const isVideo = current.kind === 'video';
  const ratio = isVideo && current.width && current.height ? current.width / current.height : 16 / 9;

  return createPortal(
    <div
      dir={dir}
      className="fixed inset-0 z-100 bg-black/90 flex items-center justify-center p-4 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200"
      onClick={handleBackdropClick}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      role="dialog"
      aria-modal="true"
      aria-label={isVideo ? t('product.mediaViewer') : t('product.imageViewer')}
    >
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        className="absolute top-4 inset-e-4 z-10 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
        aria-label={t('common.close')}
      >
        <X className="w-5 h-5" />
      </button>

      {current.kind === 'video' ? (
        <div
          className="relative isolate max-h-[90vh] max-w-[92vw] overflow-hidden rounded-lg bg-black"
          style={{ width: `min(92vw, calc(90vh * ${ratio.toFixed(4)}))`, aspectRatio: ratio.toFixed(4) }}
          onClick={(e) => { e.stopPropagation(); didSwipe.current = false; }}
        >
          <ProductVideoSlide
            key={current.id}
            // Nothing autoplays in the viewer: always user-initiated.
            item={current.autoplay ? { ...current, autoplay: false } : current}
            storeSlug={storeSlug}
            sizes="92vw"
            autoStart={current.id === autoStartId}
            startAt={current.id === autoStartId ? startAt : undefined}
          />
        </div>
      ) : (
        // A spinner (over the page's already-loaded rendition, when there is
        // one) shows until the full-size image has loaded.
        <LightboxImage
          key={current.url}
          src={current.url}
          sizes="92vw"
          alt={current.alt}
          className="max-h-[90vh] max-w-[92vw] object-contain select-none"
          onClick={(e) => { e.stopPropagation(); didSwipe.current = false; }}
          loadingLabel={t('common.loading')}
        />
      )}

      {count > 1 && (
        <>
          {index > 0 && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); goPrev(); }}
              className="absolute inset-s-4 top-1/2 -translate-y-1/2 z-10 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
              aria-label={t('product.previousImage')}
            >
              <ChevronLeft className="w-6 h-6 rtl:rotate-180" />
            </button>
          )}
          {index < count - 1 && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); goNext(); }}
              className="absolute inset-e-4 top-1/2 -translate-y-1/2 z-10 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
              aria-label={t('product.nextImage')}
            >
              <ChevronRight className="w-6 h-6 rtl:rotate-180" />
            </button>
          )}
          <span
            dir="ltr"
            className="absolute bottom-5 left-1/2 -translate-x-1/2 px-3 py-1 text-sm font-semibold text-white bg-white/10 rounded-full backdrop-blur-sm"
          >
            {index + 1} / {count}
          </span>
        </>
      )}
    </div>,
    document.body,
  );
}

export { readDirection } from './readDirection';
