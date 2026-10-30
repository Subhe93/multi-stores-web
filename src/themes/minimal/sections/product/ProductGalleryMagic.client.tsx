'use client';

// Component implementation. Definition lives in ProductGalleryMagic.tsx so the
// server-side theme registry resolves `.Component` to a ClientReference rather
// than swallowing the entire section object as opaque client data.

import { useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, ZoomIn } from 'lucide-react';
import { resolveMediaUrl } from '@/lib/api';
import { StoreImage } from '@/components/StoreImage';
import { isSvgSrc, responsiveImgProps } from '@/lib/storeMedia';
import { DesignerCanvasSlot, useDesignerSession } from '@/components/designer/DesignerSession';
import type { SectionRenderProps } from '../../../types';

type Layout = 'main-thumbnails' | 'grid' | 'stacked' | 'carousel';
type Aspect = 'square' | 'portrait' | 'landscape';

const ASPECT: Record<Aspect, string> = {
  square: 'aspect-square',
  portrait: 'aspect-[3/4]',
  landscape: 'aspect-[4/3]',
};

function PreviewPlaceholder({ label, hint }: { label: string; hint: string }) {
  return (
    <div
      className="text-center py-12 px-4"
      style={{
        backgroundColor: 'var(--theme-colors-surface)',
        border: '1px dashed var(--theme-colors-border)',
        borderRadius: 'var(--theme-radius-md)',
      }}
    >
      <div className="text-xs uppercase tracking-wide text-[var(--theme-colors-muted)] mb-1">
        {label}
      </div>
      <p className="text-xs text-[var(--theme-colors-muted)]">{hint}</p>
    </div>
  );
}

export function ProductGalleryMagic({ settings, product }: SectionRenderProps) {
  const layout = (settings.layout as Layout) || 'main-thumbnails';
  const aspect = (settings.aspect as Aspect) || 'square';
  const enableZoom = settings.enable_zoom !== false;

  const images = (product?.images || []).filter((i) => !!i.url);
  const [active, setActive] = useState(0);
  const [zoom, setZoom] = useState<{ x: number; y: number } | null>(null);
  const mainRef = useRef<HTMLDivElement>(null);
  // Designer app (M5.5): the live canvas takes the gallery's place, with the
  // product's featured image as a small thumbnail above it (NPP layout). The
  // form lives in the add-to-cart section; both share the page's session.
  const designer = useDesignerSession();

  if (designer && product) {
    const featured = images[0];
    return (
      <section className="space-y-4">
        {featured && (
          // eslint-disable-next-line @next/next/no-img-element -- store media, as the gallery itself renders it
          <img
            {...responsiveImgProps(resolveMediaUrl(featured.url), '270px')}
            alt={featured.alt_text || ''}
            fetchPriority="high"
            className="mx-auto block h-auto w-full max-w-67.5 object-cover"
            style={{ borderRadius: 'var(--theme-radius-md)', boxShadow: 'var(--theme-shadow-sm)' }}
          />
        )}
        <DesignerCanvasSlot />
      </section>
    );
  }

  if (!product || images.length === 0) {
    return (
      <PreviewPlaceholder
        label="Product gallery"
        hint={product ? 'This product has no images yet.' : 'Pick a sample product to preview.'}
      />
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
    const src = resolveMediaUrl(img.url);
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
          src={src}
          alt={img.alt_text || ''}
          fill
          sizes="(min-width: 768px) 50vw, 100vw"
          preload={lead}
          fetchPriority={lead ? 'high' : undefined}
          unoptimized={isSvgSrc(src)}
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

  if (layout === 'grid') {
    return (
      <section className="grid grid-cols-2 gap-3">
        {images.map((img, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={i}
            {...responsiveImgProps(resolveMediaUrl(img.url), '(min-width: 768px) 25vw, 50vw')}
            alt={img.alt_text || ''}
            fetchPriority={i === 0 ? 'high' : undefined}
            loading={i < 2 ? undefined : 'lazy'}
            className={`w-full ${ASPECT[aspect]} object-cover`}
            style={{
              borderRadius: 'var(--theme-radius-md)',
              border: '1px solid var(--theme-colors-border)',
            }}
          />
        ))}
      </section>
    );
  }

  if (layout === 'stacked') {
    return (
      <section className="space-y-3">
        {images.map((img, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={i}
            {...responsiveImgProps(resolveMediaUrl(img.url), '(min-width: 768px) 50vw, 100vw')}
            alt={img.alt_text || ''}
            fetchPriority={i === 0 ? 'high' : undefined}
            loading={i < 1 ? undefined : 'lazy'}
            className={`w-full ${ASPECT[aspect]} object-cover`}
            style={{
              borderRadius: 'var(--theme-radius-md)',
              border: '1px solid var(--theme-colors-border)',
            }}
          />
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
              onClick={() => setActive((i) => (i - 1 + images.length) % images.length)}
              className="absolute top-1/2 -translate-y-1/2 left-2 size-9 rounded-full bg-white/90 shadow-sm flex items-center justify-center hover:bg-white"
              aria-label="Previous"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => setActive((i) => (i + 1) % images.length)}
              className="absolute top-1/2 -translate-y-1/2 right-2 size-9 rounded-full bg-white/90 shadow-sm flex items-center justify-center hover:bg-white"
              aria-label="Next"
            >
              <ChevronRight className="size-4" />
            </button>
            <div className="absolute bottom-3 inset-x-0 flex justify-center gap-1.5">
              {images.map((_, i) => (
                <button
                  key={i}
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
              key={i}
              type="button"
              onClick={() => setActive(i)}
              className="block w-full aspect-square overflow-hidden transition-all"
              style={{
                borderRadius: 'var(--theme-radius-sm)',
                outline:
                  i === active
                    ? '2px solid var(--theme-colors-primary)'
                    : '1px solid var(--theme-colors-border)',
                outlineOffset: i === active ? '1px' : '0',
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                {...responsiveImgProps(resolveMediaUrl(img.url), '(min-width: 768px) 10vw, 20vw')}
                alt={img.alt_text || ''}
                loading="lazy"
                className="w-full h-full object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
