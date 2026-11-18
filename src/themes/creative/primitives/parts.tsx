// Small presentational primitives shared by the creative sections. All are
// plain functions without hooks (server-safe and client-safe); EmptyState is
// the one exception and lives in its own file because it reads translations.

import type { CSSProperties, ReactNode } from 'react';
import { FOCUS_RING } from '../../minimal/sections/_shared/links';
import { isArabicScript } from '../emphasis';

/** Thin label with a short rule at its inline start. */
export function Eyebrow({
  text,
  color,
  intro,
  className,
}: {
  text: string;
  color?: string;
  intro?: boolean;
  className?: string;
}) {
  if (!text) return null;
  return (
    <p
      className={className ? `cx-eyebrow ${className}` : 'cx-eyebrow'}
      data-cx-script={isArabicScript(text) ? 'arabic' : undefined}
      data-cx-intro={intro ? 'eyebrow' : undefined}
      style={color ? ({ '--cx-eyebrow': color } as CSSProperties) : undefined}
    >
      {text}
    </p>
  );
}

/**
 * Image wrapper that reveals its child. 'intro' only scales (1.06 to 1): the
 * image is never clipped or transparent, so it can be the LCP element.
 * 'scroll' clips the wrapper open when it enters the viewport.
 */
export function MaskReveal({
  mode,
  direction = 'up',
  className,
  style,
  children,
}: {
  mode: 'intro' | 'scroll';
  direction?: 'up' | 'start' | 'end';
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  return (
    <div
      className={className ? `cx-mask ${className}` : 'cx-mask'}
      data-cx-intro={mode === 'intro' ? 'scale' : undefined}
      data-cx-reveal={mode === 'scroll' ? 'mask' : undefined}
      data-cx-dir={mode === 'scroll' ? direction : undefined}
      style={style}
    >
      <div className="cx-mask-in">{children}</div>
    </div>
  );
}

/**
 * Pill link button. Colours come from the theme variables. Carries data-cx-magnetic; the inner span takes the
 * magnetic pull (--cx-mx / --cx-my), never the link itself.
 */
export function PillButton({
  href,
  children,
  variant = 'solid',
  tone = 'primary',
  arrow = true,
  className,
}: {
  href: string;
  children: ReactNode;
  variant?: 'solid' | 'outline';
  tone?: 'primary' | 'accent';
  arrow?: boolean;
  className?: string;
}) {
  return (
    <a
      href={href}
      className={['cx-btn', FOCUS_RING, className || ''].filter(Boolean).join(' ')}
      data-cx-magnetic=""
      data-cx-variant={variant === 'outline' ? 'outline' : undefined}
      data-cx-tone={tone === 'accent' ? 'accent' : undefined}
    >
      <span className="cx-btn-in">
        <span className="cx-btn-l">{children}</span>
        {arrow && (
          <svg
            className="cx-btn-arrow"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            focusable="false"
          >
            <path d="M2.5 8h11M9 3.5 13.5 8 9 12.5" />
          </svg>
        )}
      </span>
    </a>
  );
}
