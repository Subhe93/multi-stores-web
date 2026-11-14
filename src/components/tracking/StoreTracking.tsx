'use client';

import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useSelectedLayoutSegments } from 'next/navigation';
import { useLocale } from 'next-intl';
import {
  CONSENT_OPEN_EVENT,
  COOKIE_SETTINGS_HASH,
  consentSnapshot,
  parseConsentSnapshot,
  saveTrackingChoice,
  setExternalMedia,
  storeVendors,
  subscribeConsent,
  type ConsentAction,
  type StoreTracking as StoreTrackingIds,
  type TrackerVendor,
} from '@/lib/consent';
import { ClarityScript } from './ClarityScript';
import { clarityAllowedFor, clarityRanInDocument, isClarityExcludedPath, revokeConsentCategories } from './clarity';
import { reloadPage } from './pageReload';
import type { ConsentDialogAction, ConsentDialogChoice } from './CookieSettingsDialog';
import { CookieSettingsLauncher } from './CookieSettingsLauncher';

// The banner and the dialog are separate chunks: a returning visitor who
// already decided never needs the banner, and the dialog loads only when it
// is opened. Only the decision + vendor-loading logic is in every page's
// bundle. Nothing renders on the server here (see `hydrated`), so lazy never
// suspends during SSR.
const CookieBanner = lazy(() => import('./CookieBanner').then((m) => ({ default: m.CookieBanner })));
const CookieSettingsDialog = lazy(() =>
  import('./CookieSettingsDialog').then((m) => ({ default: m.CookieSettingsDialog })),
);
import { TrackingScripts } from './TrackingScripts';

// The storefront consent manager (plans/consent-v2/CONTRACT.md §7.1),
// mounted by the store layout for EVERY store:
// - the stored choice is read through useSyncExternalStore as a primitive
//   snapshot with a server snapshot of "not hydrated yet" ('?'), so SSR
//   renders nothing and hydration never mismatches;
// - categories: analytics (GA4, Clarity), marketing (Meta, TikTok, Google
//   ad_* signals), external media (YouTube, Vimeo, Google Maps; the facades
//   read it themselves). Each vendor mounts only under its category; with
//   `consent_required = false` GA4 / Meta / TikTok load without consent
//   (D10) and Clarity stays gated;
// - the first-layer banner shows while a store with gated trackers has no
//   valid decision; the settings dialog opens from the banner, the desktop
//   pill, the footer link (CONSENT_OPEN_EVENT), any `#cookie-settings` link
//   and a URL arriving with that hash. Opening never revokes anything;
// - withdrawing a category that ran a vendor in this document sends the
//   vendor "denied", clears its cookies and reloads (clarity.ts);
// - Microsoft Clarity never loads on account / auth / order confirmation
//   pages, also after a client navigation (route effects below).
//
// Rendered by the store layout, so the layout segments below it drive the
// Clarity route gate and follow client navigations.

interface StoreTrackingProps {
  storeSlug: string;
  tracking: StoreTrackingIds | null | undefined;
  /** Store-relative path of the cookie-policy page, when published. */
  cookiePolicyHref?: string | null;
  /** Store-relative path of the privacy policy. */
  privacyHref?: string;
}

const noopSubscribe = () => () => {};

