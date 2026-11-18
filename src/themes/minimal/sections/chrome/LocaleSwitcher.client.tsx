'use client';

// Locale switcher for the chrome HeaderBar. Must be a client component:
// the storefront is served on a subdomain with clean, locale-prefixed paths
// (`/products`, `/ar/products`) while Next sees the rewritten internal path
// (`/store/[slug]/products`). usePathname() therefore returns the rewritten
// path — only `window.location.pathname` has the real browser URL. So we
// switch locale by rewriting the prefix on the live browser path, exactly
// like the built-in LanguageSwitcher does.

import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Globe } from 'lucide-react';
import { resolveLocaleMeta } from '@/lib/localeMeta';
import { MENU_EXIT_MS, useExit, type ChromeMotion } from './chromeMotion.client';

// Small flag image with a globe fallback (unknown locale or a failed load).
//
// Flags are never mirrored or cropped. The whole flag is drawn in its own
// proportions inside a fixed 24x16 slot (object-contain, so nothing moves
// while it loads): a 3:2 flag fills the slot, a 2:1 flag is 24x12, centred.
// No rounding and no ring on the box (they would clip or cover the artwork);
// the hairline is a drop shadow that follows the drawn flag, outside its
// pixels. No `rtl:` or scale class here or on any wrapper in this file.
function Flag({ url }: { url: string; label: string }) {
  const [failed, setFailed] = useState(false);
  if (!url || failed) return <Globe className="size-4 shrink-0 opacity-70" />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt=""
      aria-hidden
      width={24}
      height={16}
      decoding="async"
      onError={() => setFailed(true)}
      className="block h-4 w-6 shrink-0 object-contain [filter:drop-shadow(0_0_0.5px_rgb(0_0_0/0.45))]"
    />
  );
}

export function LocaleSwitcher({
  current,
  primary,
  others,
  accent,
  bg,
  fg,
  borderColor,
  motion,
}: {
  current: string;
  primary: string;
  others: string[];
  accent: string;
  /** Panel colours: the header's own background / text / border, so the
   *  list stays readable on dark headers (items inherit the header text). */
  bg: string;
  fg: string;
  borderColor: string;
  /** Store motion style: the list fades and rises in, and plays its close. */
  motion?: ChromeMotion;
}) {
  const all = Array.from(new Set([primary, ...others].filter(Boolean)));
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  // Motion style only: the closed list stays for its 0.2 s exit (inert).
  const closing = useExit(open, motion, MENU_EXIT_MS);

  const currentMeta = resolveLocaleMeta(current);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // A single-language store has nothing to switch to — render nothing.
  // (After the hooks above so the hook order stays stable.)
  if (all.length < 2) return null;

  const switchTo = (locale: string) => {
    const browserPath = window.location.pathname;
    // Strip any existing locale prefix from the live browser path.
    const existingPrefix = all.find(
      (l) => browserPath.startsWith(`/${l}/`) || browserPath === `/${l}`,
    );
    const cleanPath = existingPrefix
      ? browserPath.slice(`/${existingPrefix}`.length) || '/'
      : browserPath;

    // Primary locale has no prefix; secondary locales use the /[locale] prefix.
    const target =
      locale === primary ? cleanPath : `/${locale}${cleanPath === '/' ? '' : cleanPath}`;

    // Preserve any query string (e.g. product filters) on the new locale path.
    const targetUrl = `${target}${window.location.search}`;
    // Hard navigation so the proxy runs and server components re-render.
    window.location.assign(targetUrl);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="h-9 inline-flex items-center gap-1.5 px-2 rounded-md hover:bg-black/5 transition text-sm font-medium"
      >
        <Flag url={currentMeta.flagUrl} label={currentMeta.label} />
        <span>{currentMeta.label}</span>
        <ChevronDown
          className={`size-3.5 opacity-60 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {(open || closing) && (
        <div
          role="menu"
          {...(motion ? { 'data-cx-menu': 'list' } : null)}
          {...(closing ? { 'data-cx-closing': '', 'aria-hidden': true, inert: true } : null)}
          className="absolute inset-e-0 top-full mt-1.5 min-w-44 rounded-lg border shadow-lg py-1 z-50"
          style={{ backgroundColor: bg, color: fg, borderColor }}
        >
          {all.map((l) => {
            const meta = resolveLocaleMeta(l);
            const active = l === current;
            return (
              <button
                key={l}
                type="button"
                role="menuitem"
                onClick={() => switchTo(l)}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-sm font-medium hover:bg-black/5 transition"
                style={{ color: active ? accent : 'inherit' }}
              >
                <Flag url={meta.flagUrl} label={meta.label} />
                <span className="flex-1 text-start">{meta.label}</span>
                {active && <Check className="size-4 shrink-0" style={{ color: accent }} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
