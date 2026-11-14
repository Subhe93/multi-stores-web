'use client';

import { useTranslations } from 'next-intl';
import { clearConsent, clearExternalMediaConsent } from '@/lib/consent';

// Unobtrusive "Cookie settings" pill (bottom end corner) shown once the
// visitor has made a choice (or allowed external videos); clicking it
// forgets the tracking choice so the consent banner shows again (Namez
// go-live 3.9) and also revokes "Always allow external videos"
// (CONTRACT-AUTOPLAY 6.6): one click withdraws everything.

interface ConsentManageLinkProps {
  storeSlug: string;
}

export function ConsentManageLink({ storeSlug }: ConsentManageLinkProps) {
  const t = useTranslations('consent');
  return (
    <button
      type="button"
      onClick={() => {
        clearConsent(storeSlug);
        clearExternalMediaConsent(storeSlug);
      }}
      className="store-surface store-bd store-muted fixed bottom-3 end-3 z-[50] rounded-full border px-3 py-1 text-[11px] shadow-sm transition hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--theme-colors-primary)]"
    >
      {t('manage')}
    </button>
  );
}
