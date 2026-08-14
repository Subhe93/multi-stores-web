'use client';

// Component implementation. Definition lives in BeforeAfter.tsx so the
// server-side theme registry resolves `.Component` to a ClientReference.

import { useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent, KeyboardEvent as ReactKeyboardEvent } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { resolveMediaUrl } from '@/lib/api';
import type { SectionRenderProps } from '../../types';
import { Reveal } from '../../_motion';
import { SectionHeading } from './_shared/SectionHeading';

function clampPct(n: number): number {
  return Math.max(0, Math.min(100, n));
}

export function BeforeAfter({ settings, content, locale }: SectionRenderProps) {
  const heading = (content.heading as string) || '';
  const subheading = (content.subheading as string) || '';
  const labelBefore = (content.label_before as string) || '';
  const labelAfter = (content.label_after as string) || '';
  const imageBefore = (settings.image_before as string) || '';
  const imageAfter = (settings.image_after as string) || '';
  const startPosition = clampPct(typeof settings.start_position === 'number' ? settings.start_position : 50);

  // Divider position as a PHYSICAL percentage from the left edge. Pointer math
  // uses clientX against rect.left, which is physical too, so the slider
  // behaves identically under dir="rtl" — no mirroring needed (labels are
  // pinned physically over their halves as well).
  const [position, setPosition] = useState(startPosition);
  const [dragging, setDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const updateFromClientX = (clientX: number) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0) return;
    setPosition(clampPct(((clientX - rect.left) / rect.width) * 100));
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
    updateFromClientX(e.clientX);
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (dragging) updateFromClientX(e.clientX);
  };

  const endDrag = () => setDragging(false);

  // Arrow keys move the divider physically (left arrow → divider moves left)
  // in both LTR and RTL, matching what the user sees on screen.
  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 10 : 2;
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      setPosition((p) => clampPct(p - step));
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      setPosition((p) => clampPct(p + step));
    } else if (e.key === 'Home') {
      e.preventDefault();
      setPosition(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      setPosition(100);
    }
  };

  // Stay visible while empty so creators can see placement in the builder.
  if (!imageBefore || !imageAfter) {
    return (
      <section className="py-12">
        {(heading || subheading) && (
          <div className="mb-10">
            <SectionHeading
              heading={heading}
              subheading={subheading}
              align="center"
              headingColor={settings.heading_color}
              subheadingColor={settings.subheading_color}
            />
          </div>
        )}
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
              ? 'أضف صورتي «قبل» و«بعد» من البيلدر.'
              : 'Add a before and an after image from the builder.'}
          </p>
        </div>
      </section>
    );
  }

  const labelStyle = {
    backgroundColor: 'rgba(0,0,0,0.55)',
    color: '#fff',
    borderRadius: 'var(--theme-radius-full)',
    backdropFilter: 'blur(4px)',
  } as const;

  return (
    <section className="py-12">
      {(heading || subheading) && (
        <div className="mb-10">
          <SectionHeading
            heading={heading}
            subheading={subheading}
            align="center"
            headingColor={settings.heading_color}
            subheadingColor={settings.subheading_color}
          />
        </div>
      )}

      <Reveal direction="scale">
        <div
          ref={containerRef}
          className="relative mx-auto w-full max-w-4xl select-none overflow-hidden aspect-[4/3] sm:aspect-[16/10]"
          style={{
            borderRadius: 'var(--theme-radius-lg)',
            boxShadow: 'var(--theme-shadow-md)',
            touchAction: 'none',
            cursor: dragging ? 'ew-resize' : 'pointer',
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          {/* Before image — full frame underneath. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={resolveMediaUrl(imageBefore)}
            alt={labelBefore || ''}
            loading="lazy"
            draggable={false}
            className="absolute inset-0 h-full w-full object-cover"
          />
          {/* After image — clipped so only the part right of the divider shows. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={resolveMediaUrl(imageAfter)}
            alt={labelAfter || ''}
            loading="lazy"
            draggable={false}
            className="absolute inset-0 h-full w-full object-cover"
            style={{
              clipPath: `inset(0 0 0 ${position}%)`,
              transition: dragging ? 'none' : 'clip-path 200ms ease-out',
            }}
          />

          {/* Physical positioning (left/right) keeps each label over its own
              image half regardless of document direction. */}
          {labelBefore && (
            <span className="absolute top-4 px-3 py-1 text-xs font-semibold" style={{ ...labelStyle, left: '16px' }}>
              {labelBefore}
            </span>
          )}
          {labelAfter && (
            <span className="absolute top-4 px-3 py-1 text-xs font-semibold" style={{ ...labelStyle, right: '16px' }}>
              {labelAfter}
            </span>
          )}

          {/* Divider + keyboard-accessible round handle. */}
          <div
            role="slider"
            tabIndex={0}
            aria-label={locale === 'ar' ? 'مقارنة قبل وبعد' : 'Before and after comparison'}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(position)}
            aria-orientation="horizontal"
            onKeyDown={onKeyDown}
            className="absolute inset-y-0 z-10 outline-none"
            style={{
              left: `${position}%`,
              transform: 'translateX(-50%)',
              width: '44px',
              cursor: 'ew-resize',
              transition: dragging ? 'none' : 'left 200ms ease-out',
            }}
          >
            <div
              className="absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-white"
              style={{ boxShadow: '0 0 8px rgba(0,0,0,0.35)' }}
            />
            <div
              className="absolute left-1/2 top-1/2 flex size-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white transition-transform duration-200 hover:scale-105"
              style={{ boxShadow: 'var(--theme-shadow-md)' }}
            >
              <ChevronLeft className="size-4 text-neutral-700" />
              <ChevronRight className="size-4 text-neutral-700" />
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
