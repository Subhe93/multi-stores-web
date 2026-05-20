import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cookies, headers } from 'next/headers';
import { storefront } from '@/lib/api';
import { resolveTheme } from '@/themes/registry';
import { SectionRenderer } from '@/themes/SectionRenderer';
import type { SectionInstance, ThemeCustomizations } from '@/themes/types';

interface StoreLite {
  theme_key?: string;
  theme_customizations?: ThemeCustomizations;
  language_config?: {
    primary_locale?: string;
    secondary_locales?: string[];
  } | null;
}

interface PageTranslationRow {
  locale: string;
  title?: string;
  meta_title?: string;
  meta_description?: string;
}

interface PublishedSnapshot {
  page: {
    type: string;
    seo?: { og_image?: string; canonical?: string; robots?: string };
    translations: PageTranslationRow[];
  };
  sections: SectionInstance[];
}

interface PublishedPage {
  id: string;
  type: string;
  seo: { og_image?: string; canonical?: string; robots?: string };
  snapshot: PublishedSnapshot;
}

interface LandingProps {
  params: Promise<{ storeSlug: string; slug: string }>;
  searchParams: Promise<{ lang?: string }>;
}

async function fetchData(storeSlug: string, slug: string) {
  const [store, published] = await Promise.all([
    storefront.getStore(storeSlug).catch(() => null) as Promise<StoreLite | null>,
    storefront.getPublishedPage(storeSlug, slug, 'LANDING').catch(() => null) as Promise<PublishedPage | null>,
  ]);
  return { store, published };
}

function resolveLocale(
  searchLang: string | undefined,
  primaryLocale: string,
  cookieLocale?: string,
  headerLocale?: string | null,
): string {
  return searchLang || cookieLocale || headerLocale || primaryLocale;
}

// SEO: hreflang for every supported locale + Open Graph from page.seo.
export async function generateMetadata({ params, searchParams }: LandingProps): Promise<Metadata> {
  const { storeSlug, slug } = await params;
  const { lang } = await searchParams;
  const { store, published } = await fetchData(storeSlug, slug);
  if (!published) return {};
  const primaryLocale = store?.language_config?.primary_locale || 'en';
  const secondaryLocales = store?.language_config?.secondary_locales || [];
  const locale = resolveLocale(lang, primaryLocale);
  const tr =
    published.snapshot.page.translations.find((t) => t.locale === locale) ||
    published.snapshot.page.translations.find((t) => t.locale === primaryLocale) ||
    published.snapshot.page.translations[0];

  const allLocales = Array.from(new Set([primaryLocale, ...secondaryLocales]));
  const languages: Record<string, string> = {};
  for (const l of allLocales) {
    languages[l] = `/store/${storeSlug}/p/${slug}?lang=${l}`;
  }

  return {
    title: tr?.meta_title || tr?.title,
    description: tr?.meta_description,
    alternates: {
      canonical: published.seo?.canonical || `/store/${storeSlug}/p/${slug}`,
      languages,
    },
    openGraph: {
      title: tr?.meta_title || tr?.title || undefined,
      description: tr?.meta_description,
      images: published.seo?.og_image ? [published.seo.og_image] : undefined,
      type: 'website',
    },
    robots: published.seo?.robots,
  };
}

export default async function LandingPage({ params, searchParams }: LandingProps) {
  const { storeSlug, slug } = await params;
  const { lang } = await searchParams;

  const cookieStore = await cookies();
  const requestHeaders = await headers();
  const cookieLocale = cookieStore.get('x-store-locale')?.value;
  const headerLocale = requestHeaders.get('x-locale');

  const { store, published } = await fetchData(storeSlug, slug);
  if (!published || !published.snapshot?.sections?.length) notFound();

  const primaryLocale = store?.language_config?.primary_locale || 'en';
  const locale = resolveLocale(lang, primaryLocale, cookieLocale, headerLocale);
  const theme = resolveTheme(store?.theme_key);

  return (
    <SectionRenderer
      theme={theme}
      sections={published.snapshot.sections}
      locale={locale}
      primaryLocale={primaryLocale}
      storeSlug={storeSlug}
    />
  );
}

// Cached via store-tagged reads (see lib/api.ts); refreshed on-demand through
// /api/revalidate when the creator publishes.
