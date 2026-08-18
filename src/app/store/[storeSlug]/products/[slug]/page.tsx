import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { ChevronRight } from 'lucide-react';
import { storefront, resolveMediaUrl } from '@/lib/api';
import { buildStoreOrigin, storeLocalePath, buildStoreAlternates } from '@/lib/storeUrl';
import { ProductDetailClient } from '@/components/product/ProductDetailClient';
import { resolveTheme } from '@/themes/registry';
import { SectionRenderer } from '@/themes/SectionRenderer';
import type { ProductContext, SectionInstance } from '@/themes/types';
import { buildBreadcrumb, buildProduct, ldJsonSafe } from '@/lib/jsonld';

interface ProductDetailProps {
  params: Promise<{ storeSlug: string; slug: string }>;
  searchParams: Promise<{ lang?: string }>;
}

// Per-product metadata: title/description from translations, canonical, hreflang
// for every store locale, and Open Graph with the first product image.
export async function generateMetadata({
  params,
  searchParams,
}: ProductDetailProps): Promise<Metadata> {
  const { storeSlug, slug: productSlug } = await params;
  const { lang } = await searchParams;
  try {
    const [product, storeData] = await Promise.all([
      storefront.getProduct(storeSlug, productSlug) as Promise<any>,
      storefront.getStore(storeSlug) as Promise<any>,
    ]);
    const primaryLocale = storeData?.language_config?.primary_locale || 'en';
    const secondary: string[] = storeData?.language_config?.secondary_locales || [];
    const locale = lang || primaryLocale;
    const tr =
      product.translations?.find((t: any) => t.locale === locale) ||
      product.translations?.find((t: any) => t.locale === primaryLocale) ||
      product.translations?.[0];

    const storeOrigin = buildStoreOrigin(storeSlug, storeData?.custom_domain || null);
    const alternates = buildStoreAlternates({
      origin: storeOrigin,
      locale,
      primaryLocale,
      secondaryLocales: secondary,
      path: `/products/${productSlug}`,
    });

    const firstImage = product.images?.[0]?.url
      ? resolveMediaUrl(product.images[0].url)
      : undefined;

    return {
      title: tr?.meta_title || tr?.title || 'Product',
      description: tr?.meta_desc || tr?.description?.replace(/<[^>]+>/g, '').slice(0, 200),
      alternates,
      openGraph: {
        title: tr?.meta_title || tr?.title || undefined,
        description: tr?.meta_desc || undefined,
        images: firstImage ? [firstImage] : undefined,
        type: 'website',
      },
    };
  } catch {
    return {};
  }
}

