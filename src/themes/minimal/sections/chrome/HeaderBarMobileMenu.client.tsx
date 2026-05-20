'use client';

// Mobile menu split out of HeaderBar — the hamburger button + the slide-in
// drawer. Lives separately so HeaderBar.tsx stays a server component (most
// of the bar is static markup); only this interactive bit ships as JS.

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';

export interface MobileMenuItem {
  label: string;
  url: string;
}

export function HeaderBarMobileMenu({
  items,
  fg,
  bg,
  ariaLabel,
}: {
  items: MobileMenuItem[];
  fg: string;
  bg: string;
  ariaLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Theme color variables (--theme-colors-*) are scoped to the `.store-root`
  // wrapper, not :root. The drawer reads `bg`/`fg` from those variables, so it
  // must be portaled INTO that scope — portaling to document.body would lose
  // the variables and render a transparent panel. `.store-root` also sits
  // above the backdrop-blurred header, so it still escapes the header's
  // backdrop-filter containing block (the reason we portal at all).
  const portalTarget =
    typeof document === 'undefined'
      ? null
      : triggerRef.current?.closest('.store-root') ?? document.body;

  // Lock body scroll while the drawer is open + close on Escape. Restores
  // overflow on unmount so a route change leaves the page scrollable again.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-label={ariaLabel}
        aria-expanded={open}
        className="md:hidden size-9 inline-flex items-center justify-center rounded-md hover:bg-black/5 transition"
        style={{ color: fg }}
      >
        <Menu className="size-5" />
      </button>

      {/* Portaled out of the HeaderBar: the bar uses `backdrop-blur`, and an
          ancestor with backdrop-filter becomes the containing block for
          `position: fixed` descendants — which would shrink this drawer to the
          header's height instead of the viewport. Portaling to `.store-root`
          (see portalTarget) escapes that while keeping the theme color
          variables in scope. */}
      {open && portalTarget && createPortal(
        <>
          {/* Backdrop — click anywhere outside the panel to close. */}
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="md:hidden fixed inset-0 z-40 bg-black/40 animate-in fade-in duration-200"
          />
          {/* Drawer — slides in from the start edge (LTR: left, RTL: right). */}
          <div
            className="md:hidden fixed top-0 bottom-0 inset-s-0 z-50 w-80 max-w-[85vw] flex flex-col shadow-2xl animate-in slide-in-from-left duration-200 rtl:slide-in-from-right"
            style={{ backgroundColor: bg, color: fg }}
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-center justify-end p-3 border-b" style={{ borderColor: 'currentColor', borderOpacity: 0.1 } as React.CSSProperties}>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="size-9 inline-flex items-center justify-center rounded-md hover:bg-black/5 transition"
              >
                <X className="size-5" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto py-2">
              {items.map((item, i) => (
                <Link
                  key={i}
                  href={item.url}
                  onClick={() => setOpen(false)}
                  className="block px-5 py-3 text-base font-medium border-b hover:bg-black/5 transition"
                  style={{ borderColor: 'rgba(0,0,0,0.06)' }}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </>,
        portalTarget,
      )}
    </>
  );
}
