'use client';

// Component implementation. Definition lives in StickyCtaBar.tsx so the
// server-side theme registry resolves `.Component` to a ClientReference.

import { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { X } from 'lucide-react';
import { buttonStyles, colorOr, numberOr } from '../../elementStyles';
import type { SectionRenderProps } from '../../types';

// A call-to-action bar that slides up and pins to the bottom of the viewport
// once the visitor scrolls past a threshold. Dismissible, and it snaps without
// animation under prefers-reduced-motion.
export function StickyCtaBar({ settings, content }: SectionRenderProps) {
  const text = (content.text as string) || '';
  const ctaText = (content.cta_text as string) || '';
  const ctaUrl = (settings.cta_url as string) || '#';
  const showClose = settings.show_close !== false;
  const threshold = numberOr(settings.show_after_px, 500);

  const reduced = useReducedMotion();
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > threshold);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [threshold]);

  if (!text && !ctaText) {
    // Nothing to show — render a tiny in-flow hint so creators see it exists.
    return (
      <p className="text-center text-xs py-4" style={{ color: 'var(--theme-colors-muted)' }}>
        Sticky bar — add text and a button from the builder.
      </p>
    );
  }

  const barBg = colorOr(settings.bar_bg_color, 'var(--theme-colors-primary)');
  const textColor = colorOr(settings.text_color, 'var(--theme-colors-primaryContrast, #fff)');

  const ctaStyle = buttonStyles(
    {
      bg: settings.cta_bg_color,
      text: settings.cta_text_color,
      borderColor: settings.cta_border_color,
      borderWidth: settings.cta_border_width,
      borderRadius: settings.cta_border_radius,
    },
    {
      bg: 'var(--theme-colors-accent)',
      text: 'var(--theme-colors-primaryContrast, #fff)',
      radius: 'var(--theme-radius-full)',
    },
  );

  const show = visible && !dismissed;

  return (
    <motion.div
      className="fixed inset-x-0 bottom-0 z-50 px-3 pb-3 pointer-events-none"
      initial={false}
      animate={{ y: show ? 0 : 160, opacity: show ? 1 : 0 }}
      transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 320, damping: 32 }}
      aria-hidden={!show}
    >
      <div
        className="pointer-events-auto mx-auto max-w-3xl flex items-center gap-4 px-5 py-3"
        style={{
          backgroundColor: barBg,
          color: textColor,
          borderRadius: 'var(--theme-radius-lg)',
          boxShadow: 'var(--theme-shadow-lg)',
        }}
      >
        {text && <p className="text-sm font-medium flex-1 min-w-0">{text}</p>}
        {ctaText && (
          <a
            href={ctaUrl}
            className="inline-flex items-center justify-center px-5 py-2 text-sm shrink-0 transition hover:opacity-90"
            style={{ ...ctaStyle, fontWeight: 'var(--theme-weight-bold)' }}
          >
            {ctaText}
          </a>
        )}
        {showClose && (
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="shrink-0 opacity-70 hover:opacity-100 transition-opacity"
            aria-label="Dismiss"
          >
            <X className="size-4" />
          </button>
        )}
      </div>
    </motion.div>
  );
}
