// Edge-to-edge two-column layout: an image that runs to the viewport edge on
// one side, text on the other. The text's outer padding follows the page
// container so it lines up with the sections above and below. Below 768px
// the two stack and the image keeps a fixed aspect.

import type { CSSProperties, ReactNode } from 'react';

export type Edge = 'soft' | 'hard';
export type Focus = 'center' | 'top' | 'bottom';
export type ImageSide = 'start' | 'end';
export type MobileOrder = 'image-first' | 'text-first';

const FOCUS_POSITION: Record<Focus, string> = {
  center: 'center',
  top: 'center top',
  bottom: 'center bottom',
};

/** `object-position` of a stored image focus; unset or unknown is the centre. */
export function focusPosition(raw: unknown): string {
  return raw === 'top' || raw === 'bottom' ? FOCUS_POSITION[raw] : FOCUS_POSITION.center;
}

/** Stored edge value; unset or unknown reads as `fallback`. */
export function edgeValue(raw: unknown, fallback: Edge): Edge {
  return raw === 'soft' || raw === 'hard' ? raw : fallback;
}

// Same gutters as the page container (Layout.tsx: 16 / 24 / 32 px).
const GUTTER_VARS = '[--g:1rem] sm:[--g:1.5rem] lg:[--g:2rem]';
// The side away from the image: container edge plus gutter.
const OUTER_PAD = 'max(var(--g), calc((100vw - var(--theme-container-max, 1200px)) / 2 + var(--g)))';
// The side next to the image: the page gutter while stacked, a wider gap
// once the two sit side by side.
const INNER_VARS = '[--bs-in:var(--g)] md:[--bs-in:clamp(1.5rem,4vw,4rem)]';

const cx = (...parts: Array<string | false>) => parts.filter(Boolean).join(' ');

/**
 * Stand-in for a missing image, passed as `media` in the builder preview
 * only: the image half stays visible so the creator sees the layout. On the
 * live store a section without an image passes `null` instead.
 */
export function BleedMediaPlaceholder() {
  return (
    <div
      className="absolute inset-0"
      style={{
        backgroundColor: 'var(--theme-colors-surface)',
        border: '1px dashed var(--theme-colors-border)',
      }}
      data-bleed-placeholder=""
    />
  );
}

interface BleedSplitProps {
  imageSide: ImageSide;
  /** The image (or a builder placeholder). Null renders one contained text column. */
  media: ReactNode | null;
  children: ReactNode;
  /** Section background and text colour. */
  bg: string;
  color: string;
  /** Colour the soft image edge fades into. */
  blend: string;
  edge: Edge;
  /** Min-height of the image column from 768px, e.g. `md:min-h-[480px]`. */
  minHeightClass: string;
  /** Aspect of the image box while stacked, e.g. `aspect-[4/3]`. */
  mobileAspectClass: string;
  /** Image column takes 58 percent instead of half. */
  wide?: boolean;
  mobileOrder?: MobileOrder;
}

export function BleedSplit({
  imageSide,
  media,
  children,
  bg,
  color,
  blend,
  edge,
  minHeightClass,
  mobileAspectClass,
  wide = false,
  mobileOrder = 'image-first',
}: BleedSplitProps) {
  if (media === null || media === undefined || media === false) {
    // No image: one text column inside the page container, no escape to the
    // viewport and no empty half. A coloured tone becomes a padded panel.
    const filled = bg !== 'transparent';
    return (
      <section
        className={filled ? 'px-6 md:px-10' : undefined}
        style={{
          backgroundColor: filled ? bg : undefined,
          color,
          borderRadius: filled ? 'var(--theme-radius-md)' : undefined,
        }}
        data-bleed-split="contained"
      >
        <div className="w-full max-w-xl py-10 md:py-16">{children}</div>
      </section>
    );
  }

  const atEnd = imageSide === 'end';
  // The media box is first in the DOM; the track sizes are mirrored so the
  // wide track is always the one the image lands in. `minmax(0, …)` pins the
  // ratio: a long unbroken heading word cannot widen the text track.
  const tracks = wide
    ? atEnd
      ? 'md:grid-cols-[minmax(0,42fr)_minmax(0,58fr)]'
      : 'md:grid-cols-[minmax(0,58fr)_minmax(0,42fr)]'
    : 'md:grid-cols-2';
  // The gradient is written left-to-right (blend, then transparent) and
  // mirrored so the blend colour always sits on the edge next to the text.
  const softEdge = atEnd ? 'start-0 rtl:-scale-x-100' : 'end-0 -scale-x-100 rtl:scale-x-100';
  const textPadding: CSSProperties = atEnd
    ? { paddingInlineStart: OUTER_PAD, paddingInlineEnd: 'var(--bs-in)' }
    : { paddingInlineStart: 'var(--bs-in)', paddingInlineEnd: OUTER_PAD };

  return (
    <section
      style={{
        width: '100vw',
        maxWidth: '100vw',
        marginInline: 'calc(50% - 50vw)',
        backgroundColor: bg,
        color,
      }}
      data-bleed-split="bleed"
    >
      <div className={`grid ${tracks}`}>
        <div
          className={cx(
            'relative overflow-hidden',
            mobileAspectClass,
            'md:aspect-auto',
            minHeightClass,
            atEnd && 'md:order-2',
            mobileOrder === 'text-first' && 'max-md:order-2',
          )}
        >
          {media}
          {edge === 'soft' && (
            <span
              aria-hidden
              className={`hidden md:block absolute inset-y-0 w-24 lg:w-40 pointer-events-none ${softEdge}`}
              style={{ background: `linear-gradient(to right, ${blend}, transparent)` }}
            />
          )}
        </div>
        <div
          className={cx('flex items-center', atEnd && 'md:order-1', GUTTER_VARS, INNER_VARS)}
          style={textPadding}
        >
          <div className="w-full max-w-xl py-10 md:py-16">{children}</div>
        </div>
      </div>
    </section>
  );
}
