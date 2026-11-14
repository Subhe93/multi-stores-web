'use client';

import { useEffect, useId, useRef, type CSSProperties } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useLocalePath } from '@/hooks/useLocalePath';
import { consentTextHash } from '@/lib/consentLog';

// First layer of the cookie consent (plans/consent-v2/CONTRACT.md §4.2).
// Purely presentational: the manager (<StoreTracking>) owns the choice and
// the storage writes. Non-modal region: no focus trap, no backdrop, never
// steals focus, ESC does nothing (closing or ignoring it is not consent).
//
// Mobile: full-width bottom sheet (at most half the small viewport; only the
// text scrolls, the three buttons always stay visible). Desktop (md+):
// compact card at the bottom start corner. While visible it publishes its
// height as `--ms-consent-inset` on <html> and pads <body> by it, so fixed
// bottom bars (sticky add-to-cart, bottom nav, toasts) move above it and the
// checkout pay button can scroll clear of it.
//
// Stacking: z-[35], above the bottom bars (z-30, lifted by the inset) but
// BELOW full-height overlays (cart drawer z-50, mobile menu and its z-40
// backdrop, dialogs), so an overlay the visitor opens before deciding is
// never covered by the banner.

export interface CookieBannerProps {
  offered: { analytics: boolean; marketing: boolean };
  /** Microsoft Clarity configured: the recordings sentence is shown. */
  recordings: boolean;
  /** Store-relative cookie page path (e.g. '/om-cookies'), when published. */
  cookiePolicyHref: string | null;
  /** Store-relative privacy page path ('/legal/privacy'). */
  privacyHref: string;
  onAcceptAll(textHash: string): void;
  onRejectAll(textHash: string): void;
  onOpenSettings(): void;
  /**
   * The settings dialog is open on top: the banner stays mounted (so focus
   * can return to its Settings button and the published inset does not jump)
   * but is invisible and inert.
   */
  hidden?: boolean;
}

/** CSS variable carrying the banner height while it is visible. */
export const CONSENT_INSET_VAR = '--ms-consent-inset';

// Every decision button on both layers shares ONE style: same size, colour
// and weight, so rejecting is exactly as prominent as accepting (EDPB / IMY).
export const CONSENT_BUTTON_CLASS =
  'inline-flex min-h-11 items-center justify-center rounded-md border px-4 py-2 text-sm font-semibold transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--theme-colors-primary)] disabled:cursor-wait';
export const CONSENT_BUTTON_STYLE: CSSProperties = {
  backgroundColor: 'var(--theme-colors-primary)',
  borderColor: 'var(--theme-colors-primary)',
  color: 'var(--theme-colors-primaryContrast, #fff)',
};

const LINK_CLASS = 'underline underline-offset-2 hover:opacity-80';

export function CookieBanner({
  offered,
  recordings,
  cookiePolicyHref,
  privacyHref,
  onAcceptAll,
  onRejectAll,
  onOpenSettings,
  hidden = false,
}: CookieBannerProps) {
  const t = useTranslations('consent');
  const lp = useLocalePath();
  const titleId = useId();
  const bodyId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  // One decision per banner: a double tap while hashing must not save twice.
  const busy = useRef(false);

  // Publish the banner height so fixed bottom bars sit above it.
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const html = document.documentElement;
    const update = () => {
      html.style.setProperty(CONSENT_INSET_VAR, `${Math.ceil(el.getBoundingClientRect().height)}px`);
    };
    update();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
    observer?.observe(el);
    window.addEventListener('resize', update);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', update);
      html.style.removeProperty(CONSENT_INSET_VAR);
    };
  }, []);

  const decide = async (callback: (hash: string) => void) => {
    if (busy.current) return;
    busy.current = true;
    let hash = 'unavailable';
    try {
      hash = await consentTextHash(rootRef.current);
    } catch {
      // Keep 'unavailable': the decision itself must never be blocked.
    }
    try {
      callback(hash);
    } finally {
      busy.current = false;
    }
  };

  const body =
    offered.analytics && offered.marketing
      ? t('bodyAnalyticsMarketing')
      : offered.marketing
        ? t('bodyMarketing')
        : t('bodyAnalytics');

  return (
    <div
      ref={rootRef}
      role="region"
      aria-labelledby={titleId}
      aria-describedby={bodyId}
      aria-hidden={hidden || undefined}
      inert={hidden || undefined}
      data-testid="consent-banner"
      className="store-surface store-bd fixed z-[35] flex flex-col border shadow-[0_-4px_24px_rgba(0,0,0,0.12)] max-md:inset-x-0 max-md:bottom-0 max-md:max-h-[50svh] max-md:rounded-t-xl max-md:border-x-0 max-md:border-b-0 md:bottom-4 md:inset-s-4 md:max-h-[calc(100svh-2rem)] md:w-[calc(100%-2rem)] md:max-w-[34rem] md:rounded-xl"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)', visibility: hidden ? 'hidden' : undefined }}
    >
      {/* Page content (incl. the checkout pay button) can scroll clear of the banner. */}
      <style>{`body{padding-bottom:var(${CONSENT_INSET_VAR},0px)}`}</style>
      {/* Only the text scrolls; the three choices below always stay visible. */}
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 pt-4 pb-3 text-start" style={{ overscrollBehavior: 'contain' }}>
        <h2 id={titleId} data-consent-text="" className="text-sm font-semibold">
          {t('title')}
        </h2>
        <div id={bodyId} className="store-muted space-y-1.5 text-xs leading-relaxed">
          <p data-consent-text="">{body}</p>
          {recordings && <p data-consent-text="">{t('recordings')}</p>}
        </div>
        <p className="store-muted flex flex-wrap gap-x-4 gap-y-1 text-xs">
          {cookiePolicyHref && (
            <Link href={lp(cookiePolicyHref)} className={LINK_CLASS} data-consent-text="">
              {t('cookiePolicy')}
            </Link>
          )}
          <Link href={lp(privacyHref)} className={LINK_CLASS} data-consent-text="">
            {t('privacyPolicy')}
          </Link>
        </p>
      </div>
      <div className="shrink-0 px-4 pb-4">
        {/* DOM order: Accept all, Reject all, Settings (contract §4.2). */}
        {/* Mobile: [Accept all][Reject all] then Settings full width; the span
            lives on the container so the three buttons keep one identical class. */}
        <div className="grid grid-cols-2 gap-2 md:flex md:flex-wrap max-md:[&>*:last-child]:col-span-2">
          <button
            type="button"
            data-consent-action="accept_all"
            data-consent-text=""
            onClick={() => void decide(onAcceptAll)}
            className={`${CONSENT_BUTTON_CLASS} md:flex-1`}
            style={CONSENT_BUTTON_STYLE}
          >
            {t('acceptAll')}
          </button>
          <button
            type="button"
            data-consent-action="reject_all"
            data-consent-text=""
            onClick={() => void decide(onRejectAll)}
            className={`${CONSENT_BUTTON_CLASS} md:flex-1`}
            style={CONSENT_BUTTON_STYLE}
          >
            {t('rejectAll')}
          </button>
          <button
            type="button"
            data-consent-action="settings"
            data-consent-text=""
            onClick={onOpenSettings}
            className={`${CONSENT_BUTTON_CLASS} md:flex-1`}
            style={CONSENT_BUTTON_STYLE}
          >
            {t('settings')}
          </button>
        </div>
      </div>
    </div>
  );
}
