'use client';

// Scroll state for the compact header (header-bar `compact_on_scroll`).
// Renders a 1px sentinel right before the <header> and mirrors "the sentinel
// has left the viewport" as data-scrolled="true|false" on the header, its
// next sibling. One IntersectionObserver, no scroll listener. The sentinel
// takes no room (1px high with a -1px block-end margin), so placing it does
// not move anything. The look itself is CSS in globals.css.

import { useEffect, useRef } from 'react';

export function HeaderScrollState() {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const sentinel = ref.current;
    const header = sentinel?.nextElementSibling;
    if (!sentinel || !(header instanceof HTMLElement) || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver((entries) => {
      const last = entries[entries.length - 1];
      if (last) header.dataset.scrolled = last.isIntersecting ? 'false' : 'true';
    });
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
