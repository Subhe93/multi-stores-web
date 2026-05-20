'use client';

// Component implementation. Definition lives in AuroraHero.tsx so the
// server-side theme registry resolves `.Component` to a ClientReference.

import { motion } from 'framer-motion';
import { buttonStyles, colorOr } from '../../elementStyles';
import type { SectionRenderProps } from '../../types';

type Height = 'md' | 'lg' | 'full';
const HEIGHT_CLASS: Record<Height, string> = {
  md: 'min-h-[460px]',
  lg: 'min-h-[600px]',
  full: 'min-h-[calc(100vh-80px)]',
};

// A modern, full-bleed hero with soft animated SVG "aurora" blobs drifting
// behind the headline. The blobs animate their cx/cy/r (not transforms), heavily
// blurred so they read as a living gradient. Degrades gracefully: under reduced
// motion the blobs simply rest in place.
export function AuroraHero({ settings, content }: SectionRenderProps) {
  const height = (settings.height as Height) || 'lg';
  const bg = colorOr(settings.bg_color, '#0b1020');
  const c1 = colorOr(settings.color_1, '#6366f1');
  const c2 = colorOr(settings.color_2, '#ec4899');
  const c3 = colorOr(settings.color_3, '#06b6d4');

  const eyebrow = (content.eyebrow as string) || '';
  const heading = (content.heading as string) || '';
  const subheading = (content.subheading as string) || '';
  const ctaText = (content.cta_text as string) || '';
  const ctaUrl = (settings.cta_url as string) || '#';
  const ctaSecondaryText = (content.cta_secondary_text as string) || '';
  const ctaSecondaryUrl = (settings.cta_secondary_url as string) || '#';

  const headingColor = colorOr(settings.heading_color, '#ffffff');
  const subheadingColor = colorOr(settings.subheading_color, 'rgba(255,255,255,0.82)');
  const eyebrowColor = colorOr(settings.eyebrow_color, c2);

  const primaryBtn = buttonStyles(
    { bg: settings.cta_bg_color, text: settings.cta_text_color, borderRadius: settings.cta_border_radius },
    { bg: '#ffffff', text: '#0b1020', radius: 'var(--theme-radius-full)' },
  );
  const secondaryBtn = buttonStyles(
    { borderColor: settings.cta_secondary_border_color },
    { bg: 'transparent', text: '#ffffff', border: 'rgba(255,255,255,0.5)', borderWidth: '1.5px', radius: 'var(--theme-radius-full)' },
  );

  const blobs = [
    { fill: c1, cx: [22, 30, 20, 22], cy: [32, 26, 38, 32], r: [30, 34, 28, 30], dur: 16 },
    { fill: c2, cx: [74, 66, 78, 74], cy: [36, 44, 30, 36], r: [28, 32, 26, 28], dur: 19 },
    { fill: c3, cx: [50, 56, 44, 50], cy: [72, 64, 78, 72], r: [26, 30, 24, 26], dur: 22 },
  ];

  return (
    <section
      className={`relative overflow-hidden flex items-center justify-center text-center px-6 ${HEIGHT_CLASS[height]}`}
      style={{
        backgroundColor: bg,
        width: '100vw',
        maxWidth: '100vw',
        marginLeft: 'calc(50% - 50vw)',
        marginRight: 'calc(50% - 50vw)',
      }}
    >
      {/* Animated SVG aurora — heavily blurred drifting blobs. */}
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden
        style={{ filter: 'blur(34px)', opacity: 0.7 }}
      >
        {blobs.map((b, i) => (
          <motion.circle
            key={i}
            fill={b.fill}
            cx={b.cx[0]}
            cy={b.cy[0]}
            r={b.r[0]}
            animate={{ cx: b.cx, cy: b.cy, r: b.r }}
            transition={{ duration: b.dur, repeat: Infinity, ease: 'easeInOut' }}
          />
        ))}
      </svg>

      <div className="relative z-10 flex max-w-3xl flex-col items-center gap-5">
        {eyebrow && (
          <span className="text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: eyebrowColor }}>
            {eyebrow}
          </span>
        )}
        {heading && (
          <h1
            className="leading-[1.05]"
            style={{
              fontFamily: 'var(--theme-font-heading)',
              fontSize: 'var(--theme-scale-h1)',
              fontWeight: 'var(--theme-weight-heading)',
              letterSpacing: 'var(--theme-tracking-heading)',
              color: headingColor,
            }}
          >
            {heading}
          </h1>
        )}
        {subheading && (
          <p className="max-w-prose" style={{ color: subheadingColor, fontSize: 'var(--theme-scale-body)', lineHeight: 'var(--theme-line-body)' }}>
            {subheading}
          </p>
        )}
        {(ctaText || ctaSecondaryText) && (
          <div className="mt-2 flex flex-wrap justify-center gap-3">
            {ctaText && (
              <a href={ctaUrl} className="inline-flex items-center justify-center px-8 py-3 transition-all hover:opacity-90 hover:-translate-y-px" style={{ ...primaryBtn, fontWeight: 'var(--theme-weight-bold)' }}>
                {ctaText}
              </a>
            )}
            {ctaSecondaryText && (
              <a href={ctaSecondaryUrl} className="inline-flex items-center justify-center px-8 py-3 transition hover:opacity-90" style={{ ...secondaryBtn, fontWeight: 'var(--theme-weight-bold)' }}>
                {ctaSecondaryText}
              </a>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
