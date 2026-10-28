'use client';

import { useSyncExternalStore } from 'react';
import {
  hasTrackingIds,
  readConsent,
  subscribeConsent,
  writeConsent,
  type ConsentChoice,
  type StoreTracking as StoreTrackingIds,
} from '@/lib/consent';
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
// - without it the tags mount right away and no banner is shown.

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

  // Server snapshot: false until hydrated; the client snapshot is the stored
  // choice (a primitive, so the snapshot is stable between calls). Writes and
  // clears dispatch `ms:consent-change`, which re-reads the snapshot.
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const stored = useSyncExternalStore(
    subscribeConsent,
    () => (enabled && consentRequired ? readConsent(storeSlug) : null),
    () => null,
  );

  if (!enabled || !tracking || !hydrated) return null;

  const choice: ConsentChoice | null = consentRequired ? stored : 'granted';

  return (
    <>
      {choice === 'granted' && <TrackingScripts tracking={tracking} />}
      {consentRequired && choice === null && (
        <ConsentBanner
          policyHref={policyHref}
          onAccept={() => writeConsent(storeSlug, 'granted')}
          onReject={() => writeConsent(storeSlug, 'denied')}
        />
      )}
      {consentRequired && choice !== null && <ConsentManageLink storeSlug={storeSlug} />}
    </>
  );
}
