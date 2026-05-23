import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { legal, storefront, LEGAL_SLUGS, type LegalSlug } from '@/lib/api';
import { buildStoreOrigin, storeLocalePath } from '@/lib/storeUrl';

// Platform legal pages mirrored into the store tree so each storefront can
// link to /legal/{slug} on its own subdomain. Locale on the store tree is
// resolved from `?lang=` (set by the proxy when the URL had a locale prefix)
// and falls back to the store's primary locale.

interface StoreLite {
  language_config?: { primary_locale?: string; secondary_locales?: string[] } | null;
  custom_domain?: string | null;
}

interface StoreLegalPageProps {
  params: Promise<{ storeSlug: string; slug: string }>;
  searchParams: Promise<{ lang?: string }>;
}

function isKnownSlug(slug: string): slug is LegalSlug {
  return (LEGAL_SLUGS as readonly string[]).includes(slug);
}

async function resolveLocale(storeSlug: string, lang: string | undefined): Promise<{
  locale: string;
  primaryLocale: string;
  secondaryLocales: string[];
  origin: string;
}> {
  let store: StoreLite | null = null;
  try {
    store = (await storefront.getStore(storeSlug)) as StoreLite;
  } catch {
    store = null;
  }
  const primaryLocale = store?.language_config?.primary_locale || 'en';
  const secondaryLocales = store?.language_config?.secondary_locales || [];
  const origin = buildStoreOrigin(storeSlug, store?.custom_domain || null);
  return { locale: lang || primaryLocale, primaryLocale, secondaryLocales, origin };
}

export async function generateMetadata({
  params,
  searchParams,
}: StoreLegalPageProps): Promise<Metadata> {
  const { storeSlug, slug } = await params;
  const { lang } = await searchParams;
  if (!isKnownSlug(slug)) return {};

  const { locale, primaryLocale, secondaryLocales, origin } = await resolveLocale(storeSlug, lang);

  try {
    const page = await legal.get(slug, locale);

    // Canonical = subdomain URL with the primary locale (no prefix). hreflang
    // alternates use path-prefix `/{locale}/...` for secondary locales, which
    // is what Google prefers (not query strings).
    const subpath = `/legal/${slug}`;
    const canonical = storeLocalePath(origin, primaryLocale, primaryLocale, subpath);
    const allLocales = Array.from(new Set([primaryLocale, ...secondaryLocales]));
    const languages: Record<string, string> = {};
    for (const l of allLocales) {
      languages[l] = storeLocalePath(origin, l, primaryLocale, subpath);
    }

    return {
      title: page.title,
      description: page.title,
      alternates: { canonical, languages },
    };
  } catch {
    return {};
  }
}

export default async function StoreLegalPage({ params, searchParams }: StoreLegalPageProps) {
  const { storeSlug, slug } = await params;
  const { lang } = await searchParams;
  if (!isKnownSlug(slug)) notFound();

  const { locale } = await resolveLocale(storeSlug, lang);

  let page;
  try {
    page = await legal.get(slug, locale);
  } catch {
    notFound();
  }

  return (
    <div
      className="container mx-auto px-4 py-12 max-w-3xl"
      dir={locale === 'ar' ? 'rtl' : 'ltr'}
    >
      <h1 className="text-3xl font-bold text-gray-900 mb-8">{page.title}</h1>
      <div
        className="prose prose-gray max-w-none"
        dangerouslySetInnerHTML={{ __html: page.content }}
      />
    </div>
  );
}
