'use client';

// AnnouncementBar — the thin promotional strip stores put above the
// header ("Free shipping over $50", "Summer sale 30% off", …). Optionally
// dismissible (close button hides it + remembers the dismissal in
// localStorage per scope id so it doesn't keep re-appearing).
//
// Three layouts:
//   simple   — single line of text + optional inline CTA link
//   marquee  — text scrolls horizontally (no JS needed; pure CSS keyframes)
//   rotating — N messages, fade-rotate every N seconds
//
// Client-only because of: dismissal state + auto-rotation timer + reading
// localStorage on mount.

import { useEffect, useId, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import type { SectionRenderProps } from '../../../types';
import { colorOr } from '../../../elementStyles';

interface AnnouncementMessage {
  text?: string;
  link_label?: string;
  link_url?: string;
}

type Layout = 'simple' | 'marquee' | 'rotating';

const STORAGE_PREFIX = 'msab-dismissed-'; // multi-store announcement bar

export function AnnouncementBar({ settings, content }: SectionRenderProps) {
  const messages = useMemo(
    () =>
      ((content.messages as AnnouncementMessage[]) || []).filter(
        (m): m is AnnouncementMessage & { text: string } => !!m?.text?.trim(),
      ),
    [content.messages],
  );

  const layout = (settings.layout as Layout) || 'simple';
  const dismissible = settings.dismissible === true;
  // Stable per-store key so dismiss persists across pages without leaking
  // across different bars (creators can change the key to "show again").
  const dismissKey = (settings.dismiss_key as string) || 'default';
  const rotateMs = Math.max(2000, Number(settings.rotate_ms) || 5000);
  const marqueeDurationS = Math.max(8, Number(settings.marquee_speed_s) || 25);
  const bg = colorOr(settings.bg_color, 'var(--theme-colors-primary)');
  const fg = colorOr(settings.text_color, 'var(--theme-colors-primaryContrast, #fff)');
  const linkColor = colorOr(settings.link_color, fg);

  const [dismissed, setDismissed] = useState(false);
  // Hydrate dismissed state on mount only — SSR renders the bar by default,
  // then we hide if the user dismissed it previously. Avoids flicker.
  useEffect(() => {
    if (!dismissible) return;
    if (typeof window === 'undefined') return;
    if (window.localStorage.getItem(STORAGE_PREFIX + dismissKey) === '1') {
      setDismissed(true);
    }
  }, [dismissible, dismissKey]);

  // Rotating layout — cycle the active message index.
  const [activeIdx, setActiveIdx] = useState(0);
  useEffect(() => {
    if (layout !== 'rotating' || messages.length <= 1) return;
    if (typeof window === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const id = window.setInterval(() => {
      setActiveIdx((i) => (i + 1) % messages.length);
    }, rotateMs);
    return () => window.clearInterval(id);
  }, [layout, messages.length, rotateMs]);

  const scopeId = `ab-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;

  if (dismissed || messages.length === 0) return null;

  function dismiss() {
    setDismissed(true);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_PREFIX + dismissKey, '1');
    }
  }

  function MessageContent({ msg }: { msg: AnnouncementMessage }) {
    return (
      <span className="inline-flex items-center gap-2 whitespace-nowrap">
        <span>{msg.text}</span>
        {msg.link_label && msg.link_url && (
          <a
            href={msg.link_url}
            className="underline font-medium hover:opacity-80 transition"
            style={{ color: linkColor }}
          >
            {msg.link_label}
          </a>
        )}
      </span>
    );
  }

  return (
    <div
      className={`relative ${scopeId}`}
      style={{ backgroundColor: bg, color: fg }}
    >
      <div className="mx-auto w-full px-4 sm:px-6 py-2 text-xs sm:text-sm font-medium flex items-center justify-center min-h-9">
        {layout === 'marquee' ? (
          <div className={`overflow-hidden flex-1 ${scopeId}-marquee`}>
            <div className="inline-flex gap-12 whitespace-nowrap will-change-transform">
              {/* Duplicate the message list once so the scroll loops seamlessly. */}
              {[...messages, ...messages].map((msg, i) => (
                <MessageContent key={i} msg={msg} />
              ))}
            </div>
          </div>
        ) : layout === 'rotating' ? (
          <div className="relative flex-1 flex items-center justify-center min-h-5">
            {messages.map((msg, i) => (
              <span
                key={i}
                aria-hidden={i !== activeIdx}
                className="absolute inset-0 flex items-center justify-center transition-opacity duration-500"
                style={{ opacity: i === activeIdx ? 1 : 0 }}
              >
                <MessageContent msg={msg} />
              </span>
            ))}
            {/* Invisible spacer reserves height equal to the tallest message. */}
            <span className="invisible">
              <MessageContent msg={messages[0]} />
            </span>
          </div>
        ) : (
          <MessageContent msg={messages[0]} />
        )}

        {dismissible && (
          <button
            type="button"
            onClick={dismiss}
            aria-label="Dismiss"
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
  animation-direction: reverse;
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
