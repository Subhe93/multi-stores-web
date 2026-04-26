import { getTranslations } from 'next-intl/server';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { ProductGrid } from '@/components/product/ProductGrid';
import { api } from '@/lib/api';

interface ProductsResponse {
  data: any[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export default async function ProductsPage({
  params: pageParams,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ page?: string; search?: string; category_id?: string }>;
}) {
  const { locale } = await pageParams;
  const t = await getTranslations({ locale, namespace: 'product' });
  const params = await searchParams;
  let products: any[] = [];

  try {
    const query: Record<string, string> = {};
    if (params.page) query.page = params.page;
    if (params.search) query.search = params.search;
    if (params.category_id) query.category_id = params.category_id;

    const queryStr = Object.keys(query).length
      ? '?' + new URLSearchParams(query).toString()
      : '';

    const res = await api<ProductsResponse>(`/products${queryStr}`);
    products = (res as any)?.data || res || [];
  } catch {
    products = [];
  }

  return (
    <>
      <Header />
      <main className="flex-1 container mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">{t('allProducts')}</h1>
        <ProductGrid products={Array.isArray(products) ? products : []} />
      </main>
      <Footer />
    </>
  );
}
