'use client';

// AnnouncementBar — the thin promotional strip stores put above the
// header ("Free shipping over $50", "Summer sale 30% off", …). Optionally
// dismissible (close button hides it + remembers the dismissal in
// localStorage per store and dismiss key so it doesn't keep re-appearing).
//
// Three layouts:
//   simple   — the first message, centred, wraps on narrow screens
//   marquee  — messages scroll horizontally on one line (pure CSS keyframes)
//   rotating — N messages, fade-rotate every N seconds; wraps like simple
//
// Marquee and rotation pause while the bar is hovered or holds focus, and
// stop for visitors who prefer reduced motion.
//
// Client-only because of: dismissal state + auto-rotation timer + reading
// localStorage on mount.

import { useEffect, useId, useMemo, useState, useSyncExternalStore } from 'react';
import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { localizeStoreUrl, storeLocalePrefix } from '@/lib/storeUrl';
import type { SectionRenderProps } from '../../../types';
import { colorOr } from '../../../elementStyles';

interface AnnouncementMessage {
  text?: string;
  link_label?: string;
  link_url?: string;
  /** Payment badge shown right after the text ("Betala med [Klarna]"). */
  badge?: string;
}

// Built-in payment badges: official artwork served from /public (no
// third-party request), drawn at text height. Keyed by the `badge` value.
const BADGES: Record<string, { src: string; alt: string; width: number; height: number }> = {
  klarna: { src: '/payment-badges/klarna.svg', alt: 'Klarna', width: 43, height: 18 },
};

type Layout = 'simple' | 'marquee' | 'rotating';

const STORAGE_PREFIX = 'msab-dismissed-'; // multi-store announcement bar

