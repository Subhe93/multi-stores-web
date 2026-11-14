'use client';

import { useTranslations } from 'next-intl';

// Floating "Cookie settings" pill (plans/consent-v2/CONTRACT.md §4.4 / D4).
// Desktop (md+) only, at the bottom start corner, so nothing floats over
// add-to-cart, cart or checkout CTAs on phones (they use the footer link).
// A click only OPENS the settings dialog: it never clears or revokes a
// choice. The manager decides when it renders (after a decision, never while
// the banner or dialog is open, never on checkout routes).

export interface CookieSettingsLauncherProps {
  onOpen(): void;
}

export function CookieSettingsLauncher({ onOpen }: CookieSettingsLauncherProps) {
  const t = useTranslations('consent');
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-haspopup="dialog"
      data-testid="consent-launcher"
      // A visible sticky CTA bar (z-50, bottom, all breakpoints) publishes its
      // height as --ms-bottom-bar; the pill sits above it instead of under it.
      style={{ bottom: 'calc(0.75rem + var(--ms-bottom-bar, 0px))' }}
      className="store-surface store-bd store-muted fixed bottom-3 inset-s-3 z-[50] hidden items-center rounded-full border px-3 py-1 text-[11px] shadow-sm transition hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--theme-colors-primary)] md:inline-flex"
    >
      {t('manage')}
    </button>
  );
}
