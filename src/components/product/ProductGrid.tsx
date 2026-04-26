import { ProductCard } from './ProductCard';
import { resolveMediaUrl } from '@/lib/api';

interface Product {
  id: string;
  base_price: number;
  translations: { locale: string; title: string; slug: string }[];
  images: { url: string }[];
}

interface ProductGridProps {
  products: Product[];
  locale?: string;
  currency?: string;
}

export function ProductGrid({ products, locale = 'en', currency }: ProductGridProps) {
  if (products.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        No products found
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
      {products.map((product) => {
        const translation = product.translations.find((t) => t.locale === locale)
          || product.translations[0];

        return (
          <ProductCard
            key={product.id}
            title={translation?.title || 'Untitled'}
            href={`/products/${translation?.slug || product.id}`}
            price={Number(product.base_price)}
            imageUrl={product.images[0]?.url ? resolveMediaUrl(product.images[0].url) : undefined}
            currency={currency}
          />
        );
      })}
    </div>
  );
}
