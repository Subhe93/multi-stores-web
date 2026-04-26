import { notFound } from 'next/navigation';
import { storefront } from '@/lib/api';

interface PageTranslation {
  locale: string;
  title: string;
  content?: string;
}

interface Page {
  id: string;
  slug: string;
  status: string;
  translations: PageTranslation[];
}

interface StaticPageProps {
  params: Promise<{ storeSlug: string; pageSlug: string }>;
  searchParams: Promise<{ lang?: string }>;
}

export default async function StoreStaticPage({ params, searchParams }: StaticPageProps) {
  const { storeSlug, pageSlug } = await params;
  const { lang } = await searchParams;
  const locale = lang || 'en';

  // Skip known route segments to avoid conflicts with other routes
  const reservedSlugs = ['products', 'cart', 'checkout'];
  if (reservedSlugs.includes(pageSlug)) {
    notFound();
  }

  let page: Page;
  try {
    page = await storefront.getPage(storeSlug, pageSlug) as Page;
  } catch {
    notFound();
  }

  const translation =
    page.translations.find((t) => t.locale === locale) ||
    page.translations.find((t) => t.locale === 'en') ||
    page.translations[0];

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
