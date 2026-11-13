'use client';

import { useEffect, useRef, useSyncExternalStore } from 'react';
import { useSelectedLayoutSegments } from 'next/navigation';
import {
  hasTrackingIds,
  readConsent,
  requiredConsentVersion,
  subscribeConsent,
  writeConsent,
  type ConsentChoice,
  type StoreTracking as StoreTrackingIds,
} from '@/lib/consent';
import { ClarityScript } from './ClarityScript';
import { clarityAllowedFor, clarityRanInDocument, isClarityExcludedPath, revokeTrackingConsent } from './clarity';
import { reloadPage } from './pageReload';
import { ConsentBanner } from './ConsentBanner';
import { ConsentManageLink } from './ConsentManageLink';
import { TrackingScripts } from './TrackingScripts';

// Owns the consent state for the storefront (Namez go-live 3.9):
// - the stored choice is read through useSyncExternalStore with a server
//   snapshot of "not hydrated yet", so SSR renders nothing, hydration never
//   mismatches and there is no layout shift (the banner is fixed anyway);
// - with `consent_required` the banner shows until the visitor decides, the
//   vendor tags mount only after "granted", and a small "Cookie settings"
//   link lets the visitor clear the choice (the banner then reappears);
// - without it the tags mount right away and no banner is shown;
// - Microsoft Clarity is the exception: it ALWAYS needs the visitor's
//   "accept" (the banner shows for a Clarity store even without
//   `consent_required`) and never loads on account / auth / order
//   confirmation pages, also after a client navigation (see the route
//   effects below);
// - withdrawing a "granted" choice tells every consent-gated vendor
//   "denied" and, when any vendor script ran, reloads the page (clarity.ts).
//
// Rendered by the store layout, so the layout segments below it drive the
// Clarity route gate and follow client navigations.

interface StoreTrackingProps {
  storeSlug: string;
  tracking: StoreTrackingIds | null | undefined;
  /** Store-relative path of the cookie-policy page, when published. */
  policyHref?: string | null;
}

const noopSubscribe = () => () => {};

export function StoreTracking({ storeSlug, tracking, policyHref }: StoreTrackingProps) {
  const enabled = hasTrackingIds(tracking);
  const consentRequired = tracking?.consent_required !== false;
  const clarityId = tracking?.clarity_project_id || '';
  // The visitor is asked when the store requires consent, and always when
  // Clarity is configured.
  const askConsent = consentRequired || Boolean(clarityId);
  const segments = useSelectedLayoutSegments();

  // Server snapshot: false until hydrated; the client snapshot is the stored
  // choice (a primitive, so the snapshot is stable between calls). Writes and
  // clears dispatch `ms:consent-change`, which re-reads the snapshot.
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const stored = useSyncExternalStore(
    subscribeConsent,
    // A Clarity store asks again for choices made before recordings were
    // part of "accept"; every other store keeps honouring them.
    () => (enabled && askConsent ? readConsent(storeSlug, requiredConsentVersion(tracking)) : null),
    () => null,
  );
  const choice: ConsentChoice | null = enabled && askConsent ? stored : null;

  // Withdrawal: "granted" -> anything else while this document is open.
  const previous = useRef<ConsentChoice | null | undefined>(undefined);
  useEffect(() => {
    if (!hydrated) return;
    const was = previous.current;
    previous.current = choice;
    if (was === 'granted' && choice !== 'granted') {
      revokeTrackingConsent({ vendors: consentRequired });
    }
  }, [hydrated, choice, consentRequired]);

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
    if (!clarityId || choice !== 'granted') return;
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
  }, [clarityId, choice]);

  if (!enabled || !tracking || !hydrated) return null;

  const vendorsAllowed = consentRequired ? choice === 'granted' : true;
  const clarityAllowed = Boolean(clarityId) && choice === 'granted' && routeAllowed;

  return (
    <>
      {vendorsAllowed && <TrackingScripts tracking={tracking} />}
      {clarityAllowed && <ClarityScript projectId={clarityId} />}
      {askConsent && choice === null && (
        <ConsentBanner
          policyHref={policyHref}
          recordings={Boolean(clarityId)}
          recordingsOnly={!consentRequired}
          onAccept={() => writeConsent(storeSlug, 'granted')}
          onReject={() => writeConsent(storeSlug, 'denied')}
        />
      )}
      {askConsent && choice !== null && <ConsentManageLink storeSlug={storeSlug} />}
    </>
  );
}
