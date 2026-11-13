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

import { useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, ZoomIn } from 'lucide-react';
import { StoreImage } from '@/components/StoreImage';
import { ProductGallery } from '@/components/product/ProductGallery';
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

const ASPECT: Record<Aspect, string> = {
  square: 'aspect-square',
  portrait: 'aspect-[3/4]',
  landscape: 'aspect-[4/3]',
};

export function ProductGalleryMagic(props: SectionRenderProps) {
  const { settings, locale } = props;
  const layout: Layout = LAYOUTS.includes(settings.layout as Layout) ? (settings.layout as Layout) : 'main-thumbnails';
  const aspect: Aspect = (settings.aspect as Aspect) in ASPECT ? (settings.aspect as Aspect) : 'square';
  const enableZoom = settings.enable_zoom !== false;

  const state = useBlockState(props);
  const [zoom, setZoom] = useState<{ x: number; y: number } | null>(null);
  const mainRef = useRef<HTMLDivElement>(null);
  // Designer app (M5.5): the live canvas takes the gallery's place, with the
  // lead image as a small thumbnail above it (NPP layout). The form lives in
  // another block; both share the page's session.
  const designer = useDesignerSession();

  if (!state) {
    return <B1Placeholder preview={isBlockPreview(props)} locale={locale} label={{ en: 'Product gallery', ar: 'معرض المنتج' }} />;
  }

  const images = state.galleryImages;
  const active = Math.min(state.activeGalleryIndex, Math.max(images.length - 1, 0));
  const setActive = state.setActiveGalleryIndex;

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
      </section>
    );
  }

  // The monolith's gallery; also the empty state of every layout.
  if (layout === 'classic' || images.length === 0) {
    return (
      <section className="min-w-0">
        <ProductGallery
          images={images}
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
    const img = images[index];
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
      </div>
    );
  };

  if (layout === 'grid' || layout === 'stacked') {
    const grid = layout === 'grid';
    return (
      <section className={grid ? 'grid grid-cols-2 gap-3' : 'space-y-3'}>
        {images.map((img, i) => (
          <div
            key={img.url}
            className={`relative w-full overflow-hidden ${ASPECT[aspect]}`}
            style={{
              borderRadius: 'var(--theme-radius-md)',
              border: '1px solid var(--theme-colors-border)',
            }}
          >
            <StoreImage
              src={img.url}
              alt={img.alt}
              fill
              sizes={grid ? '(min-width: 768px) 25vw, 50vw' : '(min-width: 768px) 50vw, 100vw'}
              preload={i === 0}
              fetchPriority={i === 0 ? 'high' : undefined}
              loading={i < (grid ? 2 : 1) ? 'eager' : undefined}
              unoptimized={isSvgSrc(img.url)}
              className="object-cover"
            />
          </div>
        ))}
      </section>
    );
  }

  if (layout === 'carousel') {
    return (
      <section className="relative">
        {renderMainImage(active)}
        {images.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => setActive((active - 1 + images.length) % images.length)}
              className="absolute top-1/2 -translate-y-1/2 left-2 size-9 rounded-full bg-white/90 shadow-sm flex items-center justify-center hover:bg-white"
              aria-label="Previous"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => setActive((active + 1) % images.length)}
              className="absolute top-1/2 -translate-y-1/2 right-2 size-9 rounded-full bg-white/90 shadow-sm flex items-center justify-center hover:bg-white"
              aria-label="Next"
            >
              <ChevronRight className="size-4" />
            </button>
            <div className="absolute bottom-3 inset-x-0 flex justify-center gap-1.5">
              {images.map((img, i) => (
                <button
                  key={img.url}
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
      </section>
    );
  }

  return (
    <section>
      {renderMainImage(active)}
      {images.length > 1 && (
        <div className="grid grid-cols-5 gap-2 mt-3">
          {images.slice(0, 10).map((img, i) => (
            <button
              key={img.url}
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
              <StoreImage
                src={img.url}
                alt={img.alt}
                fill
                sizes="(min-width: 768px) 10vw, 20vw"
                unoptimized={isSvgSrc(img.url)}
                className="object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
