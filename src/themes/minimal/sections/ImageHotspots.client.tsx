'use client';

// Component implementation. Definition lives in ImageHotspots.tsx so the
// server-side theme registry resolves `.Component` to a ClientReference.

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowUpRight } from 'lucide-react';
import { resolveMediaUrl } from '@/lib/api';
import type { SectionRenderProps } from '../../types';
import { Reveal } from '../../_motion';
import { SectionHeading } from './_shared/SectionHeading';

interface Hotspot {
  x?: number;
  y?: number;
  title?: string;
  subtitle?: string;
  url?: string;
}

function clampPct(n: unknown, fallback: number): number {
  const v = typeof n === 'number' && Number.isFinite(n) ? n : fallback;
  return Math.max(0, Math.min(100, v));
}

export function ImageHotspots({ settings, content, locale }: SectionRenderProps) {
  const heading = (content.heading as string) || '';
  const subheading = (content.subheading as string) || '';
  const image = (settings.image as string) || '';
  const hotspots = ((content.hotspots as Hotspot[]) || []).filter((h) => h.title || h.subtitle);

  // Only one card open at a time; outside clicks close it.
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (openIndex === null) return;
    const onPointerDown = (e: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpenIndex(null);
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [openIndex]);

  // Stay visible while empty so creators can see placement in the builder.
  if (!image) {
    return (
      <section className="py-12">
        <div
          className="text-center py-10 px-4"
          style={{
            border: '1px dashed var(--theme-colors-border)',
            borderRadius: 'var(--theme-radius-md)',
            color: 'var(--theme-colors-muted)',
          }}
        >
          <p className="text-sm">
            {locale === 'ar'
              ? 'أضف صورة ونقاطًا من البيلدر.'
              : 'Add an image and hotspots from the builder.'}
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="py-12">
      {(heading || subheading) && (
        <div className="mb-10">
          <SectionHeading heading={heading} subheading={subheading} align="center" />
        </div>
      )}

      {/* Dot pulse keyframes — scoped by a distinct class name. */}
      <style>{`
        @keyframes ms-hotspot-pulse {
          0% { box-shadow: 0 0 0 0 rgba(255,255,255,0.55); }
          70% { box-shadow: 0 0 0 14px rgba(255,255,255,0); }
          100% { box-shadow: 0 0 0 0 rgba(255,255,255,0); }
        }
        .ms-hotspot-dot { animation: ms-hotspot-pulse 2.4s ease-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .ms-hotspot-dot { animation: none; }
        }
      `}</style>

      <Reveal direction="scale">
        <div ref={containerRef} className="relative mx-auto w-full max-w-4xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={resolveMediaUrl(image)}
            alt={heading || ''}
            loading="lazy"
            className="w-full h-auto object-cover"
            style={{ borderRadius: 'var(--theme-radius-lg)', boxShadow: 'var(--theme-shadow-md)' }}
          />

          {hotspots.map((spot, i) => {
            const x = clampPct(spot.x, 50);
            const y = clampPct(spot.y, 50);
            // Physical percentages (from left/top) so RTL pages place dots
            // exactly where the creator picked them on the image.
            // Cards flip to the opposite side near an edge so they never
            // escape the image bounds.
            const horizontal = x > 55 ? { right: '14px' } : { left: '14px' };
            const vertical = y > 60 ? { bottom: '-14px' } : { top: '-14px' };
            const isOpen = openIndex === i;

            const cardBody = (
              <>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    {spot.title && (
                      <div
                        className="truncate text-sm font-semibold"
                        style={{ color: 'var(--theme-colors-text)' }}
                      >
                        {spot.title}
                      </div>
                    )}
                    {spot.subtitle && (
                      <div className="mt-0.5 text-xs" style={{ color: 'var(--theme-colors-muted)' }}>
                        {spot.subtitle}
                      </div>
                    )}
                  </div>
                  {spot.url && (
                    <ArrowUpRight
                      className="size-4 shrink-0 rtl:-scale-x-100"
                      style={{ color: 'var(--theme-colors-primary)' }}
                    />
                  )}
                </div>
              </>
            );

            return (
              <div
                key={i}
                className="absolute z-10"
                style={{ left: `${x}%`, top: `${y}%`, width: 0, height: 0 }}
              >
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-label={spot.title || (locale === 'ar' ? 'نقطة' : 'Hotspot')}
                  onClick={() => setOpenIndex(isOpen ? null : i)}
                  className="ms-hotspot-dot absolute flex size-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white transition-transform duration-200 hover:scale-110"
                  style={{ animationDelay: `${i * 0.35}s` }}
                >
                  <span className="size-2 rounded-full" style={{ backgroundColor: 'var(--theme-colors-primary)' }} />
                </button>

                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 6, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 4, scale: 0.97 }}
                      transition={{ duration: 0.2, ease: 'easeOut' }}
                      className="absolute w-56"
                      style={{ ...horizontal, ...vertical }}
                    >
                      {spot.url ? (
                        <a
                          href={spot.url}
                          className="block p-3.5 transition-shadow duration-200 hover:shadow-lg"
                          style={{
                            backgroundColor: 'var(--theme-colors-surface)',
                            border: '1px solid var(--theme-colors-border)',
                            borderRadius: 'var(--theme-radius-md)',
                            boxShadow: 'var(--theme-shadow-md)',
                          }}
                        >
                          {cardBody}
                        </a>
                      ) : (
                        <div
                          className="p-3.5"
                          style={{
                            backgroundColor: 'var(--theme-colors-surface)',
                            border: '1px solid var(--theme-colors-border)',
                            borderRadius: 'var(--theme-radius-md)',
                            boxShadow: 'var(--theme-shadow-md)',
                          }}
                        >
                          {cardBody}
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </Reveal>
    </section>
  );
}
