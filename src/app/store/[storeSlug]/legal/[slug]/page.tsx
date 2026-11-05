import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { storefront, LEGAL_SLUGS, type LegalSlug, type StoreLegalPage } from '@/lib/api';
import { buildStoreOrigin, buildStoreAlternates } from '@/lib/storeUrl';
import type { MarketRoute } from '@/lib/market';
import { getRequestMarket, getRequestNoindex } from '@/lib/market.server';
import { routeSlug } from '@/lib/slugRoute';
import { isRtl } from '@/i18n/config';
import { ldJsonSafe } from '@/lib/jsonld';
import { buildLandingJsonLd } from '@/lib/pageJsonLd';
import { htmlExcerpt } from '@/lib/pageExcerpt';
import { PageBreadcrumb } from '@/components/common/PageBreadcrumb';
import { substituteTraderPlaceholders, type TraderDetails } from '@/lib/traderDetails';
import { buildStorePageMetadata, fetchStorePage, StorePageView } from '@/components/store/StorePageView';

// Store legal pages at /legal/{slug} on the store host (store-legal-pages
// SPEC). The API resolves what the URL shows:
// - `store_page`: the store's own published page, rendered exactly as at its
//   own `/{page_slug}` URL (StorePageView), canonical here;
// - `template`: the default template filled with the store's trader details
//   (MARKETPLACE stores: always, filled with Namez AB as the seller).
// Locale on the store tree is resolved from `?lang=` (set by the proxy when
// the URL had a locale prefix) and falls back to the store's primary locale.

interface StoreLite {
  name?: string;
  language_config?: { primary_locale?: string; secondary_locales?: string[] } | null;
  trader_details?: TraderDetails | null;
  custom_domain?: string | null;
  market?: MarketRoute | null;
  markets?: MarketRoute[];
}

interface StoreLegalPageProps {
  params: Promise<{ storeSlug: string; slug: string }>;
  searchParams: Promise<{ lang?: string }>;
}

function isKnownSlug(slug: string): slug is LegalSlug {
  return (LEGAL_SLUGS as readonly string[]).includes(slug);
}

/** Locale path prefix of the current URL: none for the primary locale. */
function localePrefix(locale: string, store: StoreLite | null): string {
  return locale !== (store?.language_config?.primary_locale || 'en') ? `/${locale}` : '';
}

/**
 * Template html with `{{trader.*}}` resolved and its relative
 * `/legal/...` links carrying the current locale prefix (the same rule as
 * every other store link), so a secondary-locale page links within its locale.
 */
function legalHtml(content: string, store: StoreLite | null, locale: string): string {
  const html = substituteTraderPlaceholders(content, store?.trader_details);
  const lp = localePrefix(locale, store);
  return lp ? html.replace(/href=(["'])\/legal\//g, `href=$1${lp}/legal/`) : html;
}

async function resolve(storeSlug: string, slug: LegalSlug, lang: string | undefined): Promise<{
  locale: string;
  store: StoreLite | null;
  page: StoreLegalPage | null;
}> {
  const market = await getRequestMarket();
  let store: StoreLite | null = null;
  try {
    store = (await storefront.getStore(storeSlug, market)) as StoreLite;
  } catch {
    store = null;
  }
  const locale = lang || store?.language_config?.primary_locale || 'en';
  let page: StoreLegalPage | null = null;
  try {
    page = await storefront.getLegalPage(storeSlug, slug, locale, market);
  } catch {
    page = null;
  }
  return { locale, store, page };
}

export async function generateMetadata({
  params,
  searchParams,
}: StoreLegalPageProps): Promise<Metadata> {
  const { storeSlug, slug: rawSlug } = await params;
  // Decoded once here; the API helper encodes it once (no double encoding).
  const slug = routeSlug(rawSlug);
  const { lang } = await searchParams;
  if (!isKnownSlug(slug)) return {};

  const { locale, store, page } = await resolve(storeSlug, slug, lang);
  if (!page) return {};
  const subpath = `/legal/${slug}`;

  if (page.source === 'store_page') {
    const data = await fetchStorePage(storeSlug, page.page_slug, page.page_system);
    return buildStorePageMetadata({ storeSlug, pageSlug: page.page_slug, lang, data, path: subpath });
  }

  // Canonical = subdomain URL with the primary locale (no prefix). hreflang
  // alternates use path-prefix `/{locale}/...` for secondary locales, which
  // is what Google prefers (not query strings).
  const alternates = buildStoreAlternates({
    origin: buildStoreOrigin(storeSlug, store?.custom_domain || null, store?.market),
    locale,
    primaryLocale: store?.language_config?.primary_locale || 'en',
    secondaryLocales: store?.language_config?.secondary_locales || [],
    path: subpath,
    markets: store?.markets,
    storeSlug,
    // Preview host / proxy indexing verdict (M6.1): self canonical only.
    market: store?.market,
    noindex: await getRequestNoindex(),
    storeCustomDomain: store?.custom_domain ?? null,
  });

  const description = htmlExcerpt(substituteTraderPlaceholders(page.content, store?.trader_details)) || page.title;
  return {
    title: page.title,
    description,
    alternates,
    openGraph: { title: page.title, description, type: 'website' },
  };
}

export default async function StoreLegalPage({ params, searchParams }: StoreLegalPageProps) {
  const { storeSlug, slug: rawSlug } = await params;
  // Decoded once here; the API helper encodes it once (no double encoding).
  const slug = routeSlug(rawSlug);
  const { lang } = await searchParams;
  if (!isKnownSlug(slug)) notFound();

  const { locale, store, page } = await resolve(storeSlug, slug, lang);
  if (!page) notFound();

  if (page.source === 'store_page') {
    const data = await fetchStorePage(storeSlug, page.page_slug, page.page_system);
    return (
      <StorePageView
        storeSlug={storeSlug}
        pageSlug={page.page_slug}
        lang={lang}
        data={data}
        path={`/legal/${slug}`}
      />
    );
  }

  // Direction follows the locale whose text the API actually served (a
  // missing translation falls back), else the requested one.
  const contentLocale = page.locale || locale;
  const primaryLocale = store?.language_config?.primary_locale || 'en';
  const t = await getTranslations();
  const homeHref = localePrefix(locale, store) || '/';
  // JSON-LD WebPage + Home › page breadcrumb, as for a store page.
  const ld = buildLandingJsonLd({
    origin: buildStoreOrigin(storeSlug, store?.custom_domain || null, store?.market),
    path: `/legal/${slug}`,
    locale,
    primaryLocale,
    siteName: store?.name,
    homeLabel: t('common.home'),
    name: page.title,
    description: htmlExcerpt(substituteTraderPlaceholders(page.content, store?.trader_details)),
  });

  return (
    <div
      className="container mx-auto px-4 py-12 max-w-3xl"
      dir={isRtl(contentLocale) ? 'rtl' : 'ltr'}
    >
      {ld && (
        <>
          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJsonSafe(ld.page) }} />
          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJsonSafe(ld.breadcrumb) }} />
        </>
      )}
      <PageBreadcrumb
        homeHref={homeHref}
        homeLabel={t('common.home')}
        current={page.title}
        locale={locale}
        className="mb-6"
      />
      <h1 className="text-3xl font-bold text-gray-900 mb-8">{page.title}</h1>
      <div
        className="prose prose-gray max-w-none"
        // Template html arrives filled; any `{{trader.*}}` left would resolve
        // to the store's trader details (no-op when none remain).
        dangerouslySetInnerHTML={{ __html: legalHtml(page.content, store, locale) }}
      />
    </div>
  );
}
