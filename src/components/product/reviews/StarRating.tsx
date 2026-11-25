// Star rating (M171): five inline SVG stars, the filled share drawn as a
// clipped overlay so 4.6 shows as 4.6. One labelled image for assistive
// technology. Always left-to-right: stars are never mirrored in RTL.
// No hooks: renders the same on the server and in the browser.

import type { CSSProperties } from 'react';

const STAR_PATH =
  'M10 1.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9L10 14.9l-5.2 2.8 1-5.9L1.5 7.7l5.9-.8L10 1.5z';

function Stars({ size }: { size: number }) {
  return (
    <>
      {[0, 1, 2, 3, 4].map((i) => (
        <svg key={i} width={size} height={size} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" focusable="false" style={{ flex: 'none' }}>
          <path d={STAR_PATH} />
        </svg>
      ))}
    </>
  );
}

const ROW: CSSProperties = { display: 'inline-flex', flexWrap: 'nowrap' };

export function StarRating({
  value,
  label,
  size = 16,
  className,
}: {
  /** 0..5; fractions are drawn. */
  value: number;
  /** Text alternative ("4.6 out of 5"). */
  label: string;
  size?: number;
  className?: string;
}) {
  const safe = Number.isFinite(value) ? Math.max(0, Math.min(5, value)) : 0;
  // One decimal of precision is all the data has.
  const percent = Math.round((safe / 5) * 1000) / 10;
  return (
    <span
      role="img"
      aria-label={label}
      dir="ltr"
      data-star-rating={safe}
      className={className}
      style={{ position: 'relative', display: 'inline-flex', flex: 'none', lineHeight: 0, verticalAlign: 'middle' }}
    >
      <span style={{ ...ROW, color: 'var(--theme-colors-border, #d1d5db)' }}>
        <Stars size={size} />
      </span>
      <span
        style={{
          ...ROW,
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: 0,
          width: `${percent}%`,
          overflow: 'hidden',
          color: 'var(--theme-colors-rating, #f59e0b)',
        }}
      >
        <Stars size={size} />
      </span>
    </span>
  );
}
