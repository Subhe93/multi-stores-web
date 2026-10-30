import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { headers, cookies } from 'next/headers';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { storefront, resolveMediaUrl } from '@/lib/api';
import { StoreProviders } from '@/components/providers/StoreProviders';
import { normalizeStoreTax, type StoreTaxConfig } from '@/lib/tax';
import { normalizeStoreApps, type StorefrontApps } from '@/lib/storeApps';
import { normalizeCheckoutSettings } from '@/lib/checkoutSettings';
import type { MarketRoute } from '@/lib/market';
import { getRequestMarket, getRequestNoindex } from '@/lib/market.server';
import { MarketPreviewBanner } from '@/components/layout/MarketPreviewBanner';
import { resolveTheme } from '@/themes/registry';
import { mergeTokens, storePrimaryContrast } from '@/themes/tokens';
import type { ThemeCustomizations } from '@/themes/types';

interface Store {
  id: string;
  name: string;
  currency?: string;
  /** Tax settings (pricing mode, catalog display flag) — API-CONTRACT-TAX §3. */
  tax?: StoreTaxConfig | null;
  /** Enabled store apps — always sent by the API (`{}` when none). */
  apps?: StorefrontApps | null;
  /** Markets app only (M1-DESIGN §3.3): absent for other stores. */
  market?: MarketRoute | null;
  markets?: MarketRoute[];
  /** Checkout behaviour overrides (M5.1): absent for stores on the defaults. */
  checkout?: unknown;
  logo_url?: string;
  theme_key?: string;
  theme_customizations?: ThemeCustomizations;
  language_config?: { primary_locale: string; secondary_locales: string[] } | null;
  theme?: {
    primaryColor?: string;
    secondaryColor?: string;
    fontFamily?: string;
    translations?: Record<string, { name?: string }>;
  };
}

interface CheckoutLayoutProps {
  children: React.ReactNode;
  params: Promise<{ storeSlug: string }>;
}

export default async function CheckoutLayout({
  children,
  params,
}: CheckoutLayoutProps) {
  const { storeSlug } = await params;

  const cookieStore = await cookies();
  const requestHeaders = await headers();
  const urlLocale = cookieStore.get('x-store-locale')?.value || requestHeaders.get('x-locale');

  // Market of the request host (markets app); undefined for other stores.
  const marketKey = await getRequestMarket();
  // Proxy indexing verdict (M6.1); same meta robots rule as the store layout.
  const noindex = await getRequestNoindex();

  let store: Store;
  try {
    store = await storefront.getStore(storeSlug, marketKey) as Store;
  } catch {
    notFound();
  }

  // Explicit creator colour wins; otherwise follow the active theme's tokens
  // (so "Choose a theme" recolours checkout/account/auth pages too).
  const resolvedTokens = mergeTokens(resolveTheme(store.theme_key).tokens, store.theme_customizations);
  const primaryColor = store.theme?.primaryColor || resolvedTokens.colors.primary;
  const secondaryColor = store.theme?.secondaryColor || resolvedTokens.colors.secondary;
  const fontFamily = store.theme?.fontFamily;
  const primaryLocale = store.language_config?.primary_locale || 'en';
  const currentLang = urlLocale || primaryLocale;

  const localeTrans = store.theme?.translations?.[currentLang];
  const storeName = localeTrans?.name || store.name;

  const messages = await getMessages();

  return (
    <NextIntlClientProvider locale={currentLang} messages={messages}>
      <StoreProviders locale={currentLang} storeId={store.id} storeCurrency={store.currency} storeTax={normalizeStoreTax(store.tax)} storeApps={normalizeStoreApps(store.apps)} market={store.market ?? null} markets={store.markets ?? null} primaryLocale={primaryLocale} checkout={normalizeCheckoutSettings(store.checkout)}>
        {/*
          Hide the parent StoreLayout's header and footer on all checkout pages.
          The checkout has its own minimal Shopify-style header and footer below.
        */}
        <style>{`
          #store-nav-header,
          #store-nav-footer {
            display: none !important;
          }
        `}</style>

        {(store.market?.preview || noindex) && <meta name="robots" content="noindex, nofollow" />}
        <div
          dir={currentLang === 'ar' ? 'rtl' : 'ltr'}
          lang={currentLang}
          className="min-h-screen flex flex-col store-page"
          style={{
            '--store-primary': primaryColor,
            '--store-primary-contrast': storePrimaryContrast(primaryColor, resolvedTokens, store.theme_customizations),
            '--store-secondary': secondaryColor,
            ...(fontFamily ? { fontFamily } : {}),
          } as React.CSSProperties}
        >
          <MarketPreviewBanner />
          {/* ── Shopify-style minimal checkout header ── */}
          <header className="store-surface store-bd border-b">
            <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
              {/* Store logo + name */}
              <Link
                href={`/`}
                className="flex items-center gap-2.5 hover:opacity-80 transition-opacity"
              >
                {store.logo_url ? (
                  // The logo already carries the brand; repeating the store
                  // name next to it looked like a duplicate wordmark.
                  <img
                    src={resolveMediaUrl(store.logo_url)}
                    alt={storeName}
                    className="h-9 w-auto object-contain"
                  />
                ) : (
                  <>
                    <span
                      className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold text-sm"
                      style={{ backgroundColor: primaryColor }}
                    >
                      {storeName.charAt(0).toUpperCase()}
                    </span>
                    <span className="font-semibold text-gray-900 text-base">{storeName}</span>
                  </>
                )}
              </Link>

              {/* Secure checkout badge */}
              <div className="flex items-center gap-1.5 text-sm text-gray-400">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
                <span className="hidden sm:inline text-xs">Secure Checkout</span>
              </div>
            </div>
          </header>

          {/* ── Page content ── */}
          <main className="flex-1">
            {children}
          </main>

          {/* ── Minimal footer ── */}
          <footer className="border-t store-bd py-5">
            <div className="max-w-5xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-gray-400">
              <span>&copy; {new Date().getFullYear()} {storeName}</span>
              <div className="flex items-center gap-4">
                <Link href={`/`} className="hover:text-gray-600 transition-colors">
                  Return to store
                </Link>
              </div>
            </div>
          </footer>
        </div>
      </StoreProviders>
    </NextIntlClientProvider>
  );
}

// Transactional / private surface — never indexable. robots.txt already
// disallows these paths; the meta tag covers URLs a crawler reaches anyway
// (e.g. from an external link), which robots.txt alone cannot suppress.
const robots: Metadata['robots'] = { index: false, follow: false };

// Without a title of its own the route inherited the store SEO meta title
// (English). Locale resolution mirrors the layout above: `?lang` forwarded
// by the proxy (cookie / x-locale header), else the store primary locale.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ storeSlug: string }>;
}): Promise<Metadata> {
  const { storeSlug } = await params;
  try {
    const cookieStore = await cookies();
    const requestHeaders = await headers();
    const urlLocale = cookieStore.get('x-store-locale')?.value || requestHeaders.get('x-locale');
    const store = (await storefront.getStore(storeSlug, await getRequestMarket())) as Store;
    const primaryLocale = store?.language_config?.primary_locale || 'en';
    const locale = urlLocale || primaryLocale;
    const t = await getTranslations({ locale });
    const storeName = store?.theme?.translations?.[locale]?.name || store?.name || storeSlug;
    return { title: `${t('checkout.title')} | ${storeName}`, robots };
  } catch {
    return { robots };
  }
}
