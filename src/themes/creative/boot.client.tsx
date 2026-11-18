'use client';

// The ONLY creative client module that server code reaches statically. It
// imports no library: the engine, GSAP, ScrollTrigger and Lenis are separate
// async chunks fetched by the plain import() calls below, after hydration
// and only on pages that render an island or the store switch.

import { useEffect, useLayoutEffect, useRef } from 'react';
import { usePathname, useRouter, useSelectedLayoutSegment } from 'next/navigation';
import type { CreativeOptions } from './creativeAttrs';
import { setMotionFlag } from './motionFlag';

/**
 * Island of one creative section: registers its closest [data-cx-section]
 * with the engine core (scroll reveals and behaviours of that scope).
 */
export function Cx() {
  const anchor = useRef<HTMLSpanElement>(null);

  // After a client-side navigation the inline flag script does not run.
  useLayoutEffect(() => {
    setMotionFlag();
  }, []);

  useEffect(() => {
    const scope = anchor.current?.closest<HTMLElement>('[data-cx-section]');
    if (!scope) return;
    let cancelled = false;
    let cleanup: (() => void) | undefined;
    import('./engine/core')
      .then((m) => {
        if (cancelled) return;
        cleanup = m.register(scope);
      })
      // A failed chunk leaves the static page: nothing was hidden yet.
      .catch(() => {});
    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, []);

  return <span hidden data-cx-anchor="" ref={anchor} />;
}

/**
 * Store-level runtime (smooth scrolling, magnetic buttons, page curtain).
 * Mounted by the store layout only when the store switched creative motion
 * on. Renders nothing; everything is decided in runtime/store per route.
 */
export function CreativeBoot({
  options,
  curtainLabel,
  logoUrl,
}: {
  options: CreativeOptions;
  curtainLabel: string;
  logoUrl?: string;
}): null {
  const segment = useSelectedLayoutSegment();
  const pathname = usePathname();
  const router = useRouter();
  const { smooth, magnetic, curtain } = options;

  useLayoutEffect(() => {
    setMotionFlag();
  }, []);

  useEffect(() => {
    let cancelled = false;
    import('./runtime/store')
      .then((m) => {
        if (cancelled) return;
        m.sync({
          options: { smooth, magnetic, curtain },
          segment,
          pathname: pathname || '/',
          curtainLabel,
          logoUrl,
          push: (href) => router.push(href),
          prefetch: (href) => router.prefetch(href),
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [smooth, magnetic, curtain, segment, pathname, curtainLabel, logoUrl, router]);

  useEffect(
    () => () => {
      import('./runtime/store').then((m) => m.destroy()).catch(() => {});
    },
    [],
  );

  return null;
}
