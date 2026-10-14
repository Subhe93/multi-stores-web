import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

// Rendered (with a 404 status) when the proxy sends a locale prefix this
// market does not serve to `market-not-found/page.tsx`.
export default async function MarketLocaleNotFoundView() {
  const t = await getTranslations();
  return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center px-4 py-20 text-center">
      <h1 className="text-2xl font-semibold text-gray-900 mb-3">404</h1>
      <p className="text-gray-600 mb-6">{t('market.notFound')}</p>
      <Link
        href="/"
        className="px-5 py-2.5 rounded-lg text-white text-sm font-medium hover:opacity-90 transition-opacity"
        style={{ backgroundColor: 'var(--store-primary, #2563eb)' }}
      >
        {t('common.home')}
      </Link>
    </div>
  );
}
