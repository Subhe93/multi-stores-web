'use client';

import { useRef, type ElementType, type ReactNode } from 'react';
import { gsap, useGSAP, SplitText, EASE, DUR, STAGGER, TRIGGER, onPageReveal, fontsReady } from '@/lib/animations';

interface Props {
  children: ReactNode;
  as?: ElementType;
  className?: string;
  /** Split unit. Arabic always downgrades to words: character splits break ligatures. */
  type?: 'chars' | 'words' | 'lines';
  /** Play right after page reveal (hero) instead of on scroll. */
  immediate?: boolean;
  delay?: number;
  locale?: string;
}

/**
 * Masked line/word/char reveal built on SplitText (`mask` keeps the overflow
 * clip per line so no wrapper CSS is needed).
 */
export function SplitReveal({ children, as: Tag = 'h2', className, type = 'lines', immediate = false, delay = 0, locale }: Props) {
  const ref = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const el = ref.current;
      if (!el) return;
      const unit = type === 'chars' && locale === 'ar' ? 'words' : type;
      let split: SplitText | undefined;
      let cancel = () => {};
      let disposed = false;
      const run = () => {
        if (disposed) return;
        split = SplitText.create(el, {
          type: unit === 'lines' ? 'lines' : `${unit},lines`,
          mask: 'lines',
          autoSplit: true,
          onSplit: (self) => {
            const targets = unit === 'lines' ? self.lines : unit === 'words' ? self.words : self.chars;
            return gsap.fromTo(
              targets,
              { yPercent: 110, autoAlpha: 0 },
              {
                yPercent: 0,
                autoAlpha: 1,
                duration: DUR.slow,
                delay,
                ease: EASE.expo,
                stagger: unit === 'chars' ? 0.02 : unit === 'words' ? STAGGER.tight : STAGGER.base,
                ...(immediate ? {} : { scrollTrigger: { trigger: el, start: TRIGGER.reveal, once: true } }),
              },
            );
          },
        });
        gsap.set(el, { visibility: 'visible' });
      };
      fontsReady().then(() => {
        if (disposed) return;
        if (immediate) cancel = onPageReveal(run);
        else run();
      });
      return () => {
        disposed = true;
        cancel();
        split?.revert();
      };
    },
    { scope: ref },
  );

  return (
    <Tag ref={ref} className={className} data-reveal="split">
      {children}
    </Tag>
  );
}
