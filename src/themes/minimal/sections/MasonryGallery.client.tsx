'use client';

// Component implementation. Definition lives in MasonryGallery.tsx so the
// server-side theme registry resolves `.Component` to a ClientReference.
// Client-side for the lightbox (keyboard navigation + scroll lock).

import { useCallback, useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { resolveMediaUrl } from '@/lib/api';
import type { SectionRenderProps } from '../../types';
import { StaggerGroup, StaggerItem } from '../../_motion';
import { SectionHeading } from './_shared/SectionHeading';

interface MasonryImage {
  image?: string;
  caption?: string;
  url?: string;
}

function clampColumns(n: unknown, fallback: number): number {
  const v = typeof n === 'number' ? n : fallback;
  return Math.max(2, Math.min(4, v));
}

export function MasonryGallery({ settings, content, locale }: SectionRenderProps) {
  const heading = (content.heading as string) || '';
  const subheading = (content.subheading as string) || '';
  const images = ((content.images as MasonryImage[]) || []).filter((i) => !!i.image);
  const columns = clampColumns(settings.columns, 3);
  const enableLightbox = settings.enable_lightbox !== false;
  const rtl = locale === 'ar';

  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const close = useCallback(() => setOpenIndex(null), []);
  const next = useCallback(
    () => setOpenIndex((i) => (i === null ? null : (i + 1) % images.length)),
    [images.length],
  );
  const prev = useCallback(
    () => setOpenIndex((i) => (i === null ? null : (i - 1 + images.length) % images.length)),
    [images.length],
  );

  // Keyboard: Esc closes; arrows move physically, so in RTL the roles swap
  // (pressing the "toward previous items" arrow always goes back).
  useEffect(() => {
    if (openIndex === null) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowRight') (rtl ? prev : next)();
      else if (e.key === 'ArrowLeft') (rtl ? next : prev)();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [openIndex, rtl, next, prev, close]);

  // Lock page scroll while the lightbox is open.
  useEffect(() => {
    if (openIndex === null) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [openIndex]);

  return (
    <section className="py-12">
      {(heading || subheading) && (
        <div className="mb-10">
          <SectionHeading heading={heading} subheading={subheading} align="center" />
        </div>
      )}

      {images.length === 0 ? (
        // Stay visible while empty so creators can see placement in the builder.
        <div
          className="text-center py-10 px-4"
          style={{
            border: '1px dashed var(--theme-colors-border)',
            borderRadius: 'var(--theme-radius-md)',
            color: 'var(--theme-colors-muted)',
          }}
        >
          <p className="text-sm">
            {locale === 'ar' ? 'لا توجد صور بعد. أضف صورًا من البيلدر.' : 'No images yet. Add some from the builder.'}
          </p>
        </div>
      ) : (
        <>
          {/* CSS-columns masonry: 1 column on mobile, 2 on tablet, the chosen
              count on desktop (driven by a CSS variable). */}
          <style>{`
            .ms-masonry { column-count: 1; column-gap: 1rem; }
            @media (min-width: 640px) { .ms-masonry { column-count: 2; } }
            @media (min-width: 1024px) { .ms-masonry { column-count: var(--ms-masonry-cols, 3); } }
          `}</style>

          <StaggerGroup
            className="ms-masonry"
            style={{ '--ms-masonry-cols': columns } as CSSProperties}
          >
            {images.map((item, i) => {
              const tile = (
                <div
                  className="group relative overflow-hidden"
                  style={{ borderRadius: 'var(--theme-radius-md)' }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={resolveMediaUrl(item.image || '')}
                    alt={item.caption || ''}
                    loading="lazy"
                    className="w-full h-auto object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                  />
                  {/* Hover veil + caption. */}
                  <div
                    className="pointer-events-none absolute inset-0 flex items-end opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                    style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.6), transparent 55%)' }}
                  >
                    {item.caption && (
                      <span className="w-full translate-y-2 p-4 text-sm text-white transition-transform duration-300 group-hover:translate-y-0">
                        {item.caption}
                      </span>
                    )}
                  </div>
                </div>
              );

              return (
                <StaggerItem key={i} className="mb-4 break-inside-avoid">
                  {item.url ? (
                    <a href={item.url} className="block">
                      {tile}
                    </a>
                  ) : enableLightbox ? (
                    <button
                      type="button"
                      className="block w-full cursor-zoom-in text-start"
                      aria-label={item.caption || (locale === 'ar' ? 'تكبير الصورة' : 'Enlarge image')}
                      onClick={() => setOpenIndex(i)}
                    >
                      {tile}
                    </button>
                  ) : (
                    tile
                  )}
                </StaggerItem>
              );
            })}
          </StaggerGroup>

          {/* Minimal dark lightbox. */}
          <AnimatePresence>
            {openIndex !== null && images[openIndex] && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="fixed inset-0 z-100 flex items-center justify-center"
                style={{ backgroundColor: 'rgba(0,0,0,0.92)' }}
                onClick={close}
                role="dialog"
                aria-modal="true"
                aria-label={locale === 'ar' ? 'عارض الصور' : 'Image viewer'}
              >
                <button
                  type="button"
                  onClick={close}
                  aria-label={locale === 'ar' ? 'إغلاق' : 'Close'}
                  className="absolute top-4 inset-e-4 z-10 flex size-10 items-center justify-center rounded-full text-white/80 transition-colors duration-200 hover:bg-white/10 hover:text-white"
                >
                  <X className="size-6" />
                </button>

                {images.length > 1 && (
                  <>
                    {/* Physical left/right buttons; in RTL the left arrow
                        advances forward, matching reading direction. */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        (rtl ? next : prev)();
                      }}
                      aria-label={rtl ? 'التالي' : 'Previous'}
                      className="absolute z-10 flex size-11 items-center justify-center rounded-full text-white/80 transition-colors duration-200 hover:bg-white/10 hover:text-white"
                      style={{ left: '16px' }}
                    >
                      <ChevronLeft className="size-7" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        (rtl ? prev : next)();
                      }}
                      aria-label={rtl ? 'السابق' : 'Next'}
                      className="absolute z-10 flex size-11 items-center justify-center rounded-full text-white/80 transition-colors duration-200 hover:bg-white/10 hover:text-white"
                      style={{ right: '16px' }}
                    >
                      <ChevronRight className="size-7" />
                    </button>
                  </>
                )}

                <motion.figure
                  key={openIndex}
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.25, ease: 'easeOut' }}
                  className="flex max-h-[90vh] max-w-[90vw] flex-col items-center gap-3 px-14"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={resolveMediaUrl(images[openIndex].image || '')}
                    alt={images[openIndex].caption || ''}
                    className="max-h-[80vh] max-w-full object-contain"
                    style={{ borderRadius: 'var(--theme-radius-sm)' }}
                  />
                  <figcaption className="flex items-center gap-3 text-sm text-white/80">
                    {images[openIndex].caption && <span>{images[openIndex].caption}</span>}
                    <span dir="ltr" className="text-xs tabular-nums text-white/50">
                      {openIndex + 1} / {images.length}
                    </span>
                  </figcaption>
                </motion.figure>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </section>
  );
}