export default async function StoreProductDetailPage({ params, searchParams }: ProductDetailProps) {
  const { storeSlug, slug: productSlug } = await params;
  const { lang } = await searchParams;
  const t = await getTranslations();
  const locale = lang || 'en';
  const lp = lang ? `/${lang}` : '';

  let product: any;
  let storeData: any;
  let storeCurrency = 'EUR';
  let template: { snapshot?: { sections?: SectionInstance[] } } | null = null;
  try {
    [product, storeData, template] = await Promise.all([
      storefront.getProduct(storeSlug, productSlug, locale),
      storefront.getStore(storeSlug),
      storefront.getPublishedProductTemplate(storeSlug).catch(() => null) as Promise<{
        snapshot?: { sections?: SectionInstance[] };
      } | null>,
    ]);
    storeCurrency = storeData?.currency || 'EUR';
  } catch {
    notFound();
  }

  // If the creator has published a PRODUCT_TEMPLATE, render the page through
  // the active theme using its sections + this product as the magic context.
  // The default layout below stays as the fallback for stores without one.
  const templateSections = template?.snapshot?.sections;
  if (templateSections && templateSections.length > 0) {
    const theme = resolveTheme(storeData?.theme_key);
    const primaryLocale = storeData?.language_config?.primary_locale || 'en';
    const tr =
      product.translations?.find((t: any) => t.locale === locale) ||
      product.translations?.find((t: any) => t.locale === primaryLocale) ||
      product.translations?.[0];
    const tplStoreBase = buildStoreOrigin(storeSlug, storeData?.custom_domain || null);
    const tplProductUrl = `${tplStoreBase}/products/${productSlug}`;
    const tplProductLd = buildProduct({
      name: tr?.title || 'Product',
      description: tr?.description?.replace(/<[^>]+>/g, '') || undefined,
      url: tplProductUrl,
      images: (product.images || [])
        .map((img: any) => (img.url ? resolveMediaUrl(img.url) : ''))
        .filter((u: string) => !!u),
      price: Number(product.base_price),
      priceCurrency: storeCurrency,
      availability: product.variants?.some((v: any) => (v.stock ?? 1) > 0) === false
        ? 'OutOfStock'
        : 'InStock',
    });
    return (
      <div dir={locale === 'ar' ? 'rtl' : 'ltr'}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: ldJsonSafe(tplProductLd) }}
        />
        <SectionRenderer
          theme={theme}
          sections={templateSections}
          locale={locale}
          primaryLocale={primaryLocale}
          storeSlug={storeSlug}
          product={product as ProductContext}
          currency={storeCurrency}
        />
      </div>
    );
  }

  const translation =
    product.translations?.find((tr: any) => tr.locale === locale) ||
    product.translations?.find((tr: any) => tr.locale === 'en') ||
    product.translations?.[0];

  // JSON-LD: Product + BreadcrumbList. Built from data already in scope so it
  // costs nothing extra to render. URLs use the locale path-prefix form (no
  // prefix for primary locale, `/{locale}/...` for others).
  const storeBase = buildStoreOrigin(storeSlug, storeData?.custom_domain || null);
  const ldPrimary = storeData?.language_config?.primary_locale || 'en';
  const productUrl = storeLocalePath(storeBase, locale, ldPrimary, `/products/${productSlug}`);
  const productImages = (product.images || [])
    .map((img: any) => (img.url ? resolveMediaUrl(img.url) : ''))
    .filter((u: string) => !!u);
  const productLd = buildProduct({
    name: translation?.title || 'Product',
    description: translation?.description?.replace(/<[^>]+>/g, '') || undefined,
    url: productUrl,
    images: productImages,
    price: Number(product.base_price),
    priceCurrency: storeCurrency,
    availability: product.variants?.some((v: any) => (v.stock ?? 1) > 0) === false
      ? 'OutOfStock'
      : 'InStock',
  });

  const primaryCollection = product.creator_categories?.[0];
  const collectionTranslation = primaryCollection
    ? primaryCollection.translations?.find((ct: any) => ct.locale === locale) ||
      primaryCollection.translations?.find((ct: any) => ct.locale === 'en') ||
      primaryCollection.translations?.[0]
    : undefined;

  const breadcrumbLd = buildBreadcrumb([
    { name: t('common.home'), url: storeLocalePath(storeBase, locale, ldPrimary, '') },
    { name: t('common.products'), url: storeLocalePath(storeBase, locale, ldPrimary, '/products') },
    ...(primaryCollection && collectionTranslation
      ? [{
          name: collectionTranslation.name || primaryCollection.slug,
          url: storeLocalePath(storeBase, locale, ldPrimary, `/collections/${primaryCollection.slug}`),
        }]
      : []),
    { name: translation?.title || 'Product', url: productUrl },
  ]);

  return (
    <div className="container mx-auto px-4 py-6 lg:py-10" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: ldJsonSafe(productLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: ldJsonSafe(breadcrumbLd) }}
      />
      {/* Breadcrumb */}
      <nav className="mb-6 lg:mb-8 flex items-center flex-wrap gap-1 text-sm" aria-label="Breadcrumb">
        <Link href={`${lp}/`} className="text-gray-400 hover:text-gray-700 transition-colors">
          {t('common.home')}
        </Link>
        <ChevronRight className="w-3.5 h-3.5 text-gray-300 shrink-0" />
        <Link href={`${lp}/products`} className="text-gray-400 hover:text-gray-700 transition-colors">
          {t('common.products')}
        </Link>
        {primaryCollection && (
          <>
            <ChevronRight className="w-3.5 h-3.5 text-gray-300 shrink-0" />
            <Link
              href={`${lp}/collections/${primaryCollection.slug}`}
              className="text-gray-400 hover:text-gray-700 transition-colors"
            >
              {collectionTranslation?.name || primaryCollection.slug}
            </Link>
          </>
        )}
        <ChevronRight className="w-3.5 h-3.5 text-gray-300 shrink-0" />
        <span className="text-gray-700 font-medium truncate max-w-50">
          {translation?.title || 'Product'}
        </span>
      </nav>

      <ProductDetailClient
        product={product}
        locale={locale}
        currency={storeCurrency}
        langPrefix={lp}
      />
    </div>
  );
}

// Cached via store-tagged reads (see lib/api.ts); a newly published
// PRODUCT_TEMPLATE or product edit refreshes on-demand through /api/revalidate.