export function StoreTracking({ storeSlug, tracking, cookiePolicyHref = null, privacyHref = '/legal/privacy' }: StoreTrackingProps) {
  const locale = useLocale();
  const segments = useSelectedLayoutSegments();
  const t = tracking ?? null;

  // Stable per tracking config (the payload object may be recreated).
  const ga4Id = t?.ga4_measurement_id ?? null;
  const metaId = t?.meta_pixel_id ?? null;
  const tiktokId = t?.tiktok_pixel_id ?? null;
  const clarityId = t?.clarity_project_id || '';
  const consentRequired = t?.consent_required !== false;
  const hasConfig = t !== null;
  const ids = useMemo<StoreTrackingIds | null>(
    () =>
      hasConfig
        ? {
            ga4_measurement_id: ga4Id,
            meta_pixel_id: metaId,
            tiktok_pixel_id: tiktokId,
            clarity_project_id: clarityId || null,
            consent_required: consentRequired,
          }
        : null,
    [hasConfig, ga4Id, metaId, tiktokId, clarityId, consentRequired],
  );
  const vendors = useMemo(() => storeVendors(ids), [ids]);
  const offered = useMemo(
    () => ({ analytics: vendors.analytics.length > 0, marketing: vendors.marketing.length > 0 }),
    [vendors],
  );
  const hasGated = offered.analytics || offered.marketing;

  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const snapshot = useSyncExternalStore(
    subscribeConsent,
    () => consentSnapshot(storeSlug, ids),
    () => '?',
  );
  const parsed = useMemo(() => parseConsentSnapshot(snapshot), [snapshot]);
  const decision = hydrated ? parsed.tracking : null;
  const allowA = decision?.analytics === true;
  const allowM = decision?.marketing === true;

  const [dialogOpen, setDialogOpen] = useState(false);
  const openDialog = useCallback(() => setDialogOpen(true), []);

  // Re-open entry points (D4): the footer link / openConsentSettings(),
  // any `#cookie-settings` link (captured before Next's <Link>), and a URL
  // arriving with the hash.
  useEffect(() => {
    window.addEventListener(CONSENT_OPEN_EVENT, openDialog);
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const anchor = (e.target as Element | null)?.closest?.(`a[href$="${COOKIE_SETTINGS_HASH}"]`);
      if (!anchor) return;
      e.preventDefault();
      openDialog();
    };
    document.addEventListener('click', onClick, true);
    if (window.location.hash === COOKIE_SETTINGS_HASH) {
      openDialog();
      try {
        window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search);
      } catch {
        // History unavailable: the hash just stays.
      }
    }
    return () => {
      window.removeEventListener(CONSENT_OPEN_EVENT, openDialog);
      document.removeEventListener('click', onClick, true);
    };
  }, [openDialog]);

  // Withdrawal in this document (also from another tab): a category that was
  // granted and no longer is.
  const previous = useRef<{ analytics: boolean; marketing: boolean } | null>(null);
  const gatedVendors = useMemo<TrackerVendor[]>(() => [...vendors.analytics, ...vendors.marketing], [vendors]);
  useEffect(() => {
    if (!hydrated) return;
    const was = previous.current;
    previous.current = { analytics: allowA, marketing: allowM };
    if (!was) return;
    const lostA = was.analytics && !allowA;
    const lostM = was.marketing && !allowM;
    if (lostA || lostM) revokeConsentCategories({ analytics: lostA, marketing: lostM, gated: gatedVendors });
  }, [hydrated, allowA, allowM, gatedVendors]);

  // Excluded routes: unmounting <ClarityScript> does not stop a Clarity tag
  // that already ran (it follows client navigations). Links to account /
  // auth / confirmation pages become full page loads while Clarity is in
  // the document (captured before Next's <Link> handler, which skips a
  // prevented click), and any other client navigation that still lands on
  // an excluded route stops Clarity and reloads into a fresh document.
  const routeAllowed = clarityAllowedFor(segments);
  useEffect(() => {
    if (!clarityId || routeAllowed || !clarityRanInDocument()) return;
    window.clarity?.('stop');
    reloadPage();
  }, [clarityId, routeAllowed]);
  useEffect(() => {
    if (!clarityId || !allowA) return;
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (!clarityRanInDocument()) return;
      const anchor = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!anchor || anchor.hasAttribute('download')) return;
      if (anchor.target && anchor.target !== '_self') return;
      let url: URL;
      try {
        url = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin || !isClarityExcludedPath(url.pathname)) return;
      e.preventDefault();
      window.location.assign(url.href);
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [clarityId, allowA]);

  if (!hydrated) return null;

  const onBannerChoice = (all: boolean, textHash: string) => {
    saveTrackingChoice(
      storeSlug,
      { analytics: all && offered.analytics, marketing: all && offered.marketing, external_media: all },
      ids,
      { action: all ? 'accept_all' : 'reject_all', source: 'banner', textHash, locale },
    );
  };

  const onDialogSave = (choice: ConsentDialogChoice, action: ConsentDialogAction, textHash: string) => {
    if (hasGated) {
      saveTrackingChoice(
        storeSlug,
        {
          analytics: choice.analytics && offered.analytics,
          marketing: choice.marketing && offered.marketing,
          external_media: choice.external_media,
        },
        ids,
        { action, source: 'dialog', textHash, locale },
      );
    } else {
      // No gated trackers (D9): the dialog only carries external media.
      const changed = choice.external_media !== parsed.external;
      const derived: ConsentAction =
        action === 'save' && !changed ? 'save' : choice.external_media ? 'external_media_grant' : 'external_media_revoke';
      setExternalMedia(storeSlug, choice.external_media, { action: derived, source: 'dialog', textHash, locale });
    }
    setDialogOpen(false);
  };

  const ungated = vendors.ungated;
  const ga4On = (allowA && vendors.analytics.includes('ga4')) || ungated.includes('ga4');
  const metaOn = (allowM && vendors.marketing.includes('meta')) || ungated.includes('meta');
  const tiktokOn = (allowM && vendors.marketing.includes('tiktok')) || ungated.includes('tiktok');
  const adSignals = allowM || !consentRequired;
  const clarityOn = allowA && Boolean(clarityId) && routeAllowed;

  // The banner stays mounted (hidden + inert) while the dialog is open, so
  // closing the dialog returns focus to its Settings button and the bottom
  // inset it publishes does not jump.
  const showBanner = hasGated && decision === null;
  const onCheckout = segments[0] === '(checkout)';
  const showLauncher =
    !showBanner && !dialogOpen && !onCheckout && ((hasGated && decision !== null) || parsed.external);

  return (
    <>
      {ids && (ga4On || metaOn || tiktokOn) && (
        <TrackingScripts tracking={ids} ga4={ga4On} meta={metaOn} tiktok={tiktokOn} adSignals={adSignals} />
      )}
      {clarityOn && <ClarityScript projectId={clarityId} />}
      {showBanner && (
        <Suspense fallback={null}>
          <CookieBanner
            offered={offered}
            recordings={vendors.analytics.includes('clarity')}
            cookiePolicyHref={cookiePolicyHref}
            privacyHref={privacyHref}
            onAcceptAll={(hash) => onBannerChoice(true, hash)}
            onRejectAll={(hash) => onBannerChoice(false, hash)}
            onOpenSettings={openDialog}
            hidden={dialogOpen}
          />
        </Suspense>
      )}
      {dialogOpen && (
        <Suspense fallback={null}>
          <CookieSettingsDialog
            open
            offered={offered}
            vendors={vendors}
            recordings={vendors.analytics.includes('clarity')}
            initial={{
              analytics: decision?.analytics ?? false,
              marketing: decision?.marketing ?? false,
              external_media: parsed.external,
            }}
            consentId={parsed.id}
            decidedAt={parsed.at}
            cookiePolicyHref={cookiePolicyHref}
            privacyHref={privacyHref}
            onSave={onDialogSave}
            onClose={() => setDialogOpen(false)}
          />
        </Suspense>
      )}
      {showLauncher && <CookieSettingsLauncher onOpen={openDialog} />}
    </>
  );
}
