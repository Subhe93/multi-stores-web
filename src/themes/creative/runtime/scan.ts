// Store-level registrar of the motion engine. With the store switch on, the
// section renderer marks every section with data-cx-section; this module
// registers each of them with the engine core (scroll reveals, behaviours)
// and keeps doing so as the page changes: client navigation, streamed
// content, "load more" cards. One MutationObserver, no scroll listener.

import { isRegistered, rearm, register } from '../engine/core';

type Cleanup = () => void;

const SECTION = '[data-cx-section]';

export function startScan(root: HTMLElement): Cleanup {
  const live = new Map<HTMLElement, Cleanup>();
  let frame = 0;
  let stopped = false;

  const pass = () => {
    frame = 0;
    if (stopped) return;
    // Sections that left the document.
    for (const [el, off] of live) {
      if (!el.isConnected) {
        off();
        live.delete(el);
      }
    }
    for (const el of Array.from(root.querySelectorAll<HTMLElement>(SECTION))) {
      if (live.has(el)) {
        // New nodes inside a known section (more cards, a late render).
        if (isRegistered(el)) rearm(el);
        continue;
      }
      live.set(el, register(el));
    }
  };

  const schedule = () => {
    if (!frame && !stopped) frame = requestAnimationFrame(pass);
  };

  pass();
  let observer: MutationObserver | null = null;
  if (typeof MutationObserver !== 'undefined') {
    observer = new MutationObserver((records) => {
      for (const r of records) {
        if (r.addedNodes.length || r.removedNodes.length) {
          schedule();
          return;
        }
      }
    });
    observer.observe(root, { childList: true, subtree: true });
  }

  return () => {
    stopped = true;
    cancelAnimationFrame(frame);
    observer?.disconnect();
    for (const off of live.values()) off();
    live.clear();
  };
}
