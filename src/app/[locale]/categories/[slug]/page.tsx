import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { ProductGrid } from '@/components/product/ProductGrid';
import { api } from '@/lib/api';
import { notFound } from 'next/navigation';

interface Category {
  id: string;
  translations: { locale: string; name: string; slug: string }[];
}

interface ProductsResponse {
  data: any[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;

  // Resolve category by slug
  let category: Category | null = null;
  try {
    const categories = await api<Category[]>('/categories');
    const list = Array.isArray(categories) ? categories : [];
    category =
      list.find((c) =>
        c.translations?.some((t) => t.slug === slug),
      ) ?? null;
  } catch {
    notFound();
  }

  if (!category) notFound();

  // Fetch products for this category
  let products: any[] = [];
  try {
    const res = await api<ProductsResponse>(
      `/products?category_id=${category.id}`,
    );
    products = (res as any)?.data || res || [];
  } catch {
    products = [];
  }

  // Get category name for the current locale
  const translation =
    category.translations.find((t) => t.locale === locale) ||
    category.translations[0];
  const categoryName = translation?.name || 'Category';

  return (
    <>
      <Header />
      <main className="flex-1 container mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">{categoryName}</h1>
        <ProductGrid
          products={Array.isArray(products) ? products : []}
          locale={locale}
        />
      </main>
      <Footer />
    </>
  );
}
