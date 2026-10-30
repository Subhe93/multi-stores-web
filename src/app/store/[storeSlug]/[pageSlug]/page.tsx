import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { storefront, resolveMediaUrl } from '@/lib/api';
import { buildFaqPage, buildTwitterMeta, ldJsonSafe } from '@/lib/jsonld';
import { buildLandingJsonLd, pageFaqItems } from '@/lib/pageJsonLd';
import { buildStoreOrigin, buildStoreAlternates } from '@/lib/storeUrl';
import type { MarketRoute } from '@/lib/market';
import { getRequestMarket, getRequestNoindex } from '@/lib/market.server';
import { resolveTheme } from '@/themes/registry';
import { SectionRenderer } from '@/themes/SectionRenderer';
import { preloadSectionData } from '@/lib/preloadSections';
import type { SectionInstance } from '@/themes/types';
import { PageBreadcrumb } from '@/components/common/PageBreadcrumb';
import { htmlExcerpt, sectionsExcerpt } from '@/lib/pageExcerpt';

// Static pages now have two backends:
// - v2 Page (with sections, versions, SEO panel) — preferred when published
// - legacy StaticPage (single rich-html `content` field) — fallback for older
//   pages until they're migrated.
// The route picks v2 if available so creators who publish via the v2 builder
// see their layout, then falls back to the legacy renderer.

interface LegacyPageTranslation {
  locale: string;
  title: string;
  content?: string;
}

interface LegacyPage {
  id: string;
  slug: string;
  status: string;
  translations: LegacyPageTranslation[];
}

interface V2Page {
  id: string;
  type: string;
  seo: { og_image?: string; canonical?: string; robots?: string; twitter_card?: string };
  snapshot: {
    page: {
      translations: Array<{
        locale: string;
        title?: string;
        meta_title?: string;
        meta_description?: string;
      }>;
    };
    sections: SectionInstance[];
  };
}

interface StoreLite {
  name?: string;
  // Store currency, or the request market's when the Markets app is on.
  currency?: string;
  theme_key?: string;
  language_config?: { primary_locale?: string; secondary_locales?: string[] } | null;
  custom_domain?: string | null;
  market?: MarketRoute | null;
  markets?: MarketRoute[];
}

interface PageProps {
  params: Promise<{ storeSlug: string; pageSlug: string }>;
  searchParams: Promise<{ lang?: string }>;
}

// Avoid colliding with sibling routes that share the [pageSlug] segment.
const RESERVED_SLUGS = new Set(['products', 'cart', 'checkout', 'auth', 'account', 'collections', 'p', 'market-not-found']);

async function fetchData(storeSlug: string, pageSlug: string) {
  const [store, v2, legacy] = await Promise.all([
    storefront.getStore(storeSlug, await getRequestMarket()).catch(() => null) as Promise<StoreLite | null>,
    // M6.6: builder pages — STATIC or LANDING — are both served at the root
    // (slugs are unique per store, so one lookup covers both).
    storefront.getPublishedPage(storeSlug, pageSlug).catch(() => null) as Promise<V2Page | null>,
    storefront.getPage(storeSlug, pageSlug).catch(() => null) as Promise<LegacyPage | null>,
  ]);
  return { store, v2, legacy };
}

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const { storeSlug, pageSlug } = await params;
  if (RESERVED_SLUGS.has(pageSlug)) return {};
  const { lang } = await searchParams;

  const { store, v2, legacy } = await fetchData(storeSlug, pageSlug);
  if (!v2 && !legacy) return {};

  const primaryLocale = store?.language_config?.primary_locale || 'en';
  const secondary = store?.language_config?.secondary_locales || [];
  const locale = lang || primaryLocale;

  // Canonical = subdomain URL with primary locale (no prefix). Alternates
  // use path-prefix `/{locale}/...` for secondary locales.
  const origin = buildStoreOrigin(storeSlug, store?.custom_domain || null, store?.market);
  const subpath = `/${pageSlug}`;
  const alternates = buildStoreAlternates({
    origin: origin,
    locale,
    primaryLocale,
    secondaryLocales: secondary,
    path: subpath,
    markets: store?.markets,
    market: store?.market,
    noindex: await getRequestNoindex(),
    storeCustomDomain: store?.custom_domain ?? null,
    storeSlug,
  });

  if (v2) {
    const tr =
      v2.snapshot.page.translations.find((t) => t.locale === locale) ||
      v2.snapshot.page.translations.find((t) => t.locale === primaryLocale) ||
      v2.snapshot.page.translations[0];
    // Absolutize: API stores og_image as a relative `/uploads/...` path, which
    // external crawlers would otherwise resolve against their own origin.
    const ogImage = v2.seo?.og_image ? resolveMediaUrl(v2.seo.og_image) : undefined;
    const ogTitle = tr?.meta_title || tr?.title || undefined;
    // No meta description written: the page's own first text, not the
    // store-wide default (which then repeated on every such page).
    const description =
      tr?.meta_description?.trim() || sectionsExcerpt(v2.snapshot.sections, locale, primaryLocale);

    return {
      title: tr?.meta_title || tr?.title,
      description,
      alternates: { ...alternates, canonical: v2.seo?.canonical || alternates.canonical },
      openGraph: {
        title: ogTitle,
        description,
        images: ogImage ? [ogImage] : undefined,
        type: 'website',
      },
      twitter: buildTwitterMeta({
        card: v2.seo?.twitter_card,
        title: ogTitle,
        description,
        image: ogImage,
      }),
      robots: v2.seo?.robots,
    };
  }

  // Legacy fallback — title from translations, description from the content.
  const tr =
    legacy!.translations.find((t) => t.locale === locale) ||
    legacy!.translations.find((t) => t.locale === primaryLocale) ||
    legacy!.translations[0];
  return {
    title: tr?.title,
    description: htmlExcerpt(tr?.content),
    alternates,
  };
}

