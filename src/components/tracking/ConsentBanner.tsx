'use client';

import { useId } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useLocalePath } from '@/hooks/useLocalePath';

// Bottom-anchored cookie banner (Namez go-live 3.9). Purely presentational:
// the parent (<StoreTracking>) owns the choice and the storage writes.
// Theme-token colours so it follows the active storefront theme.

interface ConsentBannerProps {
  onAccept: () => void;
  onReject: () => void;
  /** Store-relative path of the cookie policy page (e.g. `/om-cookies`), when published. */
  policyHref?: string | null;
}

export function ConsentBanner({ onAccept, onReject, policyHref }: ConsentBannerProps) {
  const t = useTranslations('consent');
  const titleId = useId();
  const descId = useId();
  const lp = useLocalePath();

  return (
    <div
      role="dialog"
      aria-labelledby={titleId}
      aria-describedby={descId}
      data-testid="consent-banner"
      className="store-surface store-bd fixed inset-x-0 bottom-0 z-[60] border-t shadow-[0_-4px_24px_rgba(0,0,0,0.08)]"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <div className="min-w-0 space-y-1">
          <h2 id={titleId} className="text-sm font-semibold">
            {t('title')}
          </h2>
          <p id={descId} className="store-muted text-xs leading-relaxed">
            {t('description')}
            {policyHref && (
              <>
                {' '}
                <Link href={lp(policyHref)} className="underline underline-offset-2 hover:opacity-80">
                  {t('settings')}
                </Link>
              </>
            )}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={onReject}
            className="store-bd rounded-md border px-4 py-2 text-xs font-medium transition hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--theme-colors-primary)]"
          >
            {t('reject')}
          </button>
          <button
            type="button"
            onClick={onAccept}
            className="rounded-md px-4 py-2 text-xs font-semibold transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--theme-colors-primary)]"
            style={{ backgroundColor: 'var(--theme-colors-primary)', color: 'var(--theme-colors-primaryContrast, #fff)' }}
          >
            {t('accept')}
          </button>
        </div>
      </div>
    </div>
  );
}
