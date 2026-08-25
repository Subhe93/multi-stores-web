import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { headers, cookies } from "next/headers";
import { storefront } from "@/lib/api";
import { getPlatformName } from "@/lib/platform";
import { defaultLocale, rtlLocales } from "@/i18n/config";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

// Without a metadataBase, Next resolves every relative URL (canonicals, OG
// images) against http://localhost:3000 — which is what the platform's legal
// pages were emitting. Store routes override this with their own origin, since
// each store is served from its own subdomain or custom domain.
const PLATFORM_URL = process.env.NEXT_PUBLIC_WEB_URL || 'http://localhost:3003';

// Platform name inherited from the admin-configured PlatformConfig; store
// routes override this metadata with their own titles anyway.
export async function generateMetadata(): Promise<Metadata> {
  const platformName = await getPlatformName();
  return {
    metadataBase: new URL(PLATFORM_URL),
    title: `${platformName} Marketplace`,
    description: "Marketplace connecting providers, creators, and customers",
  };
}

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
      const store = (await storefront.getStore(storeSlug)) as {
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
    <html lang={lang} dir={dir} className={`${inter.className} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
