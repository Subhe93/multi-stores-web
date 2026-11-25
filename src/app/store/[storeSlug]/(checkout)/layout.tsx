import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { headers, cookies } from 'next/headers';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { storefront, resolveMediaUrl } from '@/lib/api';
import { responsiveImgProps } from '@/lib/storeMedia';
import { StoreProviders } from '@/components/providers/StoreProviders';
import { REGION_COOKIE, requestRegionCountry } from '@/lib/region';
import { normalizeStoreTax, type StoreTaxConfig } from '@/lib/tax';
import { normalizeStoreApps, type StorefrontApps } from '@/lib/storeApps';
import { normalizeB2bSettings } from '@/lib/b2bSettings';
import { BUYER_COOKIE, resolveInitialBuyerType, type BuyerType } from '@/lib/buyerType';
import { normalizeCheckoutSettings } from '@/lib/checkoutSettings';
import { externalSiteHost, externalSiteUrl, resolveBackLabel } from '@/lib/externalReturn';
import { focusedStorefront, resolveFocusForHost } from '@/lib/focusedStorefront';
import { FocusedHeader } from '@/components/layout/FocusedHeader';
import type { MarketRoute } from '@/lib/market';
import { getRequestMarket, getRequestNoindex, getRequestPathCountry, getRequestPathPrefix } from '@/lib/market.server';
import { isLocaleNotServed, isReviewLocale } from '@/lib/storeLocales';
import { MarketPreviewBanner } from '@/components/layout/MarketPreviewBanner';
import { CookieSettingsLink } from '@/components/tracking/CookieSettingsLink';
import { resolveTheme } from '@/themes/registry';
import { mergeTokens, storePrimaryContrast, tokenArabicFamilies } from '@/themes/tokens';
import type { ThemeCustomizations } from '@/themes/types';
import { FlowMotionProvider } from '@/components/cart/FlowMotion';
import { clientMessages, storeMotion } from '@/themes/creative/creativeAttrs';
import { reviewsClientMessages } from '@/lib/reviewsMessages';
import { surface } from '@/themes/creative/recipes';

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
  /** Legacy custom domain (M6.1): the default market's host without a StoreDomain row. */
  custom_domain?: string | null;
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

  // Same rule as the store layout: a store-only locale this store has not
  // enabled is a 404.
  if (isLocaleNotServed(urlLocale, store)) notFound();

  // Explicit creator colour wins; otherwise follow the active theme's tokens
  // (so "Choose a theme" recolours checkout/account/auth pages too).
  const resolvedTokens = mergeTokens(resolveTheme(store.theme_key).tokens, store.theme_customizations);
  const primaryColor = store.theme?.primaryColor || resolvedTokens.colors.primary;
  const secondaryColor = store.theme?.secondaryColor || resolvedTokens.colors.secondary;
  const fontFamily = store.theme?.fontFamily;
  // Optional Arabic-script body family (theme token): it follows the legacy
  // store font here too. Undefined for a store that has not set one.
  const arabicBody = tokenArabicFamilies(resolvedTokens)?.body;
  const primaryLocale = store.language_config?.primary_locale || 'en';
  const currentLang = urlLocale || primaryLocale;

  const localeTrans = store.theme?.translations?.[currentLang];
  const storeName = localeTrans?.name || store.name;

  const messages = await getMessages();
  const t = await getTranslations({ locale: currentLang });
  // Store motion style (flow scope: entrances and feedback only, fast timing).
  const motion = storeMotion(store.theme_customizations) ? ('scroll' as const) : undefined;

  // Same host rule as the store layout (focused storefront loop guard), so
  // both provider trees carry the same settings.
  const checkoutSettings = resolveFocusForHost(
    normalizeCheckoutSettings(store.checkout),
    requestHeaders.get('host'),
  );
  // Store with its own website (headless P3): the logo and the footer link
  // lead back there. Without one both stay exactly as before.
  // Focused storefront: the checkout is step 3 of the purchase and keeps the
  // focused header (logo, back link, cart, step indicator) of steps 1 and 2.
  const focus = focusedStorefront(checkoutSettings);
  const externalSite = externalSiteUrl(checkoutSettings);
  // b2b app: seed the buyer type from the `ms-buyer-type` cookie exactly like
  // the store layout does; without it a "Firma" choice made in the cart was
  // lost on the checkout (the provider fell back to 'person').
  const checkoutApps = normalizeStoreApps(store.apps);
  const buyerType: BuyerType | undefined = checkoutApps.b2b
    ? resolveInitialBuyerType({
        cookie: cookieStore.get(BUYER_COOKIE)?.value,
        settings: normalizeB2bSettings(checkoutApps.b2b.settings),
      })
    : undefined;
  const externalHost = externalSiteHost(checkoutSettings);
  const homeHref = externalSite ?? `/`;
  const homeRel = externalSite ? 'noreferrer' : undefined;
  const returnLabel = externalSite && externalHost
    ? resolveBackLabel(checkoutSettings, currentLang) || t('checkout.returnToSite', { site: externalHost })
    : t('checkout.returnToStore');

  return (
    <NextIntlClientProvider locale={currentLang} messages={reviewsClientMessages(clientMessages(messages), false)}>
      <StoreProviders locale={currentLang} storeSlug={storeSlug} storeId={store.id} storeCurrency={store.currency} storeTax={normalizeStoreTax(store.tax)} storeApps={checkoutApps} market={store.market ?? null} markets={store.markets ?? null} storeCustomDomain={store.custom_domain ?? null} preferredCountry={store.market ? requestRegionCountry(await getRequestPathCountry(), cookieStore.get(REGION_COOKIE)?.value) : null} pathPrefix={await getRequestPathPrefix()} primaryLocale={primaryLocale} buyerType={buyerType} checkout={checkoutSettings}>
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

        {(store.market?.preview || noindex || isReviewLocale(currentLang)) && <meta name="robots" content="noindex, nofollow" />}
        {/* data-clarity-mask: the whole checkout (addresses, names, totals)
            is masked in Clarity recordings; clicks and scroll still record. */}
        <div
          dir={currentLang === 'ar' ? 'rtl' : 'ltr'}
          lang={currentLang}
          data-clarity-mask="True"
          className="min-h-screen flex flex-col store-page"
          style={{
            // The theme layout wraps <main> in a max-width container. Break out
            // of it (full-bleed) so the checkout header, footer and background
            // span the whole viewport; the content keeps its own max-w-5xl.
            // The theme root clips overflow-x, so 100vw adds no scrollbar.
            width: '100vw',
            marginInline: 'calc(50% - 50vw)',
            '--store-primary': primaryColor,
            '--store-primary-contrast': storePrimaryContrast(primaryColor, resolvedTokens, store.theme_customizations),
            '--store-secondary': secondaryColor,
            ...(fontFamily ? { fontFamily: arabicBody ? `"${fontFamily}", "${arabicBody}"` : fontFamily } : {}),
          } as React.CSSProperties}
        >
          <MarketPreviewBanner />
          {focus ? (
            <FocusedHeader storeName={storeName} logoUrl={store.logo_url} primaryColor={primaryColor} />
          ) : (
          /* ── Shopify-style minimal checkout header ── */
          <header className="store-surface store-bd border-b">
            <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
              {/* Store logo + name */}
              <Link
                href={homeHref}
                rel={homeRel}
                className="flex items-center gap-2.5 hover:opacity-80 transition-opacity"
              >
                {store.logo_url ? (
                  // The logo already carries the brand; repeating the store
                  // name next to it looked like a duplicate wordmark.
                  <img
                    {...responsiveImgProps(resolveMediaUrl(store.logo_url), '240px')}
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
                <span className="hidden sm:inline text-xs">{t('checkout.secureTransaction')}</span>
              </div>
            </div>
          </header>
          )}

          {/* ── Page content ── */}
          <main className="flex-1" {...surface(motion, 'checkout', true)}>
            {motion ? <FlowMotionProvider>{children}</FlowMotionProvider> : children}
          </main>

          {/* ── Minimal footer ── */}
          <footer className="border-t store-bd py-5">
            <div className="max-w-5xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-gray-400">
              <span>&copy; {new Date().getFullYear()} {storeName}</span>
              <div className="flex items-center gap-4">
                {/* Focused storefront: the header above carries the back link
                    (to the page the buyer came from). */}
                {!focus && (
                  <Link href={homeHref} rel={homeRel} className="hover:text-gray-600 transition-colors">
                    {returnLabel}
                  </Link>
                )}
                {/* The store footer is hidden here: the cookie settings stay reachable (consent v2 D4a). */}
                <CookieSettingsLink variant="inline" />
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
