import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { ProductDetailClient } from '@/components/product/ProductDetailClient';
import { api } from '@/lib/api';
import { notFound } from 'next/navigation';

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string; locale: string }>;
}) {
  const { slug, locale } = await params;

  let product: any;
  let currency = 'EUR';
  try {
    // Search by slug across all products
    const res = await api<any>(`/products`);
    const products = (res as any)?.data || res || [];
    product = Array.isArray(products)
      ? products.find((p: any) =>
          p.translations?.some((t: any) => t.slug === slug)
        )
      : null;

    // Fetch full product details by ID
    if (product) {
      product = await api<any>(`/products/${product.id}`);
    }
    // Fetch platform currency
    const config = await api<any>(`/admin/platform-config`).catch(() => null);
    if (config?.default_currency) currency = config.default_currency;
  } catch {
    notFound();
  }

  if (!product) notFound();

  return (
    <>
      <Header />
      <main className="flex-1 container mx-auto px-4 py-8">
        <ProductDetailClient product={product} locale={locale} currency={currency} />
      </main>
      <Footer />
    </>
  );
}
