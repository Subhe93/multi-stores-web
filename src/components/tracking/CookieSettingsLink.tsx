'use client';

import { useTranslations } from 'next-intl';
import { openConsentSettings } from '@/lib/consent';

// Permanent "Cookie settings" entry point (plans/consent-v2/CONTRACT.md §4.4 /
// D4a): rendered at the end of the store footer and in the checkout footer,
// on every screen size. It renders on the server (plain button, no state) and
// a click only opens the settings dialog through the consent manager.

export interface CookieSettingsLinkProps {
  /** 'footer-row': its own centred row; 'inline': inside an existing line. */
  variant?: 'footer-row' | 'inline';
}

export function CookieSettingsLink({ variant = 'inline' }: CookieSettingsLinkProps) {
  const t = useTranslations('consent');
  const button = (
    <button
      type="button"
      data-consent-settings-link=""
      aria-haspopup="dialog"
      onClick={() => openConsentSettings()}
      // Touch target: at least 24px (WCAG 2.5.8), 44px on phones, where this
      // is the only re-open entry point (the pill is md+ only).
      className="store-muted inline-flex min-h-11 items-center rounded px-2 py-1 text-xs underline-offset-2 hover:underline focus-visible:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--theme-colors-primary)] md:min-h-6"
    >
      {t('manage')}
    </button>
  );
  if (variant === 'footer-row') return <div className="flex justify-center py-1 md:py-2">{button}</div>;
  return button;
}
