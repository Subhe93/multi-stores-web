'use client';

// Mobile menu split out of HeaderBar — the hamburger button + the slide-in
// drawer. Lives separately so HeaderBar.tsx stays a server component (most
// of the bar is static markup); only this interactive bit ships as JS.

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { ChevronDown, Menu, X } from 'lucide-react';

export interface MobileMenuItem {
  label: string;
  url: string;
  open_in_new_tab?: boolean;
  children?: MobileMenuItem[];
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
                <MobileRow key={i} item={item} onNavigate={() => setOpen(false)} />
              ))}
            </nav>
          </div>
        </>,
        portalTarget,
      )}
    </>
  );
}

// Menus render at most three levels (top / sub / sub-sub, M6 §4).
const MOBILE_MAX_DEPTH = 2;

// One drawer row, used recursively. Leaf items are a plain link; items with
// children render a collapsible disclosure: tapping the chevron expands the
// indented sub-rows while tapping the label still navigates to the item.
function MobileRow({
  item,
  depth = 0,
  onNavigate,
}: {
  item: MobileMenuItem;
  depth?: number;
  onNavigate: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const children = depth < MOBILE_MAX_DEPTH ? item.children ?? [] : [];
  const external = item.open_in_new_tab
    ? { target: '_blank', rel: 'noopener noreferrer' }
    : {};
  // Each level indents a bit more; only top-level rows carry the divider.
  const indent = { paddingInlineStart: `${20 + depth * 16}px` };
  const rowClass = depth === 0 ? 'py-3 text-base font-medium' : 'py-2.5 text-sm';
  const rowBorder = depth === 0 ? 'border-b' : '';
  const borderStyle = depth === 0 ? { borderColor: 'rgba(0,0,0,0.06)' } : {};

  if (children.length === 0) {
    return (
      <Link
        href={item.url}
        onClick={onNavigate}
        {...external}
        className={`block pe-5 ${rowClass} ${rowBorder} hover:bg-black/5 transition`}
        style={{ ...indent, ...borderStyle }}
      >
        {item.label}
      </Link>
    );
  }

  return (
    <div className={rowBorder} style={borderStyle}>
      <div className="flex items-stretch">
        <Link
          href={item.url}
          onClick={onNavigate}
          {...external}
          className={`flex-1 pe-5 ${rowClass} hover:bg-black/5 transition`}
          style={indent}
        >
          {item.label}
        </Link>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          aria-label={expanded ? 'Collapse' : 'Expand'}
          className="px-4 inline-flex items-center justify-center hover:bg-black/5 transition"
        >
          <ChevronDown className={`size-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </button>
      </div>
      {expanded && (
        <div className="pb-1">
          {children.map((child, i) => (
            <MobileRow key={i} item={child} depth={depth + 1} onNavigate={onNavigate} />
          ))}
        </div>
      )}
    </div>
  );
}
