'use client';

// The "menu" item of MobileBottomNav: opens the HeaderBar's mobile drawer
// through a window event (see mobileMenuEvent.ts). When no drawer answers
// (the header has no nav links) and the creator typed a URL, it follows
// that URL instead.

import type { CSSProperties, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { requestMobileMenu } from './mobileMenuEvent';

export function BottomNavMenuButton({
  fallbackHref,
  className,
  style,
  children,
}: {
  fallbackHref?: string;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const router = useRouter();
  return (
    <button
      type="button"
      aria-haspopup="dialog"
      onClick={() => {
        if (requestMobileMenu()) return;
        if (!fallbackHref || fallbackHref.startsWith('#')) return;
        if (fallbackHref.startsWith('/') && !fallbackHref.startsWith('//')) router.push(fallbackHref);
        else window.location.assign(fallbackHref);
      }}
      className={className}
      style={style}
    >
      {children}
    </button>
  );
}
