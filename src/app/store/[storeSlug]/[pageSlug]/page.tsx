import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { storefront } from '@/lib/api';
import { resolveTheme } from '@/themes/registry';
import { SectionRenderer } from '@/themes/SectionRenderer';
import type { SectionInstance } from '@/themes/types';

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
  seo: { og_image?: string; canonical?: string; robots?: string };
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
  theme_key?: string;
  language_config?: { primary_locale?: string; secondary_locales?: string[] } | null;
}

interface PageProps {
  params: Promise<{ storeSlug: string; pageSlug: string }>;
  searchParams: Promise<{ lang?: string }>;
}

// Avoid colliding with sibling routes that share the [pageSlug] segment.
const RESERVED_SLUGS = new Set(['products', 'cart', 'checkout', 'auth', 'account', 'collections', 'p']);

async function fetchData(storeSlug: string, pageSlug: string) {
  const [store, v2, legacy] = await Promise.all([
    storefront.getStore(storeSlug).catch(() => null) as Promise<StoreLite | null>,
    storefront.getPublishedPage(storeSlug, pageSlug, 'STATIC').catch(() => null) as Promise<V2Page | null>,
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

  const path = `/store/${storeSlug}/${pageSlug}`;
  const allLocales = Array.from(new Set([primaryLocale, ...secondary]));
  const languages: Record<string, string> = {};
  for (const l of allLocales) languages[l] = `${path}?lang=${l}`;

  if (v2) {
    const tr =
      v2.snapshot.page.translations.find((t) => t.locale === locale) ||
      v2.snapshot.page.translations.find((t) => t.locale === primaryLocale) ||
      v2.snapshot.page.translations[0];
    return {
      title: tr?.meta_title || tr?.title,
      description: tr?.meta_description,
      alternates: { canonical: v2.seo?.canonical || path, languages },
      openGraph: {
        title: tr?.meta_title || tr?.title || undefined,
        description: tr?.meta_description,
        images: v2.seo?.og_image ? [v2.seo.og_image] : undefined,
        type: 'website',
      },
      robots: v2.seo?.robots,
    };
  }

  // Legacy fallback — only title from translations, no SEO settings.
  const tr =
    legacy!.translations.find((t) => t.locale === locale) ||
    legacy!.translations.find((t) => t.locale === primaryLocale) ||
    legacy!.translations[0];
  return {
    title: tr?.title,
    alternates: { canonical: path, languages },
  };
}

export default async function StoreStaticPage({ params, searchParams }: PageProps) {
  const { storeSlug, pageSlug } = await params;
  const { lang } = await searchParams;
  const locale = lang || 'en';

  if (RESERVED_SLUGS.has(pageSlug)) notFound();

  const { store, v2, legacy } = await fetchData(storeSlug, pageSlug);

  // Prefer v2 — it carries the section layout the creator built. The CSS vars
  // from the parent layout are already in scope so sections render themed.
  if (v2 && v2.snapshot?.sections?.length) {
    const theme = resolveTheme(store?.theme_key);
    const primaryLocale = store?.language_config?.primary_locale || 'en';
    return (
      <div dir={locale === 'ar' ? 'rtl' : 'ltr'}>
        <SectionRenderer
          theme={theme}
          sections={v2.snapshot.sections}
          locale={locale}
          primaryLocale={primaryLocale}
          storeSlug={storeSlug}
        />
      </div>
    );
  }

  // Legacy fallback — single rich-html block.
  if (!legacy || legacy.status !== 'PUBLISHED') notFound();
  const translation =
    legacy.translations.find((t) => t.locale === locale) ||
    legacy.translations.find((t) => t.locale === 'en') ||
    legacy.translations[0];
  if (!translation) notFound();

  return (
    <div className="container mx-auto px-4 py-12 max-w-3xl" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
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
