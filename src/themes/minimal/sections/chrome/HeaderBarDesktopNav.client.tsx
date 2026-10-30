'use client';

// Desktop navigation for HeaderBar when `submenu_style` is 'mega'. Split out
// of HeaderBar.tsx so the bar itself stays a server component; only this
// interactive nav ships as JS (the 'dropdown' style keeps the CSS-only
// markup inside HeaderBar.tsx).
//
// Per top-level item:
//   - no children            → plain link;
//   - children, no grandchildren → narrow dropdown under the trigger;
//   - children WITH grandchildren → full-width mega panel: each level-2 item
//     is a column heading (linked when it has a real URL), its level-3 items
//     are the links under it. Visual style mirrors the inline `mega-menu`
//     chrome section.
//
// Interaction: hover intent on pointer devices (short open / close delays so
// crossing the bar does not flicker panels), open on trigger focus, toggle
// with the chevron button (Enter / Space / click), close on Escape (focus
// returns to the trigger), on focus leaving the item, or on an outside click.
// Mobile (< md) never renders this; the drawer accordion handles it.
//
// Prefetch: every link is prefetch={false} (a mega menu has dozens of links
// and each viewport prefetch is a dynamic origin render). A link is
// prefetched once on hover / focus instead (usePrefetchOnIntent).

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronDown } from 'lucide-react';
import { ActiveLink, usePrefetchOnIntent } from './ActiveLink.client';

export interface DesktopNavItem {
  label: string;
  url: string;
  open_in_new_tab?: boolean;
  children?: DesktopNavItem[];
}

// Hover-intent delays (ms): opening waits a beat so a cursor passing through
// the bar does not flash every panel; closing waits a bit longer so moving
// diagonally from the trigger into the panel keeps it open.
const OPEN_DELAY = 80;
const CLOSE_DELAY = 160;

// `target` / `rel` for items the creator marked "open in new tab".
function newTabProps(flag: boolean | undefined) {
  return flag ? { target: '_blank', rel: 'noopener noreferrer' } : {};
}

// A heading is a link only when the menu item points somewhere real.
function isRealUrl(url: string | undefined): url is string {
  return !!url && url !== '#';
}

type PrefetchIntent = (href: string | undefined) => void;

// Hover (mouse) / focus handlers that prefetch a link's target once. New-tab
// links are skipped: the prefetched payload would land in this tab's cache.
function intentProps(prefetch: PrefetchIntent, url: string | undefined, newTab: boolean | undefined) {
  if (newTab) return {};
  return {
    onPointerEnter: (e: React.PointerEvent) => {
      if (e.pointerType === 'mouse') prefetch(url);
    },
    onFocus: () => prefetch(url),
  };
}

// A top-level item gets the full-width panel when at least one of its
// children has children of its own (i.e. the menu is three levels deep
// under this item). Otherwise the simple dropdown is enough.
export function needsMegaPanel(item: DesktopNavItem): boolean {
  return (item.children ?? []).some((c) => (c.children?.length ?? 0) > 0);
}

