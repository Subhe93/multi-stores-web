'use client';

import { useTranslations } from 'next-intl';
import { clearConsent } from '@/lib/consent';

// Unobtrusive "Cookie settings" pill (bottom end corner) shown once the
// visitor has made a choice; clicking it forgets the choice so the consent
// banner shows again (Namez go-live 3.9).

interface ConsentManageLinkProps {
  storeSlug: string;
}

export function ConsentManageLink({ storeSlug }: ConsentManageLinkProps) {
  const t = useTranslations('consent');
  return (
    <button
      type="button"
      onClick={() => clearConsent(storeSlug)}
      className="store-surface store-bd store-muted fixed bottom-3 end-3 z-[50] rounded-full border px-3 py-1 text-[11px] shadow-sm transition hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--theme-colors-primary)]"
    >
      {t('manage')}
    </button>
  );
}
