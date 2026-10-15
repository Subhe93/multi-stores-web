'use client';

import { useSyncExternalStore } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useBuyerType } from '@/hooks/useBuyerType';
import { readReverseChargeHint } from '@/lib/vatCheck';

// ── Cart hint after a reverse-charge VAT check (b2b app, M2.5-DESIGN §5) ─────
// The cart cannot know whether reverse charge will apply (it depends on the
// VAT number and the destination), so it keeps the M2 company prices. Once a
// check in this browser session said "reverse charge applies", this line
// tells the buyer VAT will be removed at checkout. Display only.

const noopSubscribe = () => () => {};

export function ReverseChargeCartHint({ className = '' }: { className?: string }) {
  const t = useTranslations('b2b');
  const { isCompany, settings } = useBuyerType();
  const storeSlug = (useParams<{ storeSlug: string }>()?.storeSlug as string) || '';
  // Server snapshot false: the hint appears after hydration, never mismatches.
  const remembered = useSyncExternalStore(
    noopSubscribe,
    () => readReverseChargeHint(storeSlug),
    () => false,
  );
  if (!isCompany || !settings.reverse_charge_enabled || !remembered) return null;
  return <p className={`text-xs text-green-700 ${className}`}>{t('vat.cartHint')}</p>;
}
