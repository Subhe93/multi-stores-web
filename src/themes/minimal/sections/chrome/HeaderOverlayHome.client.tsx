'use client';

// Home-page gate of the transparent header (header-bar `overlay_hero: 'home'`).
// Renders an empty hidden marker inside the <header> while the visitor is on
// the store's home page; the overlay CSS in globals.css keys on it. The store
// layout does not re-render on client navigation, so the pathname has to be
// read here, and usePathname also resolves during the server render: the
// first paint is already right (no flash, no layout shift).

import { usePathname } from 'next/navigation';
import { isActiveHref } from './activeHref';

export function HeaderOverlayHome({ homeHref }: { homeHref: string }) {
  const pathname = (usePathname() || '').replace(/(.)\/+$/, '$1');
  if (!isActiveHref(homeHref, pathname, null, true)) return null;
  return <span data-overlay-home="" hidden />;
}
