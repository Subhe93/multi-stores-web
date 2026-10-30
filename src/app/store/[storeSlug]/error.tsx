'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';

interface StoreErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

// Store error boundary: catches render errors below the store layout so the
// header/footer chrome stays visible. `reset()` re-renders the segment.
export default function StoreError({ error, reset }: StoreErrorProps) {
  const t = useTranslations('errors');

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center px-4 py-20 text-center">
      <h1 className="text-2xl sm:text-3xl font-semibold mb-3">{t('errorTitle')}</h1>
      <p className="store-muted max-w-md mb-8">{t('errorDescription')}</p>
      <button
        type="button"
        onClick={reset}
        className="px-5 py-2.5 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
        style={{ backgroundColor: 'var(--store-primary, #2563eb)', color: 'var(--store-primary-contrast, #fff)' }}
      >
        {t('retry')}
      </button>
    </div>
  );
}
