import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { legal, LEGAL_SLUGS, type LegalSlug } from '@/lib/api';
import { localePath } from '@/lib/locale-path';
import { MarketingHeader } from '@/components/marketing/MarketingHeader';
import { MarketingFooter } from '@/components/marketing/MarketingFooter';

// Platform legal pages (Privacy / Terms / Refund / Shipping). Rendered on the
// marketing site under /{locale}/legal/{slug}. The API supplies a localized
// title + admin-curated HTML, with sensible fallbacks to en/any-available.

interface LegalPageProps {
  params: Promise<{ locale: string; slug: string }>;
}

function isKnownSlug(slug: string): slug is LegalSlug {
  return (LEGAL_SLUGS as readonly string[]).includes(slug);
}

export async function generateMetadata({ params }: LegalPageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isKnownSlug(slug)) return {};
  try {
    const page = await legal.get(slug, locale);
    return {
      title: page.title,
      description: `${page.title} — Multi-Stores`,
      alternates: { canonical: localePath(`/legal/${slug}`, locale) },
    };
  } catch {
    return {};
  }
}

export default async function PlatformLegalPage({ params }: LegalPageProps) {
  const { locale, slug } = await params;
  if (!isKnownSlug(slug)) notFound();

  let page;
  try {
    page = await legal.get(slug, locale);
  } catch {
    notFound();
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg)', color: 'var(--text-primary)' }}>
      <MarketingHeader locale={locale} />
      {/* pt-24 leaves room for the fixed marketing header. */}
      <main className="flex-1 container mx-auto px-4 pt-24 pb-16 max-w-3xl">
        <h1 className="text-3xl md:text-4xl font-bold mb-8">{page.title}</h1>
        <div
          className="prose prose-gray max-w-none"
          dangerouslySetInnerHTML={{ __html: page.content }}
        />
      </main>
      <MarketingFooter locale={locale} />
    </div>
  );
}
