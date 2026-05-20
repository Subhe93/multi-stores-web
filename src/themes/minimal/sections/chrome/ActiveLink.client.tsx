'use client';

// A next/link that knows whether it points at the current page, so chrome
// nav (HeaderBar links, MobileBottomNav tabs) can highlight the active
// destination. Server components can't call usePathname, so this thin
// client wrapper owns that bit.

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { CSSProperties, ReactNode } from 'react';

export function ActiveLink({
  href,
  children,
  className,
  style,
  activeStyle,
  activeClassName,
  exact,
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
  'aria-label'?: string;
  title?: string;
  target?: string;
  rel?: string;
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
      className={[className, isActive ? activeClassName : ''].filter(Boolean).join(' ')}
      style={isActive ? { ...style, ...activeStyle } : style}
      aria-current={isActive ? 'page' : undefined}
      {...rest}
    >
      {children}
    </Link>
  );
}
