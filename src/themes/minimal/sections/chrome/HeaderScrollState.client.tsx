'use client';

// Scroll state for the compact header (header-bar `compact_on_scroll`).
// Renders a 1px sentinel right before the <header> and mirrors "the sentinel
// has left the viewport" as data-scrolled="true|false" on the header, its
// next sibling. One IntersectionObserver, no scroll listener. The sentinel
// takes no room (1px high with a -1px block-end margin), so placing it does
// not move anything. The look itself is CSS in globals.css.
//
// The viewport is extended upwards by the height the header gives up when
// compact (0.75rem, the same value as in globals.css), so the header shrinks
// only once the page has scrolled that far. By then the content below has
// already reached the lower edge of the compact header, and no strip of
// page background shows between the two.

import { useEffect, useRef } from 'react';

/** Height the compact header gives up, in px: 0.75rem at the page's root font size. */
const COMPACT_DELTA_REM = 0.75;
function compactDeltaPx(): number {
  const root = parseFloat(getComputedStyle(document.documentElement).fontSize);
  return Math.round(COMPACT_DELTA_REM * (Number.isFinite(root) && root > 0 ? root : 16));
}

export function HeaderScrollState() {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const sentinel = ref.current;
    const header = sentinel?.nextElementSibling;
    if (!sentinel || !(header instanceof HTMLElement) || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      (entries) => {
        const last = entries[entries.length - 1];
        if (last) header.dataset.scrolled = last.isIntersecting ? 'false' : 'true';
      },
      { rootMargin: `${compactDeltaPx()}px 0px 0px 0px` },
    );
    io.observe(sentinel);
    return () => io.disconnect();
  }, []);

  return (
    <span
      ref={ref}
      data-header-sentinel=""
      aria-hidden="true"
      style={{ display: 'block', height: 1, marginBlockEnd: -1, pointerEvents: 'none' }}
    />
  );
}