export function HeaderBarDesktopNav({
  items,
  bg,
  borderColor,
  accent,
}: {
  items: DesktopNavItem[];
  bg: string;
  borderColor: string;
  accent: string;
}) {
  // Index of the open top-level item; only one submenu is open at a time.
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const prefetch = usePrefetchOnIntent();
  const navRef = useRef<HTMLElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const scheduleOpen = useCallback(
    (i: number) => {
      clearTimer();
      timer.current = setTimeout(() => setOpenIndex(i), OPEN_DELAY);
    },
    [clearTimer],
  );

  const scheduleClose = useCallback(() => {
    clearTimer();
    timer.current = setTimeout(() => setOpenIndex(null), CLOSE_DELAY);
  }, [clearTimer]);

  const openNow = useCallback(
    (i: number) => {
      clearTimer();
      setOpenIndex(i);
    },
    [clearTimer],
  );

  const closeNow = useCallback(() => {
    clearTimer();
    setOpenIndex(null);
  }, [clearTimer]);
  const pathname = usePathname();
  useEffect(() => {
    closeNow();
  }, [pathname, closeNow]);

  // Clear any pending timer on unmount.
  useEffect(() => clearTimer, [clearTimer]);

  // Outside click closes the open submenu (touch users tap the chevron to
  // open, then tap elsewhere to dismiss).
  useEffect(() => {
    if (openIndex === null) return;
    function onPointerDown(e: PointerEvent) {
      if (navRef.current && !navRef.current.contains(e.target as Node)) closeNow();
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [openIndex, closeNow]);

  return (
    <nav ref={navRef} className="hidden md:flex items-center gap-1">
      {items.map((item, i) => {
        const children = item.children ?? [];
        if (children.length === 0) {
          return (
            <ActiveLink
              key={i}
              href={item.url || '#'}
              {...newTabProps(item.open_in_new_tab)}
              {...intentProps(prefetch, item.url, item.open_in_new_tab)}
              className="px-3 py-1.5 rounded-md text-sm font-medium hover:bg-black/5 transition"
              activeStyle={{ color: accent }}
              activeClassName="bg-black/5"
            >
              {item.label}
            </ActiveLink>
          );
        }
        return (
          <SubmenuItem
            key={i}
            item={item}
            open={openIndex === i}
            onHoverStart={() => scheduleOpen(i)}
            onHoverEnd={scheduleClose}
            onOpen={() => openNow(i)}
            onToggle={() => (openIndex === i ? closeNow() : openNow(i))}
            onClose={closeNow}
            prefetch={prefetch}
            bg={bg}
            borderColor={borderColor}
            accent={accent}
          />
        );
      })}
    </nav>
  );
}

function SubmenuItem({
  item,
  open,
  onHoverStart,
  onHoverEnd,
  onOpen,
  onToggle,
  onClose,
  prefetch,
  bg,
  borderColor,
  accent,
}: {
  item: DesktopNavItem;
  open: boolean;
  onHoverStart: () => void;
  onHoverEnd: () => void;
  onOpen: () => void;
  onToggle: () => void;
  onClose: () => void;
  prefetch: PrefetchIntent;
  bg: string;
  borderColor: string;
  accent: string;
}) {
  const panelId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLAnchorElement>(null);
  const mega = needsMegaPanel(item);
  const children = item.children ?? [];

  // Set while Escape hands focus back to the trigger, so that focus does not
  // immediately reopen the submenu through the trigger's onFocus.
  const suppressFocusOpen = useRef(false);

  // Escape closes and hands focus back to the trigger link.
  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape' && open) {
      e.stopPropagation();
      onClose();
      suppressFocusOpen.current = true;
      triggerRef.current?.focus();
      suppressFocusOpen.current = false;
    }
  }

  // Focus moving outside the item (trigger + panel) closes it.
  function onBlur(e: React.FocusEvent) {
    const next = e.relatedTarget as Node | null;
    if (open && next && wrapRef.current && !wrapRef.current.contains(next)) onClose();
  }

  // Mega panels span the header, so the wrapper is `static` and the panel
  // anchors to the positioned <header>; plain dropdowns anchor to the item.
  return (
    <div
      ref={wrapRef}
      className={mega ? 'static' : 'relative'}
      onPointerEnter={(e) => {
        if (e.pointerType === 'mouse') onHoverStart();
      }}
      onPointerLeave={(e) => {
        if (e.pointerType === 'mouse') onHoverEnd();
      }}
      onKeyDown={onKeyDown}
      onBlur={onBlur}
    >
      <div className="inline-flex items-center rounded-md hover:bg-black/5 transition">
        {/* The trigger is still a link to the item's own URL (keyboard Enter
            navigates); focusing it opens the submenu for keyboard users. */}
        <ActiveLink
          href={item.url || '#'}
          {...newTabProps(item.open_in_new_tab)}
          className="ps-3 pe-1 py-1.5 rounded-s-md text-sm font-medium"
          activeStyle={{ color: accent }}
          activeClassName="bg-black/5"
          onFocus={() => {
            if (!item.open_in_new_tab) prefetch(item.url);
            if (!suppressFocusOpen.current) onOpen();
          }}
          onPointerEnter={(e) => {
            if (e.pointerType === 'mouse' && !item.open_in_new_tab) prefetch(item.url);
          }}
          ref={triggerRef}
        >
          {item.label}
        </ActiveLink>
        {/* Separate toggle so the submenu can be opened / closed without
            navigating (keyboard Enter / Space, touch tap). */}
        <button
          type="button"
          aria-expanded={open}
          aria-haspopup="true"
          aria-controls={panelId}
          aria-label={item.label}
          onClick={onToggle}
          className="pe-2 ps-0.5 py-1.5 rounded-e-md inline-flex items-center cursor-pointer"
        >
          <ChevronDown
            className={`size-3.5 opacity-60 transition-transform ${open ? 'rotate-180' : ''}`}
            aria-hidden="true"
          />
        </button>
      </div>

      {mega ? (
        <div
          id={panelId}
          className={`absolute inset-x-0 top-full z-50 border-t shadow-xl transition-opacity duration-150 ${
            open ? 'visible opacity-100' : 'invisible opacity-0'
          }`}
          style={{ backgroundColor: bg, borderColor }}
          aria-hidden={!open}
        >
          <div
            className="mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 grid gap-x-8 gap-y-6 grid-cols-[repeat(auto-fill,minmax(10rem,1fr))]"
            style={{ maxWidth: 'var(--theme-container-max)' }}
          >
            {children.map((group, gi) => (
              <div key={gi} className="space-y-2.5 min-w-0">
                {isRealUrl(group.url) ? (
                  <Link
                    href={group.url}
                    prefetch={false}
                    {...newTabProps(group.open_in_new_tab)}
                    {...intentProps(prefetch, group.url, group.open_in_new_tab)}
                    tabIndex={open ? 0 : -1}
                    className="block text-xs font-bold uppercase tracking-wider hover:opacity-70 transition-opacity"
                    style={{ color: accent }}
                  >
                    {group.label}
                  </Link>
                ) : (
                  <h4 className="text-xs font-bold uppercase tracking-wider" style={{ color: accent }}>
                    {group.label}
                  </h4>
                )}
                {group.children?.length ? (
                  <ul className="space-y-1.5" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                    {group.children.map((link, li) => (
                      <li key={li}>
                        <Link
                          href={link.url || '#'}
                          prefetch={false}
                          {...newTabProps(link.open_in_new_tab)}
                          {...intentProps(prefetch, link.url, link.open_in_new_tab)}
                          tabIndex={open ? 0 : -1}
                          className="text-sm hover:opacity-70 transition-opacity"
                        >
                          {link.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div
          id={panelId}
          className={`absolute inset-s-0 top-full z-50 pt-1 min-w-48 ${open ? 'block' : 'hidden'}`}
          aria-hidden={!open}
        >
          <div className="rounded-md border py-1 shadow-lg" style={{ backgroundColor: bg, borderColor }}>
            {children.map((child, ci) => (
              <Link
                key={ci}
                href={child.url || '#'}
                prefetch={false}
                {...newTabProps(child.open_in_new_tab)}
                {...intentProps(prefetch, child.url, child.open_in_new_tab)}
                tabIndex={open ? 0 : -1}
                className="block px-3 py-2 text-sm hover:bg-black/5 transition whitespace-nowrap"
              >
                {child.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
