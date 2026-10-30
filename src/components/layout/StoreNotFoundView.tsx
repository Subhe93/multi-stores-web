import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

interface StoreNotFoundViewProps {
  /** Locale path prefix: '' for the primary locale, '/sv' etc. otherwise. */
  lp: string;
}

/**
 * Shared 404 body for storefront routes. Rendered by the store segment's
 * `not-found.tsx` (inside the store chrome) and by the app-root
 * `not-found.tsx`. Links are host-relative like every other store link —
 * the proxy maps the store host to `/store/{slug}`, so `/store/...` must
 * never appear here.
 */
export async function StoreNotFoundView({ lp }: StoreNotFoundViewProps) {
  const t = await getTranslations('errors');
  return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center px-4 py-20 text-center">
      <p className="text-sm font-medium store-muted mb-2">404</p>
      <h1 className="text-2xl sm:text-3xl font-semibold mb-3">{t('notFoundTitle')}</h1>
      <p className="store-muted max-w-md mb-8">{t('notFoundDescription')}</p>
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <Link
          href={`${lp}/`}
          className="px-5 py-2.5 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
          style={{ backgroundColor: 'var(--store-primary, #2563eb)', color: 'var(--store-primary-contrast, #fff)' }}
        >
          {t('backHome')}
        </Link>
        <Link
          href={`${lp}/products`}
          className="px-5 py-2.5 rounded-lg border store-bd text-sm font-medium hover:opacity-80 transition-opacity"
        >
          {t('browseProducts')}
        </Link>
      </div>
    </div>
  );
}
