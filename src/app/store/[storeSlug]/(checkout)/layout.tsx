import { notFound } from 'next/navigation';
import { headers, cookies } from 'next/headers';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import Link from 'next/link';
import { storefront, resolveMediaUrl } from '@/lib/api';
import { StoreProviders } from '@/components/providers/StoreProviders';

interface Store {
  name: string;
  logo_url?: string;
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

  let store: Store;
  try {
    store = await storefront.getStore(storeSlug) as Store;
  } catch {
    notFound();
  }

  const primaryColor = store.theme?.primaryColor || '#2563eb';
  const secondaryColor = store.theme?.secondaryColor || '#1e40af';
  const fontFamily = store.theme?.fontFamily;
  const primaryLocale = store.language_config?.primary_locale || 'en';
  const currentLang = urlLocale || primaryLocale;

  const localeTrans = store.theme?.translations?.[currentLang];
  const storeName = localeTrans?.name || store.name;

  const messages = await getMessages();

  return (
    <NextIntlClientProvider locale={currentLang} messages={messages}>
      <StoreProviders locale={currentLang}>
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

        <div
          dir={currentLang === 'ar' ? 'rtl' : 'ltr'}
          lang={currentLang}
          className="min-h-screen flex flex-col bg-white text-gray-900"
          style={{
            '--store-primary': primaryColor,
            '--store-secondary': secondaryColor,
            ...(fontFamily ? { fontFamily } : {}),
          } as React.CSSProperties}
        >
          {/* ── Shopify-style minimal checkout header ── */}
          <header className="bg-white border-b border-gray-200">
            <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
              {/* Store logo + name */}
              <Link
                href={`/`}
                className="flex items-center gap-2.5 hover:opacity-80 transition-opacity"
              >
                {store.logo_url ? (
                  <img
                    src={resolveMediaUrl(store.logo_url)}
                    alt={storeName}
                    className="h-9 w-auto object-contain"
                  />
                ) : (
                  <span
                    className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold text-sm"
                    style={{ backgroundColor: primaryColor }}
                  >
                    {storeName.charAt(0).toUpperCase()}
                  </span>
                )}
                <span className="font-semibold text-gray-900 text-base">{storeName}</span>
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
          <footer className="border-t border-gray-100 py-5">
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
