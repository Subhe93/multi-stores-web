'use client';

import { useSyncExternalStore } from 'react';
import { useTranslations } from 'next-intl';
import { clearExternalMediaConsent, readExternalMediaConsent, subscribeConsent } from '@/lib/consent';

// "Turn off external videos" pill for stores WITHOUT tracking ids
// (CONTRACT-AUTOPLAY 6.6): those stores mount no <StoreTracking>, so this is
// where a visitor revokes "Always allow external videos". Renders nothing on
// the server and until the grant is set; same look as ConsentManageLink.

const noopSubscribe = () => () => {};

export function ExternalMediaManageLink({ storeSlug }: { storeSlug: string }) {
  const t = useTranslations('consent');
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const granted = useSyncExternalStore(subscribeConsent, () => readExternalMediaConsent(storeSlug), () => false);
  if (!hydrated || !granted) return null;
  return (
    <button
      type="button"
      onClick={() => clearExternalMediaConsent(storeSlug)}
      className="store-surface store-bd store-muted fixed bottom-3 end-3 z-[50] rounded-full border px-3 py-1 text-[11px] shadow-sm transition hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--theme-colors-primary)]"
    >
      {t('externalMediaOff')}
    </button>
  );
}
