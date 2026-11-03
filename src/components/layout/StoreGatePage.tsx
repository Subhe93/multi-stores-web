import { getTranslations } from 'next-intl/server';
import { resolveMediaUrl } from '@/lib/api';
import { responsiveImgProps } from '@/lib/storeMedia';
import { StorePreviewUnlock } from './StorePreviewUnlock';

interface StoreGatePageProps {
  kind: 'coming_soon' | 'paused';
  storeSlug: string;
  storeName: string;
  logoUrl?: string | null;
  /** Theme primary colour (from the payload's theme tokens). */
  primaryColor: string;
  locale: string;
}

/**
 * Public page of a store that is not LIVE: "Coming soon" (DRAFT /
 * PENDING_REVIEW / CHANGES_REQUESTED) or "Temporarily closed" (PAUSED).
 * Branded with the store name, logo and primary colour; never indexable.
 * Rendered by the store layout instead of the storefront for every route.
 */
export async function StoreGatePage({ kind, storeSlug, storeName, logoUrl, primaryColor, locale }: StoreGatePageProps) {
  const t = await getTranslations({ locale, namespace: 'store' });
  const title = kind === 'paused' ? t('pausedTitle') : t('comingSoonTitle');
  const body = kind === 'paused' ? t('pausedBody') : t('comingSoonBody');
  const logo = logoUrl ? resolveMediaUrl(logoUrl) : '';

  return (
    <>
      <meta name="robots" content="noindex, nofollow" />
      <div
        dir={locale === 'ar' ? 'rtl' : 'ltr'}
        lang={locale}
        className="min-h-screen flex flex-col items-center justify-center px-4 py-16 text-center"
        style={{
          background: `linear-gradient(180deg, color-mix(in srgb, ${primaryColor} 10%, white) 0%, white 60%)`,
          color: '#0f172a',
        }}
      >
        <div className="w-full max-w-md flex flex-col items-center gap-6">
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img {...responsiveImgProps(logo, '256px')} alt="" height={64} className="h-16 w-auto object-contain" />
          ) : (
            <div
              aria-hidden="true"
              className="flex h-16 w-16 items-center justify-center rounded-2xl text-2xl font-bold text-white"
              style={{ backgroundColor: primaryColor }}
            >
              {storeName.trim().charAt(0).toUpperCase() || '•'}
            </div>
          )}
          <p className="text-sm font-semibold uppercase tracking-widest" style={{ color: primaryColor }}>
            {storeName}
          </p>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">{title}</h1>
          <p className="text-base text-slate-600 leading-relaxed max-w-sm">{body}</p>
          <span
            aria-hidden="true"
            className="mt-2 block h-1 w-16 rounded-full"
            style={{ backgroundColor: primaryColor }}
          />
        </div>
      </div>
      <StorePreviewUnlock storeSlug={storeSlug} />
    </>
  );
}
