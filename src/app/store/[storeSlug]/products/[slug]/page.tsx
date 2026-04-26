import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { ChevronRight } from 'lucide-react';
import { storefront } from '@/lib/api';
import { ProductDetailClient } from '@/components/product/ProductDetailClient';

interface ProductDetailProps {
  params: Promise<{ storeSlug: string; slug: string }>;
  searchParams: Promise<{ lang?: string }>;
}

export default async function StoreProductDetailPage({ params, searchParams }: ProductDetailProps) {
  const { storeSlug, slug: productSlug } = await params;
  const { lang } = await searchParams;
  const t = await getTranslations();
  const locale = lang || 'en';
  const lp = lang ? `/${lang}` : '';

  let product: any;
  let storeCurrency = 'EUR';
  try {
    product = await storefront.getProduct(storeSlug, productSlug, locale);
    const storeData = await storefront.getStore(storeSlug);
    storeCurrency = (storeData as any)?.currency || 'EUR';
  } catch {
    notFound();
  }

  const translation =
    product.translations?.find((tr: any) => tr.locale === locale) ||
    product.translations?.find((tr: any) => tr.locale === 'en') ||
    product.translations?.[0];

  const categoryName =
    product.category?.translations?.find((ct: any) => ct.locale === locale)?.name ||
    product.category?.translations?.[0]?.name;

  return (
    <div className="container mx-auto px-4 py-6 lg:py-10" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      {/* Breadcrumb */}
      <nav className="mb-6 lg:mb-8 flex items-center flex-wrap gap-1 text-sm" aria-label="Breadcrumb">
        <Link href={`${lp}/`} className="text-gray-400 hover:text-gray-700 transition-colors">
          {t('common.home')}
        </Link>
        <ChevronRight className="w-3.5 h-3.5 text-gray-300 shrink-0" />
        <Link href={`${lp}/products`} className="text-gray-400 hover:text-gray-700 transition-colors">
          {t('common.products')}
        </Link>
        {categoryName && (
          <>
            <ChevronRight className="w-3.5 h-3.5 text-gray-300 shrink-0" />
            <span className="text-gray-400">{categoryName}</span>
          </>
        )}
        <ChevronRight className="w-3.5 h-3.5 text-gray-300 shrink-0" />
        <span className="text-gray-700 font-medium truncate max-w-50">
          {translation?.title || 'Product'}
        </span>
      </nav>

      <ProductDetailClient product={product} locale={locale} currency={storeCurrency} />
    </div>
  );
}