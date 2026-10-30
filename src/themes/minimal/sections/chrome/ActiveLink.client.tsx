'use client';

// A next/link that knows whether it points at the current page, so chrome
// nav (HeaderBar links, MobileBottomNav tabs) can highlight the active
// destination. Server components can't call usePathname, so this thin
// client wrapper owns that bit.
//
// Chrome links default to prefetch={false}: a header / mega menu with dozens
// of links would otherwise fire one dynamic RSC prefetch per link on every
// page view. Desktop nav prefetches on hover instead (usePrefetchOnIntent).

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback } from 'react';
import type { CSSProperties, FocusEventHandler, PointerEventHandler, ReactNode, Ref } from 'react';

export function ActiveLink({
  href,
  children,
  className,
  style,
  activeStyle,
  activeClassName,
  exact,
  prefetch = false,
  ...rest
}: {
  href: string;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  /** Inline style merged in when the link is active (e.g. active color). */
  activeStyle?: CSSProperties;
  activeClassName?: string;
  /** When true, only an exact pathname match counts as active. Otherwise a
   *  prefix match also counts (so /products/123 keeps "Products" active). */
  exact?: boolean;
  /** Viewport prefetch; off by default for chrome nav (see header note). */
  prefetch?: boolean;
  'aria-label'?: string;
  title?: string;
  target?: string;
  rel?: string;
  /** Focus hook + element ref — used by the mega-menu nav to open a submenu
   *  when its trigger receives keyboard focus and to return focus on Escape. */
  onFocus?: FocusEventHandler<HTMLAnchorElement>;
  onPointerEnter?: PointerEventHandler<HTMLAnchorElement>;
  ref?: Ref<HTMLAnchorElement>;
}) {
  const pathname = usePathname() || '';
  // Compare on pathname only — strip query/hash from the href before matching.
  const hrefPath = href.split('?')[0].split('#')[0];
  const isActive =
    hrefPath && hrefPath !== '#'
      ? exact
        ? pathname === hrefPath
        : pathname === hrefPath || pathname.startsWith(hrefPath + '/')
      : false;

  return (
    <Link
      href={href}
      prefetch={prefetch}
      className={[className, isActive ? activeClassName : ''].filter(Boolean).join(' ')}
      style={isActive ? { ...style, ...activeStyle } : style}
      aria-current={isActive ? 'page' : undefined}
      {...rest}
    >
      {children}
    </Link>
  );
}

// Hrefs already prefetched in this tab; router.prefetch runs once per href.
const prefetchedHrefs = new Set<string>();

// Returns a handler that prefetches an internal href on hover / focus intent.
// Skips '#', hash-only, external and non-http (mailto:, tel:) links.
export function usePrefetchOnIntent() {
  const router = useRouter();
  return useCallback(
    (href: string | undefined) => {
      if (!href || href.startsWith('#') || prefetchedHrefs.has(href)) return;
      if (href.startsWith('//') || /^[a-z][a-z0-9+.-]*:/i.test(href)) return;
      prefetchedHrefs.add(href);
      try {
        router.prefetch(href);
      } catch {
        // Prefetch is best-effort; navigation still works without it.
      }
    },
    [router],
  );
}