// Storage access throws when the browser blocks site data (private modes,
// strict cookie settings): a dismissal then simply lasts for this page view.
function readFlag(key: string): boolean {
  try {
    return window.localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

// The stored flag only changes through this bar's own button (local state),
// so there is nothing to subscribe to.
const noSubscribe = () => () => {};

function writeFlag(key: string): void {
  try {
    window.localStorage.setItem(key, '1');
  } catch {
    // Storage unavailable — nothing to persist.
  }
}

export function AnnouncementBar({ settings, content, locale, primaryLocale, storeSlug }: SectionRenderProps) {
  const t = useTranslations('nav');
  const messages = useMemo(
    () =>
      ((content.messages as AnnouncementMessage[]) || []).filter(
        (m): m is AnnouncementMessage & { text: string } => !!m?.text?.trim(),
      ),
    [content.messages],
  );

  const layout = (settings.layout as Layout) || 'simple';
  const dismissible = settings.dismissible === true;
  // Creators change the key to "show again" after a dismissal.
  const dismissKey = (settings.dismiss_key as string) || 'default';
  // Scoped per store so one store's dismissal does not hide another store's
  // bar; the older un-scoped key is still honoured when reading.
  const storageKey = `${STORAGE_PREFIX}${storeSlug}-${dismissKey}`;
  const legacyStorageKey = STORAGE_PREFIX + dismissKey;
  const rotateMs = Math.max(2000, Number(settings.rotate_ms) || 5000);
  const marqueeDurationS = Math.max(8, Number(settings.marquee_speed_s) || 25);
  const bg = colorOr(settings.bg_color, 'var(--theme-colors-primary)');
  const fg = colorOr(settings.text_color, 'var(--theme-colors-primaryContrast, #fff)');
  const linkColor = colorOr(settings.link_color, fg);
  // 'button' renders the inline link as a small outlined rounded button.
  const linkAsButton = settings.link_style === 'button';
  // Secondary-locale visitors keep their locale prefix on the inline link.
  const lp = storeLocalePrefix(locale, primaryLocale);

  // A dismissal stored by an earlier visit. The server snapshot is "not
  // dismissed", so SSR and hydration render the bar and the client hides it
  // right after (no hydration mismatch).
  const storedDismissal = useSyncExternalStore(
    noSubscribe,
    () => dismissible && (readFlag(storageKey) || readFlag(legacyStorageKey)),
    () => false,
  );
  const [dismissedNow, setDismissedNow] = useState(false);
  const dismissed = dismissedNow || storedDismissal;

  // Hover / keyboard focus inside the bar pauses rotation (the marquee
  // pauses through CSS).
  const [paused, setPaused] = useState(false);

  // Rotating layout — cycle the active message index.
  const [activeIdx, setActiveIdx] = useState(0);
  useEffect(() => {
    if (layout !== 'rotating' || messages.length <= 1 || paused) return;
    if (typeof window === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const id = window.setInterval(() => {
      setActiveIdx((i) => (i + 1) % messages.length);
    }, rotateMs);
    return () => window.clearInterval(id);
  }, [layout, messages.length, rotateMs, paused]);

  const scopeId = `ab-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;

  if (dismissed || messages.length === 0) return null;

  function dismiss() {
    setDismissedNow(true);
    writeFlag(storageKey);
  }

  const badgeOf = (msg: AnnouncementMessage, spacing = '') => {
    const badge = msg.badge ? BADGES[msg.badge] : undefined;
    if (!badge) return null;
    // Plain <img>: a tiny static SVG from /public, nothing to optimize.
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={badge.src}
        alt={badge.alt}
        width={badge.width}
        height={badge.height}
        className={`inline-block h-4.5 w-auto shrink-0 align-middle ${spacing}`}
      />
    );
  };

  const linkOf = (msg: AnnouncementMessage) =>
    msg.link_label && msg.link_url ? (
      <a
        href={localizeStoreUrl(msg.link_url, lp, locale)}
        className={
          linkAsButton
            ? 'inline-flex items-center align-middle rounded-full border bg-transparent px-3 py-0.5 text-sm font-medium leading-5 hover:opacity-80 transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current'
            : 'underline font-medium hover:opacity-80 transition'
        }
        style={linkAsButton ? { color: linkColor, borderColor: linkColor } : { color: linkColor }}
      >
        {msg.link_label}
      </a>
    ) : null;

  // One line, never wrapping (marquee track). Plain render helpers rather
  // than components declared inside render, so React does not treat them as
  // new element types (and remount) every render.
  const renderLine = (msg: AnnouncementMessage, key: number) => (
    <span key={key} className="inline-flex items-center gap-2 whitespace-nowrap pe-12">
      <span>{msg.text}</span>
      {badgeOf(msg)}
      {linkOf(msg)}
    </span>
  );

  // Centred, wrapping text (simple + rotating). The badge and the link stay
  // in the text flow, so the badge sits right after the words it belongs to.
  const renderWrapped = (msg: AnnouncementMessage) => {
    // No space before the badge: it never wraps away from the last word.
    const badge = badgeOf(msg, 'ms-2');
    const link = linkOf(msg);
    return (
      <span className="block text-center">
        <span>{msg.text}</span>
        {badge}
        {link && <> <span className="ms-1">{link}</span></>}
      </span>
    );
  };

  return (
    <div
      className={`relative ${scopeId}`}
      style={{ backgroundColor: bg, color: fg }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setPaused(false);
      }}
    >
      <div
        className={`mx-auto w-full ${dismissible ? 'px-10' : 'px-4 sm:px-6'} py-2 text-xs sm:text-sm font-medium flex items-center justify-center min-h-9`}
      >
        {layout === 'marquee' ? (
          <div className={`overflow-hidden flex-1 ${scopeId}-marquee`}>
            {/* Two identical halves: the track moves by exactly one half
                (each item carries its own trailing gap), so the loop is
                seamless. The copy is decorative — hidden from assistive tech
                and out of the tab order. */}
            <div className="inline-flex whitespace-nowrap will-change-transform">
              <span className="inline-flex shrink-0">{messages.map((msg, i) => renderLine(msg, i))}</span>
              <span className="inline-flex shrink-0" aria-hidden inert>
                {messages.map((msg, i) => renderLine(msg, i))}
              </span>
            </div>
          </div>
        ) : layout === 'rotating' ? (
          // All messages share one grid cell: the bar takes the tallest
          // message's height, so rotating never makes it jump.
          <div className="grid flex-1 items-center">
            {messages.map((msg, i) => (
              <div
                key={i}
                aria-hidden={i !== activeIdx}
                // Hidden messages may hold links: keep them out of the tab order.
                inert={i !== activeIdx}
                className="[grid-area:1/1] transition-opacity duration-500"
                style={{ opacity: i === activeIdx ? 1 : 0 }}
              >
                {renderWrapped(msg)}
              </div>
            ))}
          </div>
        ) : (
          renderWrapped(messages[0])
        )}

        {dismissible && (
          <button
            type="button"
            onClick={dismiss}
            aria-label={t('dismissAnnouncement')}
            className="absolute end-2 top-1/2 -translate-y-1/2 size-7 inline-flex items-center justify-center rounded-md hover:bg-black/10 transition"
            style={{ color: fg }}
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>

      {layout === 'marquee' && (
        <style
          dangerouslySetInnerHTML={{
            __html: `
.${scopeId}-marquee > div {
  animation: ${scopeId}-scroll ${marqueeDurationS}s linear infinite;
}
@keyframes ${scopeId}-scroll {
  from { transform: translateX(0); }
  to { transform: translateX(-50%); }
}
[dir="rtl"] .${scopeId}-marquee > div {
  animation-name: ${scopeId}-scroll-rtl;
}
@keyframes ${scopeId}-scroll-rtl {
  from { transform: translateX(0); }
  to { transform: translateX(50%); }
}
.${scopeId}:hover .${scopeId}-marquee > div,
.${scopeId}:focus-within .${scopeId}-marquee > div {
  animation-play-state: paused;
}
@media (prefers-reduced-motion: reduce) {
  .${scopeId}-marquee > div { animation: none; }
}
            `.trim(),
          }}
        />
      )}
    </div>
  );
}
