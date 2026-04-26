import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { headers, cookies } from 'next/headers';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { storefront } from '@/lib/api';
import { StoreHeader } from '@/components/layout/StoreHeader';
import { StoreFooter } from '@/components/layout/StoreFooter';
import { StoreProviders } from '@/components/providers/StoreProviders';

// ---------- Type definitions ----------

interface LanguageConfig {
  primary_locale: string;
  secondary_locales: string[];
}

interface PageTranslation {
  locale: string;
  title: string;
}

interface StorePage {
  slug: string;
  translations: PageTranslation[];
}

interface StoreTranslation {
  name?: string;
  description?: string;
  metaTitle?: string;
  metaDescription?: string;
}

interface Store {
  name: string;
  description?: string;
  logo_url?: string;
  language_config?: LanguageConfig | null;
  pages?: StorePage[];
  theme?: {
    primaryColor?: string;
    secondaryColor?: string;
    fontFamily?: string;
    socials?: {
      instagram?: string;
      facebook?: string;
      twitter?: string;
      tiktok?: string;
      youtube?: string;
    };
    contact?: {
      email?: string;
      phone?: string;
      whatsapp?: string;
      address?: string;
    };
    seo?: {
      metaTitle?: string;
      metaDescription?: string;
    };
    translations?: Record<string, StoreTranslation>;
  };
}

// ---------- Layout props ----------

interface StoreLayoutProps {
  children: React.ReactNode;
  params: Promise<{ storeSlug: string }>;
}

// ---------- generateMetadata ----------

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
    const store = await storefront.getStore(storeSlug) as Store;
    const lang = urlLocale || store.language_config?.primary_locale || 'en';
    const trans = store.theme?.translations?.[lang];
    return {
      title: trans?.metaTitle || trans?.name || store.name,
      description: trans?.metaDescription || trans?.description || store.description,
    };
  } catch {
    return {};
  }
}

// ---------- Layout ----------

export default async function StoreLayout({
  children,
  params,
}: StoreLayoutProps) {
  const { storeSlug } = await params;

  // Read locale forwarded by middleware (cookie is the most reliable mechanism across rewrites)
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
  const secondaryLocales = store.language_config?.secondary_locales || [];

  // If URL had a locale prefix use it; otherwise fall back to the store's primary locale
  const currentLang = urlLocale || primaryLocale;

  // Resolve translated store name and description for current locale
  const storeTranslations = store.theme?.translations || {};
  const localeTrans = storeTranslations[currentLang];
  const storeName = localeTrans?.name || store.name;
  const storeDescription = localeTrans?.description || store.description;

  // Published static pages forwarded to header and footer
  const pages = store.pages ?? [];

  // Social and contact info from store theme
  const socials = store.theme?.socials;
  const contact = store.theme?.contact;

  // Load i18n messages for store pages (locale resolved via request.ts fallback)
  const messages = await getMessages();

  return (
    <NextIntlClientProvider locale={currentLang} messages={messages}>
      <StoreProviders>
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
          <div id="store-nav-header">
            <StoreHeader
              storeName={storeName}
              storeSlug={storeSlug}
              logoUrl={store.logo_url}
              primaryColor={primaryColor}
              primaryLocale={primaryLocale}
              secondaryLocales={secondaryLocales}
              pages={pages}
              currentLang={currentLang}
            />
          </div>

          <main className="flex-1">
            {children}
          </main>

          <div id="store-nav-footer">
            <StoreFooter
              storeName={storeName}
              primaryColor={primaryColor}
              pages={pages}
              socials={socials}
              contact={contact}
              currentLang={currentLang}
            />
          </div>
        </div>
      </StoreProviders>
    </NextIntlClientProvider>
  );
}
