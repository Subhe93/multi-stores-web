import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { headers, cookies } from "next/headers";
import { requestMarketRef } from '@/lib/market';
import { storefront } from "@/lib/api";
import { getPlatformName } from "@/lib/platform";
import { BRAND_TAGLINE, HEX } from "@/lib/brand";
import { defaultLocale, rtlLocales } from "@/i18n/config";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

// Without a metadataBase, Next resolves every relative URL (canonicals, OG
// images) against http://localhost:3000 — which is what the platform's legal
// pages were emitting. Store routes override this with their own origin, since
// each store is served from its own subdomain or custom domain.
const PLATFORM_URL = process.env.NEXT_PUBLIC_WEB_URL || 'http://localhost:3003';

const PLATFORM_DESCRIPTION =
  'ShopsDoor is a platform for building and running independent online stores: products, orders, payments and markets, all behind one door.';

// Platform name inherited from the admin-configured PlatformConfig; store
// routes override title, description and (when the creator uploaded a
// favicon) icons with their own values. Everything else is inherited.
export async function generateMetadata(): Promise<Metadata> {
  const platformName = await getPlatformName();
  const title = `${platformName} — ${BRAND_TAGLINE}`;
  return {
    metadataBase: new URL(PLATFORM_URL),
    title,
    description: PLATFORM_DESCRIPTION,
    applicationName: platformName,
    icons: {
      icon: '/brand/app-icon.svg',
      apple: '/brand/apple-icon.png',
    },
    openGraph: {
      siteName: platformName,
      title,
      description: PLATFORM_DESCRIPTION,
      type: 'website',
      images: [{ url: '/brand/og.png', width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description: PLATFORM_DESCRIPTION,
      images: ['/brand/og.png'],
    },
  };
}

// Browser chrome colour on mobile; `themeColor` is a viewport concern in Next.
export const viewport: Viewport = {
  themeColor: HEX.navy,
  width: 'device-width',
  initialScale: 1,
};

/**
 * The language this request is actually being served in.
 *
 * `<html lang>` lives here and used to be hardcoded to "en", so an Arabic or
 * Swedish store told crawlers and screen readers it was English, and never set
 * `dir="rtl"` on the document. The proxy forwards the resolved locale on the
 * request headers; a store viewed in its primary locale carries no prefix and
 * so no locale header, in which case the store's own primary locale is the
 * answer. That fetch is deduplicated with the store layout's identical call,
 * so it costs nothing extra.
 */
async function resolveDocumentLocale(): Promise<string> {
  const [requestHeaders, cookieStore] = await Promise.all([headers(), cookies()]);
  const explicit =
    cookieStore.get('x-store-locale')?.value || requestHeaders.get('x-locale');
  if (explicit) return explicit;

  const storeSlug = requestHeaders.get('x-store-slug');
  if (storeSlug) {
    try {
      // `x-market` is only set for market stores (and those also carry the
      // locale cookie, so this fetch is normally skipped for them).
      const store = (await storefront.getStore(storeSlug, requestMarketRef(requestHeaders))) as {
        language_config?: { primary_locale?: string } | null;
      };
      return store.language_config?.primary_locale || defaultLocale;
    } catch {
      // Unknown or unreachable store — fall through to the platform default.
    }
  }
  return defaultLocale;
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const lang = await resolveDocumentLocale();
  const dir = (rtlLocales as readonly string[]).includes(lang) ? 'rtl' : 'ltr';

  return (
    <html lang={lang} dir={dir} className={`${inter.className} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
