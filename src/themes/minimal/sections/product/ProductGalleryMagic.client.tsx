'use client';

// Component implementation. Definition lives in ProductGalleryMagic.tsx so the
// server-side theme registry resolves `.Component` to a ClientReference rather
// than swallowing the entire section object as opaque client data.

import { useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, ZoomIn } from 'lucide-react';
import { resolveMediaUrl } from '@/lib/api';
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

  function MainImage({ index }: { index: number }) {
    const img = images[index];
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
        <img
          src={resolveMediaUrl(img.url)}
          alt={img.alt_text || ''}
          className="w-full h-full object-cover transition-transform duration-300"
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
  }

  if (layout === 'grid') {
    return (
      <section className="grid grid-cols-2 gap-3">
        {images.map((img, i) => (
          <img
            key={i}
            src={resolveMediaUrl(img.url)}
            alt={img.alt_text || ''}
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
          <img
            key={i}
            src={resolveMediaUrl(img.url)}
            alt={img.alt_text || ''}
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
        <MainImage index={active} />
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
      <MainImage index={active} />
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
              <img
                src={resolveMediaUrl(img.url)}
                alt={img.alt_text || ''}
                className="w-full h-full object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