export default async function StoreStaticPage({ params, searchParams }: PageProps) {
  const { storeSlug, pageSlug } = await params;
  const { lang } = await searchParams;

  if (RESERVED_SLUGS.has(pageSlug)) notFound();

  const { store, v2, legacy } = await fetchData(storeSlug, pageSlug);
  const t = await getTranslations();

  // The canonical (unprefixed) URL is the store's PRIMARY locale — falling
  // back to 'en' rendered English content on e.g. a German store's own URL.
  const locale = lang || store?.language_config?.primary_locale || 'en';

  // Home link of the visible breadcrumb: no prefix for the primary locale.
  const homeHref = locale !== (store?.language_config?.primary_locale || 'en') ? `/${locale}` : '/';

  // JSON-LD: WebPage (CollectionPage when the page lists products) and a
  // Home › page breadcrumb. The origin and locale URL follow the same rules
  // as the canonical in generateMetadata; a noindex page emits nothing.
  const ldOrigin = buildStoreOrigin(storeSlug, store?.custom_domain || null, store?.market);
  const ldPrimary = store?.language_config?.primary_locale || 'en';
  const renderPageLd = (input: {
    name: string;
    description?: string | null;
    canonical?: string | null;
    sections?: SectionInstance[] | null;
    robots?: string | null;
  }) => {
    const ld = buildLandingJsonLd({
      origin: ldOrigin,
      path: `/${pageSlug}`,
      locale,
      primaryLocale: ldPrimary,
      siteName: store?.name,
      homeLabel: t('common.home'),
      ...input,
    });
    if (!ld) return null;
    // FAQ sections on the page (e.g. questions at the end of a landing page).
    const faqLd = buildFaqPage(pageFaqItems(input.sections, locale, ldPrimary));
    return (
      <>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJsonSafe(ld.page) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJsonSafe(ld.breadcrumb) }} />
        {faqLd && (
          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJsonSafe(faqLd) }} />
        )}
      </>
    );
  };

  // Prefer v2 — it carries the section layout the creator built. The CSS vars
  // from the parent layout are already in scope so sections render themed.
  if (v2 && v2.snapshot?.sections?.length) {
    const theme = resolveTheme(store?.theme_key);
    const primaryLocale = store?.language_config?.primary_locale || 'en';
    // M6.4: collection-products sections render their list from the server.
    const preloaded = await preloadSectionData(storeSlug, v2.snapshot.sections, {
      locale,
      marketRef: await getRequestMarket(),
    });
    const tr =
      v2.snapshot.page.translations.find((x) => x.locale === locale) ||
      v2.snapshot.page.translations.find((x) => x.locale === primaryLocale) ||
      v2.snapshot.page.translations[0];
    const pageName = tr?.title || tr?.meta_title || pageSlug;
    return (
      <div dir={locale === 'ar' ? 'rtl' : 'ltr'}>
        {renderPageLd({
          name: pageName,
          description: tr?.meta_description,
          canonical: v2.seo?.canonical,
          sections: v2.snapshot.sections,
          robots: v2.seo?.robots,
        })}
        <PageBreadcrumb
          homeHref={homeHref}
          homeLabel={t('common.home')}
          current={pageName}
          locale={locale}
          className="pt-4 pb-3"
        />
        <SectionRenderer
          theme={theme}
          sections={v2.snapshot.sections}
          locale={locale}
          primaryLocale={primaryLocale}
          storeSlug={storeSlug}
          // Product cards fall back to EUR without it (prices showed "€").
          currency={store?.currency}
          preloaded={preloaded}
        />
      </div>
    );
  }

  // Legacy fallback — single rich-html block. Prefer the store's primary
  // locale over English when the requested locale has no translation.
  if (!legacy || legacy.status !== 'PUBLISHED') notFound();
  const legacyPrimary = store?.language_config?.primary_locale || 'en';
  const translation =
    legacy.translations.find((t) => t.locale === locale) ||
    legacy.translations.find((t) => t.locale === legacyPrimary) ||
    legacy.translations.find((t) => t.locale === 'en') ||
    legacy.translations[0];
  if (!translation) notFound();

  return (
    <div className="container mx-auto px-4 py-12 max-w-3xl" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      {renderPageLd({ name: translation.title })}
      <PageBreadcrumb
        homeHref={homeHref}
        homeLabel={t('common.home')}
        current={translation.title}
        locale={locale}
        className="mb-6"
      />
      <h1 className="text-3xl font-bold text-gray-900 mb-8">{translation.title}</h1>
      {translation.content ? (
        <div
          className="prose prose-gray max-w-none"
          dangerouslySetInnerHTML={{ __html: translation.content }}
        />
      ) : (
        <p className="text-gray-500">No content yet.</p>
      )}
    </div>
  );
}

// Storefront reads are tagged with the store (see lib/api.ts) and refreshed
// on-demand via /api/revalidate when the creator publishes, so cached data
// stays fresh without forcing a dynamic render on every request.
