import { notFound } from 'next/navigation';
import { api } from '@/lib/api';
import { BlockRenderer } from '@/components/page-builder/BlockRenderer';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';

// Reserved slugs that should not be handled by this catch-all route
const RESERVED_SLUGS = [
  'products',
  'cart',
  'checkout',
  'auth',
  'account',
  'categories',
  'store',
];

interface PageData {
  id: string;
  slug: string;
  title: string;
  blocks: {
    id: string;
    type: string;
    settings: any;
    translations: { locale: string; content: any }[];
  }[];
}

export default async function StaticPage({
  params,
}: {
  params: Promise<{ pageSlug: string; locale: string }>;
}) {
  const { pageSlug, locale } = await params;

  // Filter out reserved slugs
  if (RESERVED_SLUGS.includes(pageSlug)) {
    notFound();
  }

  let page: PageData;
  try {
    page = await api<PageData>(`/pages/by-slug/${pageSlug}`);
  } catch {
    notFound();
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <div className="container mx-auto px-4 py-8">
          <BlockRenderer blocks={page.blocks} locale={locale} />
        </div>
      </main>
      <Footer />
    </div>
  );
}
