'use client';

// CSS-only dropdowns (HeaderBar 'dropdown' style, MegaMenu) open on
// `:hover` and `:focus-within`. Clicking a link inside one keeps that link
// focused across the client-side navigation, so the panel stayed open on the
// new page. Rendered inside such a dropdown, this blurs the focused element
// within its parent when the pathname changes (the JS desktop nav closes its
// panels the same way, see HeaderBarDesktopNav.client.tsx). Keyboard use is
// unchanged until a navigation actually happens.

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

export function BlurOnNavigate() {
  const ref = useRef<HTMLSpanElement>(null);
  const pathname = usePathname();
  const first = useRef(true);

  useEffect(() => {
    // Nothing to close on the first render.
    if (first.current) {
      first.current = false;
      return;
    }
    const scope = ref.current?.parentElement;
    const active = document.activeElement;
    if (scope && active instanceof HTMLElement && scope.contains(active)) active.blur();
  }, [pathname]);

  return <span ref={ref} hidden />;
}
