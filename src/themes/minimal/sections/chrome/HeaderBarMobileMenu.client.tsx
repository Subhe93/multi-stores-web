'use client';

// Mobile menu split out of HeaderBar — the hamburger button + the slide-in
// drawer. Lives separately so HeaderBar.tsx stays a server component (most
// of the bar is static markup); only this interactive bit ships as JS.
//
// The drawer is a modal dialog: named, focus moves into it on open, Tab
// stays inside, Escape closes, and focus returns to whatever opened it (the
// hamburger, or the bottom nav's "menu" item via OPEN_MOBILE_MENU_EVENT).

import { useCallback, useEffect, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
// Chrome links use prefetch={false}: viewport-prefetching every menu link
// floods the origin with dynamic RSC renders on each page view.
import { ChevronDown, Menu, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { OPEN_MOBILE_MENU_EVENT } from './mobileMenuEvent';

export interface MobileMenuItem {
  label: string;
  url: string;
  open_in_new_tab?: boolean;
  children?: MobileMenuItem[];
}

// Same breakpoint as Tailwind's `md`: the drawer only exists below it.
const DESKTOP_QUERY = '(min-width: 768px)';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

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
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  // Element focused when the drawer opened; focus goes back there on close.
  const returnFocusRef = useRef<HTMLElement | null>(null);
  // Theme color variables (--theme-colors-*) are scoped to the `.store-root`
  // wrapper, not :root. The drawer reads `bg`/`fg` from those variables, so it
  // must be portaled INTO that scope — portaling to document.body would lose
  // the variables and render a transparent panel. `.store-root` also sits
  // above the backdrop-blurred header, so it still escapes the header's
  // backdrop-filter containing block (the reason we portal at all). Resolved
  // when the drawer opens (the DOM is only known after mount).
  const [portalTarget, setPortalTarget] = useState<Element | null>(null);

  const openMenu = useCallback(() => {
    const active = document.activeElement;
    returnFocusRef.current = active instanceof HTMLElement && active !== document.body ? active : triggerRef.current;
    setPortalTarget(triggerRef.current?.closest('.store-root') ?? document.body);
    setOpen(true);
  }, []);

  // The bottom nav's "menu" item asks for the drawer through a window event;
  // cancelling it tells the sender the request was handled.
  useEffect(() => {
    function onRequest(e: Event) {
      // One drawer per request: a second header-bar on the page leaves it to
      // the first one (two drawers would also fight over the body scroll lock).
      if (e.defaultPrevented) return;
      e.preventDefault();
      openMenu();
    }
    window.addEventListener(OPEN_MOBILE_MENU_EVENT, onRequest);
    return () => window.removeEventListener(OPEN_MOBILE_MENU_EVENT, onRequest);
  }, [openMenu]);

  // While open: lock body scroll, close on Escape, and close when the
  // viewport grows to desktop width (the drawer is md:hidden there, so the
  // scroll lock would otherwise stay on an invisible dialog). Focus moves
  // into the dialog on open and back to the opener on close. Restores
  // overflow on unmount so a route change leaves the page scrollable again.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', onKey);
    const desktop = window.matchMedia?.(DESKTOP_QUERY);
    function onViewport() {
      if (desktop?.matches) setOpen(false);
    }
    desktop?.addEventListener?.('change', onViewport);
    closeRef.current?.focus();
    const returnTo = returnFocusRef;
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
      desktop?.removeEventListener?.('change', onViewport);
      const target = returnTo.current;
      if (target && target.isConnected) target.focus();
    };
  }, [open]);

  // Keep Tab / Shift+Tab inside the dialog.
  function trapTab(e: ReactKeyboardEvent<HTMLDivElement>) {
    if (e.key !== 'Tab' || !dialogRef.current) return;
    const nodes = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (nodes.length === 0) return;
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && (active === first || !dialogRef.current.contains(active))) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && (active === last || !dialogRef.current.contains(active))) {
      e.preventDefault();
      first.focus();
    }
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={openMenu}
        aria-label={ariaLabel}
        aria-haspopup="dialog"
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
          {/* Backdrop — click anywhere outside the panel to close. Not a tab
              stop: the dialog has its own close button. */}
          <button
            type="button"
            tabIndex={-1}
            aria-label={t('nav.closeMenu')}
            onClick={() => setOpen(false)}
            className="md:hidden fixed inset-0 z-40 bg-black/40"
          />
          {/* Drawer — anchored to the start edge (LTR: left, RTL: right). */}
          <div
            ref={dialogRef}
            className="md:hidden fixed top-0 bottom-0 inset-s-0 z-50 w-80 max-w-[85vw] flex flex-col shadow-2xl"
            style={{ backgroundColor: bg, color: fg }}
            role="dialog"
            aria-modal="true"
            aria-label={t('nav.menu')}
            onKeyDown={trapTab}
          >
            <div
              className="flex items-center justify-end p-3 border-b"
              style={{ borderColor: 'color-mix(in srgb, currentColor 10%, transparent)' }}
            >
              <button
                ref={closeRef}
                type="button"
                onClick={() => setOpen(false)}
                aria-label={t('common.close')}
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
  const t = useTranslations('nav');
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
        prefetch={false}
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
        {item.url && item.url !== '#' ? (
          <Link
            prefetch={false}
            href={item.url}
            onClick={onNavigate}
            {...external}
            className={`flex-1 pe-5 ${rowClass} hover:bg-black/5 transition`}
            style={indent}
          >
            {item.label}
          </Link>
        ) : (
          // A group heading (mega-menu column) has no page of its own: the
          // label toggles its children like the chevron does.
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className={`flex-1 pe-5 text-start ${rowClass} hover:bg-black/5 transition`}
            style={indent}
          >
            {item.label}
          </button>
        )}
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          aria-label={t(expanded ? 'collapse' : 'expand', { label: item.label })}
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
