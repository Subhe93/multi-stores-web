'use client';

// Component implementation. Definition lives in ProductGalleryMagic.tsx so the
// server-side theme registry resolves `.Component` to a ClientReference rather
// than swallowing the entire section object as opaque client data.
//
// Product layout wave 2 (B1): the gallery reads the page's shared product
// state, so its images follow the chosen variant (variant images, then the
// picked colour's `imageMap` image, then the product gallery) and the active
// image is the one every other block sees. The saved settings (`layout`,
// `aspect`, `enable_zoom`) keep their names and meaning; `classic` is the
// monolith product page's gallery (ProductGallery: swipe, zoom, lightbox).
//
// Product video: with `hasVideos` every layout reads `galleryMedia` (videos
// play inline; grid / stacked show a poster per video, one playing at a
// time; no zoom on a video) and opens the shared full-screen viewer
// (ProductLightbox). Without videos each layout renders the images exactly
// as before: no full-screen button, no click handler, and none of the video
// modules (they load through next/dynamic only when rendered).

import { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import { ChevronLeft, ChevronRight, Maximize2, ZoomIn } from 'lucide-react';
import { StoreImage } from '@/components/StoreImage';
import { ProductGallery } from '@/components/product/ProductGallery';
import { readDirection } from '@/components/product/readDirection';
import type { GalleryItem, GalleryVideoItem } from '@/lib/productVideo';
import { isSvgSrc, responsiveImgProps } from '@/lib/storeMedia';
import { DesignerCanvasSlot, useDesignerSession } from '@/components/designer/DesignerSession';
import type { SectionRenderProps } from '../../../types';
import { B1Placeholder, isBlockPreview, useBlockState } from './blocks/b1Shared';

type Layout = 'classic' | 'main-thumbnails' | 'grid' | 'stacked' | 'carousel';
type Aspect = 'square' | 'portrait' | 'landscape';

const LAYOUTS: Layout[] = ['classic', 'main-thumbnails', 'grid', 'stacked', 'carousel'];

/**
 * A layout row whose column holds this gallery in designer mode: the Classic
 * tree Row > Column > gallery. Matches the DOM SectionRenderer + the layout
 * containers build (wrapper [data-section-id] > inner div > container
 * [data-layout]).
 */
export const DESIGNER_ROW_SELECTOR =
  '[data-layout="row"]:has(>[data-section-id]>div>[data-layout="column"]>[data-section-id]>div>[data-designer-gallery])';

/**
 * Designer app, below 768px: the monolith (ProductDetailClient) collapses its
 * two columns (`contents`) and orders the items featured image -> title /
 * price -> canvas -> the rest (form, CTA...), 20px apart (gap-5). The same
 * here: the row's column wrappers and the gallery block collapse, so the
 * thumbnail, the canvas and the info blocks become items of the stacked row,
 * with the monolith's order values. From 768px nothing changes (two columns,
 * thumbnail above the canvas). Rows without a designer gallery never match.
 */
export const DESIGNER_MOBILE_CSS = (() => {
  const r = DESIGNER_ROW_SELECTOR;
  const collapse = [
    `${r}>[data-section-id]`,
    `${r}>[data-section-id]>div`,
    `${r}>[data-section-id]>div>[data-layout="column"]`,
    `${r} [data-section-id]:has(>div>[data-designer-gallery])`,
    `${r} [data-section-id]>div:has(>[data-designer-gallery])`,
    `${r} [data-designer-gallery]`,
  ];
  const summaryTop = ['product-title', 'product-price'].map(
    (key) => `${r} [data-layout="column"]>[data-section-key="${key}"]`,
  );
  return (
    '@media (max-width: 767px){' +
    `${r}{gap:20px}` +
    `${collapse.join(',')}{display:contents}` +
    `${r} [data-designer-thumb]{order:-3}` +
    `${summaryTop.join(',')}{order:-2}` +
    `${r} .designer-canvas-slot{order:-1}` +
    '}'
  );
})();

// Video-only modules: rendered (and so requested) only for products with
// videos. SSR stays on, so a poster is in the server HTML.
const ProductLightbox = dynamic(() => import('@/components/product/ProductLightbox').then((m) => m.ProductLightbox));
const ProductVideoList = dynamic(() => import('@/components/product/video/ProductVideoList').then((m) => m.ProductVideoList));
const ProductVideoSlide = dynamic(() => import('@/components/product/video/ProductVideoSlide').then((m) => m.ProductVideoSlide));
const ProductVideoThumbBadge = dynamic(() =>
  import('@/components/product/video/ProductVideoThumbBadge').then((m) => m.ProductVideoThumbBadge),
);

const ASPECT: Record<Aspect, string> = {
  square: 'aspect-square',
  portrait: 'aspect-[3/4]',
  landscape: 'aspect-[4/3]',
};

/**
 * Only one inline video plays at a time in a block gallery: starting a clip
 * remounts the one that was playing (its slide key changes), which unmounts
 * its player and brings back its poster. `stop` does the same on demand
 * (lightbox hand-off, variant change).
 */
function useOneVideoAtATime() {
  const [generation, setGeneration] = useState<Record<string, number>>({});
  const activeRef = useRef<string | null>(null);
  const callbacks = useRef(new Map<string, (playing: boolean) => void>());

  const stop = useCallback((id: string) => {
    if (activeRef.current === id) activeRef.current = null;
    setGeneration((g) => ({ ...g, [id]: (g[id] ?? 0) + 1 }));
  }, []);

  const handlePlaying = useCallback(
    (id: string, playing: boolean) => {
      if (playing) {
        const previous = activeRef.current;
        activeRef.current = id;
        if (previous && previous !== id) stop(previous);
      } else if (activeRef.current === id) {
        activeRef.current = null;
      }
    },
    [stop],
  );

  // Stable per-video callbacks so a slide's effects do not re-run each render.
  const callbackFor = (id: string) => {
    let cb = callbacks.current.get(id);
    if (!cb) {
      cb = (playing: boolean) => handlePlaying(id, playing);
      callbacks.current.set(id, cb);
    }
    return cb;
  };

  return {
    keyFor: (id: string) => `${id}:${generation[id] ?? 0}`,
    callbackFor,
    stop,
    activeRef,
  };
}

/** Full-screen button of the block layouts (audit gap 8); hover-revealed like the monolith's. */
function ExpandButton({ onOpen, className }: { onOpen(): void; className: string }) {
  const t = useTranslations();
  return (
    <button
      type="button"
      data-gallery-expand=""
      onClick={(e) => {
        e.stopPropagation();
        onOpen();
      }}
      aria-label={t('product.viewFullScreen')}
      className={`absolute z-20 rounded-full bg-white/80 backdrop-blur-sm shadow-lg flex items-center justify-center text-gray-700 hover:bg-white transition-all opacity-100 md:opacity-0 md:group-hover:opacity-100 focus-visible:opacity-100 ${className}`}
    >
      <Maximize2 className="size-4" />
    </button>
  );
}

/** Thumbnail of a video item: its poster (or a dark tile) with a Play mark. */
function VideoThumb({ item, sizes }: { item: GalleryVideoItem; sizes: string }) {
  return (
    <>
      {item.url ? (
        <StoreImage src={item.url} alt={item.alt} fill sizes={sizes} unoptimized={isSvgSrc(item.url)} className="object-cover" />
      ) : (
        <span className="absolute inset-0 bg-neutral-900" aria-hidden="true" />
      )}
      <ProductVideoThumbBadge durationS={item.durationS} />
    </>
  );
}

export function ProductGalleryMagic(props: SectionRenderProps) {
  const { settings, locale } = props;
  const layout: Layout = LAYOUTS.includes(settings.layout as Layout) ? (settings.layout as Layout) : 'main-thumbnails';
  const aspect: Aspect = (settings.aspect as Aspect) in ASPECT ? (settings.aspect as Aspect) : 'square';
  const enableZoom = settings.enable_zoom !== false;

  const state = useBlockState(props);
  const [zoom, setZoom] = useState<{ x: number; y: number } | null>(null);
  const mainRef = useRef<HTMLDivElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  // Designer app (M5.5): the live canvas takes the gallery's place, with the
  // lead image as a small thumbnail above it (NPP layout). The form lives in
  // another block; both share the page's session.
  const designer = useDesignerSession();
  // Full-screen viewer (shared ProductLightbox) and the inline videos.
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxDir, setLightboxDir] = useState<'ltr' | 'rtl'>('ltr');
  const [lightboxStart, setLightboxStart] = useState<{ id: string; at: number } | null>(null);
  const playerRef = useRef<HTMLVideoElement | null>(null);
  const videos = useOneVideoAtATime();

  // A variant change stops the inline video that plays (the page state also
  // jumps back to the first image).
  const variantKey = state?.hasVideos ? state.selectedVariantId ?? '' : '';
  const { activeRef: playingRef, stop: stopVideo } = videos;
  useEffect(() => {
    if (playingRef.current) stopVideo(playingRef.current);
  }, [variantKey, playingRef, stopVideo]);

  if (!state) {
    return <B1Placeholder preview={isBlockPreview(props)} locale={locale} label={{ en: 'Product gallery', ar: 'معرض المنتج' }} />;
  }

  const images = state.galleryImages;
  // Product video: the mixed list only when the product has videos;
  // otherwise every layout renders the images exactly as before.
  const hasVideos = state.hasVideos === true;
  const items: GalleryItem[] = hasVideos
    ? state.galleryMedia
    : images.map((img) => ({ kind: 'image' as const, id: img.id, url: img.url, alt: img.alt }));
  const count = items.length;
  const active = Math.min(state.activeGalleryIndex, Math.max(count - 1, 0));
  const setActive = state.setActiveGalleryIndex;
  const storeSlug = state.storeSlug || props.storeSlug || '';
  // Keys stay the image URL without videos (unchanged reconciliation).
  const keyOf = (item: GalleryItem) => (hasVideos ? item.id : item.url);

  const openLightbox = (index: number) => {
    const item = items[index];
    let start: { id: string; at: number } | null = null;
    // Only a clip the visitor already started continues in the viewer
    // (click-to-play, D3 / D4); otherwise it shows its poster + Play there.
    if (item?.kind === 'video' && videos.activeRef.current === item.id) {
      start = { id: item.id, at: playerRef.current?.currentTime ?? 0 };
      // The inline player goes back to its poster while the lightbox plays.
      videos.stop(item.id);
    }
    setLightboxStart(start);
    setLightboxDir(readDirection(sectionRef.current));
    setActive(index);
    setLightboxOpen(true);
  };

  const lightbox = lightboxOpen ? (
    <ProductLightbox
      items={items}
      index={active}
      onIndexChange={(i) => {
        // Leaving the hand-off clip: coming back shows its poster + Play.
        setLightboxStart(null);
        setActive(i);
      }}
      onClose={() => setLightboxOpen(false)}
      storeSlug={storeSlug}
      dir={lightboxDir}
      autoStartId={lightboxStart?.id}
      startAt={lightboxStart?.at}
    />
  ) : null;

  if (designer) {
    const featured = images[0];
    // Thumbnail spacing as the monolith (md:mb-4): none once the mobile
    // rules (DESIGNER_MOBILE_CSS) make both items of the stacked row.
    return (
      <section className="min-w-0" data-designer-gallery="">
        <style dangerouslySetInnerHTML={{ __html: DESIGNER_MOBILE_CSS }} />
        {featured && (
          // eslint-disable-next-line @next/next/no-img-element -- natural-ratio thumbnail; optimized srcset
          <img
            {...responsiveImgProps(featured.url, '270px')}
            alt={featured.alt}
            fetchPriority="high"
            data-designer-thumb=""
            className="mx-auto block h-auto w-full max-w-67.5 rounded-xl shadow-sm md:mb-4"
          />
        )}
        <DesignerCanvasSlot className="min-w-0 designer-canvas-slot" />
        {/* Decision D7: a designer product's videos sit below the canvas. */}
        {/* Phones: after the form and CTA (they edit the canvas above). */}
        {hasVideos && <ProductVideoList videos={state.productVideos} storeSlug={storeSlug} className="order-last md:order-0" />}
      </section>
    );
  }

  // The monolith's gallery; also the empty state of every layout.
  if (layout === 'classic' || images.length === 0) {
    return (
      <section className="min-w-0">
        <ProductGallery
          images={images}
          {...(hasVideos ? { items: state.galleryMedia, storeSlug } : {})}
          activeIndex={state.activeGalleryIndex}
          onIndexChange={setActive}
          aspect={aspect}
        />
      </section>
    );
  }

  function onMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (!enableZoom || !mainRef.current) return;
    const rect = mainRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setZoom({ x, y });
  }

  // Plain render helper rather than a component declared inside render, so
  // React does not treat it as a new element type (and remount) every render.
  const renderMainImage = (index: number) => {
    const img = items[index];
    if (img.kind === 'video') {
      // Video slide: poster + Play; plays inline, no zoom (index 0 is
      // always an image, so it never takes the LCP preload).
      return (
        <div
          ref={mainRef}
          className={`relative isolate overflow-hidden ${ASPECT[aspect]} group`}
          style={{
            borderRadius: 'var(--theme-radius-md)',
            border: '1px solid var(--theme-colors-border)',
          }}
        >
          <ProductVideoSlide
            key={videos.keyFor(img.id)}
            item={img}
            storeSlug={storeSlug}
            sizes="(min-width: 768px) 50vw, 100vw"
            playerRef={playerRef}
            onPlayingChange={videos.callbackFor(img.id)}
          />
          <ExpandButton onOpen={() => openLightbox(index)} className="top-3 end-3 size-9" />
        </div>
      );
    }
    // The lead image is the page's LCP: preload it at high priority.
    const lead = index === 0;
    return (
      <div
        ref={mainRef}
        className={`relative overflow-hidden ${ASPECT[aspect]} group`}
        style={{
          borderRadius: 'var(--theme-radius-md)',
          border: '1px solid var(--theme-colors-border)',
        }}
        onMouseMove={onMouseMove}
        onMouseLeave={() => setZoom(null)}
        onClick={hasVideos ? () => openLightbox(index) : undefined}
      >
        <StoreImage
          key={img.url}
          src={img.url}
          alt={img.alt}
          fill
          sizes="(min-width: 768px) 50vw, 100vw"
          preload={lead}
          fetchPriority={lead ? 'high' : undefined}
          unoptimized={isSvgSrc(img.url)}
          className="object-cover transition-transform duration-300"
          style={
            enableZoom && zoom
              ? {
                  transform: 'scale(1.6)',
                  transformOrigin: `${zoom.x}% ${zoom.y}%`,
                }
              : undefined
          }
        />
        {enableZoom && (
          <div
            className="absolute top-3 right-3 size-7 rounded-full bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            aria-hidden
          >
            <ZoomIn className="size-3.5" />
          </div>
        )}
        {hasVideos && <ExpandButton onOpen={() => openLightbox(index)} className="bottom-3 end-3 size-9" />}
      </div>
    );
  };

  if (layout === 'grid' || layout === 'stacked') {
    const grid = layout === 'grid';
    const tileSizes = grid ? '(min-width: 768px) 25vw, 50vw' : '(min-width: 768px) 50vw, 100vw';
    // The first images load eagerly; video tiles do not count (critic A5),
    // so a video at slot 1 does not push the second image out of it.
    const eagerImages = grid ? 2 : 1;
    let imageOrdinal = 0;
    return (
      <section ref={sectionRef} className={grid ? 'grid grid-cols-2 gap-3' : 'space-y-3'}>
        {items.map((img, i) => (
          <div
            key={keyOf(img)}
            className={`relative w-full overflow-hidden ${ASPECT[aspect]}`}
            style={{
              borderRadius: 'var(--theme-radius-md)',
              border: '1px solid var(--theme-colors-border)',
            }}
            onClick={hasVideos && img.kind === 'image' ? () => openLightbox(i) : undefined}
          >
            {img.kind === 'video' ? (
              // A poster with Play per video; one plays at a time.
              <ProductVideoSlide
                key={videos.keyFor(img.id)}
                item={img}
                storeSlug={storeSlug}
                sizes={tileSizes}
                playerRef={playerRef}
                onPlayingChange={videos.callbackFor(img.id)}
              />
            ) : (
              <StoreImage
                src={img.url}
                alt={img.alt}
                fill
                sizes={tileSizes}
                preload={i === 0}
                fetchPriority={i === 0 ? 'high' : undefined}
                loading={imageOrdinal++ < eagerImages ? 'eager' : undefined}
                unoptimized={isSvgSrc(img.url)}
                className="object-cover"
              />
            )}
            {/* Top corner on a video: its native controls sit at the bottom. */}
            {hasVideos && (
              <ExpandButton onOpen={() => openLightbox(i)} className={`${img.kind === 'video' ? 'top-2' : 'bottom-2'} end-2 size-8`} />
            )}
          </div>
        ))}
        {lightbox}
      </section>
    );
  }

  if (layout === 'carousel') {
    return (
      <section ref={sectionRef} className="relative">
        {renderMainImage(active)}
        {count > 1 && (
          <>
            <button
              type="button"
              onClick={() => setActive((active - 1 + count) % count)}
              className="absolute top-1/2 -translate-y-1/2 left-2 size-9 rounded-full bg-white/90 shadow-sm flex items-center justify-center hover:bg-white"
              aria-label="Previous"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => setActive((active + 1) % count)}
              className="absolute top-1/2 -translate-y-1/2 right-2 size-9 rounded-full bg-white/90 shadow-sm flex items-center justify-center hover:bg-white"
              aria-label="Next"
            >
              <ChevronRight className="size-4" />
            </button>
            <div className="absolute bottom-3 inset-x-0 flex justify-center gap-1.5">
              {items.map((img, i) => (
                <button
                  key={keyOf(img)}
                  type="button"
                  onClick={() => setActive(i)}
                  className="size-1.5 rounded-full transition-all"
                  style={{
                    backgroundColor: i === active ? 'var(--theme-colors-primary)' : 'rgba(255,255,255,0.7)',
                    width: i === active ? '20px' : '6px',
                  }}
                  aria-label={`Image ${i + 1}`}
                />
              ))}
            </div>
          </>
        )}
        {lightbox}
      </section>
    );
  }

  return (
    <section ref={sectionRef}>
      {renderMainImage(active)}
      {count > 1 && (
        <div className="grid grid-cols-5 gap-2 mt-3">
          {items.slice(0, 10).map((img, i) => (
            <button
              key={keyOf(img)}
              type="button"
              onClick={() => setActive(i)}
              aria-label={`Image ${i + 1}`}
              aria-pressed={i === active}
              className="relative block w-full aspect-square overflow-hidden transition-all"
              style={{
                borderRadius: 'var(--theme-radius-sm)',
                outline:
                  i === active
                    ? '2px solid var(--theme-colors-primary)'
                    : '1px solid var(--theme-colors-border)',
                outlineOffset: i === active ? '1px' : '0',
              }}
            >
              {img.kind === 'video' ? (
                <VideoThumb item={img} sizes="(min-width: 768px) 10vw, 20vw" />
              ) : (
                <StoreImage
                  src={img.url}
                  alt={img.alt}
                  fill
                  sizes="(min-width: 768px) 10vw, 20vw"
                  unoptimized={isSvgSrc(img.url)}
                  className="object-cover"
                />
              )}
            </button>
          ))}
        </div>
      )}
      {lightbox}
    </section>
  );
}
