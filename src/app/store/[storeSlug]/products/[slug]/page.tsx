import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, permanentRedirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { storefront, resolveMediaUrl } from '@/lib/api';
import { isDefinitiveNotFound, StoreUnavailableError } from '@/lib/apiAvailability';
import { buildStoreOrigin, storeLocalePath, buildStoreAlternates } from '@/lib/storeUrl';
import type { MarketRoute } from '@/lib/market';
import { getRequestMarket, getRequestNoindex } from '@/lib/market.server';
import { focusedProductLayoutSupports, focusedProductSections } from '@/lib/focusedStorefront';
import { requestFocusedStorefront } from '@/lib/focusedStorefront.server';
import { MarketPathsRegistrar } from '@/hooks/useMarket';
import { ProductDetailClient, type ProductData } from '@/components/product/ProductDetailClient';
import { ProductPreviewBanner } from '@/components/layout/ProductPreview';
import { FocusedBackCapture } from '@/components/layout/FocusedBackCapture';
import { FocusedProductLayout } from '@/components/product/focused/FocusedProductLayout';
import { sellerDetailsOf, type TraderDetails } from '@/lib/traderDetails';
import { DesignerSessionProvider } from '@/components/designer/DesignerSession';
import { ProductPageStateProvider } from '@/components/product/state/ProductPageState';
import { resolveTheme } from '@/themes/registry';
import { SectionRenderer } from '@/themes/SectionRenderer';
import { storeMotionOf } from '@/themes/creative/creativeAttrs';
import { surface, type MotionProp } from '@/themes/creative/recipes';
import { ProductBlocksWarmup } from '@/themes/minimal/sections/product/blocks/ProductBlocksWarmup';
import { ProductPageMagicWarmup } from '@/themes/minimal/sections/product/ProductPageMagicWarmup';
import { usesProductBlocks, usesProductPageMagic } from '@/themes/minimal/sections/product/blocks/productBlockKeys';
import { preloadSectionData } from '@/lib/preloadSections';
import { readProductCard } from '@/lib/productCard/settings';
import type { ProductContext, SectionInstance } from '@/themes/types';
import { productAvailability } from '@/lib/productAvailability';
import { projectProductForClient } from '@/lib/productPayload';
import { buildBreadcrumb, buildProduct, buildFaqPage, buildTwitterMeta, ldJsonSafe } from '@/lib/jsonld';
import { buildVideoObjectsJsonLd, type StorefrontProductVideo } from '@/lib/productVideo';
import { collectionDisplayName, collectionHref, collectionPathInChain, resolvePrimaryCollectionPath } from '@/lib/collectionPath';
import { canonicalRedirectHref, encodeUrlPath, isNonCanonicalSlugForm, routeSlug, slugsEqual } from '@/lib/slugRoute';

interface ProductDetailProps {
  params: Promise<{ storeSlug: string; slug: string }>;
  searchParams: Promise<{ lang?: string; [key: string]: string | string[] | undefined }>;
}

// The storefront product payload: everything ProductDetailClient renders plus
// the SEO-only fields (meta title/description, sku) this route reads itself.
type ProductRecord = Omit<ProductData, 'translations'> & {
  sku?: string | null;
  translations: Array<ProductData['translations'][number] & { meta_title?: string; meta_desc?: string }>;
};

// The slice of the storefront store payload this route reads.
interface StoreRecord {
  name?: string;
  currency?: string;
  custom_domain?: string | null;
  theme_key?: string;
  language_config?: { primary_locale?: string; secondary_locales?: string[] } | null;
  /** Markets app only (M1-DESIGN §3.3): absent for other stores. */
  market?: MarketRoute | null;
  markets?: MarketRoute[];
  /** Checkout behaviour overrides: absent for stores on the defaults. */
  checkout?: unknown;
  /** Seller identity (focused product page: the phone under the price). */
  seller_details?: TraderDetails | null;
  trader_details?: TraderDetails | null;
}

// Translated product slugs per locale — hreflang alternates point at the
// translated URL only when a market context exists (D9 / L12).
function productPathByLocale(product: Pick<ProductRecord, 'translations'>): Record<string, string> {
  const paths: Record<string, string> = {};
  for (const tr of product.translations ?? []) {
    if (tr.locale && tr.slug) paths[tr.locale] = `/products/${tr.slug}`;
  }
  return paths;
}

/**
 * Stored slug of the translation the request matched (any locale), or the
 * normalized request slug when none matches (payload filtered by locale).
 * Canonical / JSON-LD URLs use it, so they never echo a mis-cased request.
 */
function matchedProductSlug(product: Pick<ProductRecord, 'translations'>, requested: string): string {
  return product.translations?.find((tr) => tr.slug && slugsEqual(tr.slug, requested))?.slug ?? requested;
}

/**
 * FAQPage markup for a product, picking each entry's translation for the
 * rendered locale. Answers are rich text, so tags are stripped — schema.org
 * expects plain text and Google rejects markup here.
 */
function buildFaqPageFromProduct(product: Pick<ProductRecord, 'faqs'> | null | undefined, locale: string, primaryLocale: string) {
  const faqs = product?.faqs;
  if (!Array.isArray(faqs) || faqs.length === 0) return null;

  const items = faqs
    .map((faq) => {
      const t =
        faq.translations?.find((x) => x.locale === locale) ||
        faq.translations?.find((x) => x.locale === primaryLocale) ||
        faq.translations?.[0];
      const question = t?.question?.trim();
      const answer = t?.answer?.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      return question && answer ? { question, answer } : null;
    })
    .filter((x: unknown): x is { question: string; answer: string } => x !== null);

  return buildFaqPage(items);
}

/**
 * Product video: VideoObject entries for the Product JSON-LD `subjectOf`
 * (only videos with a poster; contract 6.5). Undefined for a product without
 * video, so its JSON-LD stays exactly as before. Media URLs are absolute like
 * the product's `image` list (resolveMediaUrl).
 */
function productVideosLd(
  product: { videos?: StorefrontProductVideo[] },
  name: string,
  shortDescriptionHtml: string | null | undefined,
) {
  if (!product.videos?.length) return undefined;
  const description = shortDescriptionHtml?.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() || null;
  const list = buildVideoObjectsJsonLd({
    videos: product.videos,
    productName: name,
    description,
    toAbsoluteUrl: (url) => resolveMediaUrl(url),
  });
  return list.length ? list : undefined;
}

// Per-product metadata: title/description from translations, canonical, hreflang
// for every store locale, and Open Graph with the first product image.
export async function generateMetadata({
  params,
  searchParams,
}: ProductDetailProps): Promise<Metadata> {
  const { storeSlug, slug: rawSlug } = await params;
  // Next hands the param percent-encoded; the API gets the decoded lookup form.
  const productSlug = routeSlug(rawSlug);
  const { lang } = await searchParams;
  try {
    const marketKey = await getRequestMarket();
    const [product, storeData] = await Promise.all([
      storefront.getProduct(storeSlug, productSlug, undefined, marketKey) as Promise<ProductRecord>,
      storefront.getStore(storeSlug, marketKey) as Promise<StoreRecord | null>,
    ]);
    const primaryLocale = storeData?.language_config?.primary_locale || 'en';
    const secondary: string[] = storeData?.language_config?.secondary_locales || [];
    const locale = lang || primaryLocale;
    const tr =
      product.translations?.find((t) => t.locale === locale) ||
      product.translations?.find((t) => t.locale === primaryLocale) ||
      product.translations?.[0];

    const storeOrigin = buildStoreOrigin(storeSlug, storeData?.custom_domain || null, storeData?.market);
    const alternates = buildStoreAlternates({
      origin: storeOrigin,
      locale,
      primaryLocale,
      secondaryLocales: secondary,
      path: `/products/${matchedProductSlug(product, productSlug)}`,
      markets: storeData?.markets,
      market: storeData?.market,
      noindex: await getRequestNoindex(),
      storeCustomDomain: storeData?.custom_domain ?? null,
      storeSlug,
      pathByLocale: storeData?.market ? productPathByLocale(product) : null,
    });

    const firstImage = product.images?.[0]?.url
      ? resolveMediaUrl(product.images[0].url)
      : undefined;

    return {
      title: tr?.meta_title || tr?.title || 'Product',
      description: tr?.meta_desc || tr?.description?.replace(/<[^>]+>/g, '').slice(0, 200),
      alternates,
      // Owner preview of a DRAFT product: served to the owner only, never
      // indexable (the public answer is a 404).
      ...(product.status === 'DRAFT' ? { robots: { index: false, follow: false } } : {}),
      openGraph: {
        title: tr?.meta_title || tr?.title || undefined,
        description: tr?.meta_desc || undefined,
        images: firstImage ? [firstImage] : undefined,
        type: 'website',
      },
      twitter: buildTwitterMeta({
        title: tr?.meta_title || tr?.title || undefined,
        description: tr?.meta_desc || undefined,
        image: firstImage,
      }),
    };
  } catch {
    return {};
  }
}

export default async function StoreProductDetailPage({ params, searchParams }: ProductDetailProps) {
  const { storeSlug, slug: rawSlug } = await params;
  // Next hands the param percent-encoded; the API gets the decoded lookup form.
  const productSlug = routeSlug(rawSlug);
  const query = await searchParams;
  const { lang } = query;
  const t = await getTranslations();
  const lp = lang ? `/${lang}` : '';

  let product: ProductRecord;
  let storeData: StoreRecord | null;
  let storeCurrency = 'EUR';
  let template: { snapshot?: { sections?: SectionInstance[] } } | null = null;
  // Without a locale prefix in the URL the content is rendered in the store's
  // primary locale, not in English — so the store is read first (it is cached).
  let locale = lang || 'en';
  const marketKey = await getRequestMarket();
  try {
    storeData = (await storefront.getStore(storeSlug, marketKey)) as StoreRecord | null;
    locale = lang || storeData?.language_config?.primary_locale || 'en';
    [product, template] = await Promise.all([
      storefront.getProduct(storeSlug, productSlug, locale, marketKey) as Promise<ProductRecord>,
      storefront.getPublishedProductTemplate(storeSlug).catch(() => null) as Promise<{
        snapshot?: { sections?: SectionInstance[] };
      } | null>,
    ]);
    storeCurrency = storeData?.currency || 'EUR';
  } catch (err) {
    // A deleted or unpublished product is a real 404; an API failure is not.
    if (isDefinitiveNotFound(err)) notFound();
    throw new StoreUnavailableError();
  }

  // Owner preview of a DRAFT product (served with the owner token of the
  // preview cookie only; everyone else got the 404 above): a sticky banner
  // on top, add-to-cart disabled by the client components via `status`.
  const draftPreview = product.status === 'DRAFT';

  // Same product requested in another letter case or Unicode form: one
  // permanent hop to the stored slug (WordPress canonical redirect). The
  // stored slug is the fixed point, so this cannot loop.
  // Only when a stored translation slug matched (never towards a guessed form).
  const canonicalSlug = matchedProductSlug(product, productSlug);
  const storedMatch = product.translations?.some((tr) => tr.slug === canonicalSlug);
  if (storedMatch && isNonCanonicalSlugForm(rawSlug, canonicalSlug)) {
    permanentRedirect(canonicalRedirectHref(`/products/${canonicalSlug}`, query));
  }

  // If the creator has published a PRODUCT_TEMPLATE, render the page through
  // the active theme using its sections + this product as the magic context.
  // The default layout below stays as the fallback for stores without one.
  // Focused storefront (src/lib/focusedStorefront.ts): the page keeps its
  // content but loses every path into a listing: no breadcrumb (visible or
  // JSON-LD) and no product listing sections of the template. Null for every
  // other store.
  const focus = await requestFocusedStorefront(storeData?.checkout);

  // Focused storefront: the product page is step 1 of a purchase that began
  // on the external site. It is presented by FocusedProductLayout (same
  // product state, fields and add-to-cart as below, another presentation)
  // whatever the store uses otherwise (the built-in page or a published
  // PRODUCT_TEMPLATE). Products that layout does not cover (designer
  // products, custom products) fall through to the regular rendering.
  if (focus && focusedProductLayoutSupports(product)) {
    const primaryLocale = storeData?.language_config?.primary_locale || 'en';
    const tr =
      product.translations?.find((x) => x.locale === locale) ||
      product.translations?.find((x) => x.locale === primaryLocale) ||
      product.translations?.[0];
    const focusedBase = buildStoreOrigin(storeSlug, storeData?.custom_domain || null, storeData?.market);
    // Same Product / FAQPage markup as the regular page; no breadcrumb (its
    // crumbs lead to pages that redirect to the external site).
    const focusedProductLd = buildProduct({
      name: tr?.title || 'Product',
      description: tr?.description?.replace(/<[^>]+>/g, '') || undefined,
      url: storeLocalePath(focusedBase, locale, primaryLocale, `/products/${canonicalSlug}`),
      sku: product.sku || undefined,
      brand: storeData?.name || undefined,
      images: (product.images || [])
        .map((img) => (img.url ? resolveMediaUrl(img.url) : ''))
        .filter((u: string) => !!u),
      price: Number(product.base_price),
      priceCurrency: storeCurrency,
      availability: productAvailability(product),
      videos: productVideosLd(product, tr?.title || 'Product', tr?.short_description),
    });
    const focusedFaqLd = buildFaqPageFromProduct(product, locale, primaryLocale);
    return (
      <div dir={locale === 'ar' ? 'rtl' : 'ltr'}>
        {draftPreview && <ProductPreviewBanner storeSlug={storeSlug} />}
        {/* Markets app: translated slugs for the country switcher / banner. */}
        {storeData?.market && <MarketPathsRegistrar pathByLocale={productPathByLocale(product)} />}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJsonSafe(focusedProductLd) }} />
        {focusedFaqLd && (
          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJsonSafe(focusedFaqLd) }} />
        )}
        {/* `?back=<path>`: the site page the buyer came from (tab memory). */}
        <FocusedBackCapture />
        <DesignerSessionProvider designer={product.designer} productId={product.id} locale={locale}>
          <ProductPageStateProvider
            product={projectProductForClient(product, locale, primaryLocale) as unknown as ProductData}
            locale={locale}
            primaryLocale={primaryLocale}
            currency={storeCurrency}
          >
            <FocusedProductLayout
              storeSlug={storeSlug}
              sellerPhone={sellerDetailsOf(storeData)?.phone ?? null}
              {...(storeMotionOf(storeData) ? { motion: 'scroll' as const } : null)}
            />
          </ProductPageStateProvider>
        </DesignerSessionProvider>
      </div>
    );
  }

  const publishedSections = template?.snapshot?.sections;
  const templateSections =
    focus && publishedSections ? focusedProductSections(publishedSections) : publishedSections;
  if (templateSections && templateSections.length > 0) {
    const theme = resolveTheme(storeData?.theme_key);
    // M6.4: collection-products sections render their list from the server.
    const preloaded = await preloadSectionData(storeSlug, templateSections, {
      locale,
      marketRef: marketKey,
      // Product rows of the template carry the card fields when the store has card settings.
      card: readProductCard((storeData as { theme_customizations?: unknown } | null | undefined)?.theme_customizations),
    });
    const primaryLocale = storeData?.language_config?.primary_locale || 'en';
    const tr =
      product.translations?.find((t) => t.locale === locale) ||
      product.translations?.find((t) => t.locale === primaryLocale) ||
      product.translations?.[0];
    const tplStoreBase = buildStoreOrigin(storeSlug, storeData?.custom_domain || null, storeData?.market);
    const tplProductUrl = `${tplStoreBase}${encodeUrlPath(`/products/${canonicalSlug}`)}`;
    const tplProductLd = buildProduct({
      name: tr?.title || 'Product',
      description: tr?.description?.replace(/<[^>]+>/g, '') || undefined,
      url: tplProductUrl,
      // The shop is the brand for a creator's own product; sku was already in
      // the payload and simply never passed through.
      sku: product.sku || undefined,
      brand: storeData?.name || undefined,
      images: (product.images || [])
        .map((img) => (img.url ? resolveMediaUrl(img.url) : ''))
        .filter((u: string) => !!u),
      price: Number(product.base_price),
      priceCurrency: storeCurrency,
      // Simple products count too (was: always OutOfStock without variants).
      availability: productAvailability(product),
      videos: productVideosLd(product, tr?.title || 'Product', tr?.short_description),
    });
    const tplFaqLd = buildFaqPageFromProduct(product, locale, primaryLocale);
    // Client sections get a slim copy (current-locale rows only); JSON-LD
    // above keeps the full product.
    const clientProduct = projectProductForClient(product, locale, primaryLocale);
    // Same trail as the visible breadcrumb of the product-page section:
    // Home › ancestors… › primary › product (Home › Products › product
    // without a primary collection).
    const tplChain = resolvePrimaryCollectionPath(product);
    const tplBreadcrumbLd = buildBreadcrumb([
      { name: t('common.home'), url: storeLocalePath(tplStoreBase, locale, primaryLocale, '') },
      ...(tplChain.length > 0
        ? tplChain.map((node, i) => ({
            name: collectionDisplayName(node, locale),
            url: storeLocalePath(
              tplStoreBase,
              locale,
              primaryLocale,
              collectionHref({ path: collectionPathInChain(tplChain, i), slug: node.slug }),
            ),
          }))
        : [{ name: t('common.products'), url: storeLocalePath(tplStoreBase, locale, primaryLocale, '/products') }]),
      {
        name: tr?.title || 'Product',
        url: storeLocalePath(tplStoreBase, locale, primaryLocale, `/products/${canonicalSlug}`),
      },
    ]);
    return (
      <div dir={locale === 'ar' ? 'rtl' : 'ltr'}>
        {draftPreview && <ProductPreviewBanner storeSlug={storeSlug} />}
        {focus && <FocusedBackCapture />}
        {/* Markets app: translated slugs for the country switcher / banner. */}
        {storeData?.market && <MarketPathsRegistrar pathByLocale={productPathByLocale(product)} />}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: ldJsonSafe(tplProductLd) }}
        />
        {!focus && (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: ldJsonSafe(tplBreadcrumbLd) }}
          />
        )}
        {tplFaqLd && (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: ldJsonSafe(tplFaqLd) }}
          />
        )}
        {/* Start the product sections' code download before hydration
            reaches them, from page-level chunks (render nothing). */}
        {usesProductBlocks(templateSections) && <ProductBlocksWarmup />}
        {usesProductPageMagic(templateSections) && <ProductPageMagicWarmup />}
        {/* Designer app (M5.5): one design session for the whole template, so a
            theme that splits gallery (canvas) and add-to-cart (form) into
            separate sections still edits one draft. */}
        {/* Shared product page state: one selection, price chain and cart
            action for every product block of the template; the product-page
            section's ProductDetailClient reuses it for the same product. */}
        <DesignerSessionProvider designer={product.designer} productId={product.id} locale={locale}>
          <ProductPageStateProvider
            product={clientProduct as unknown as ProductData}
            locale={locale}
            primaryLocale={primaryLocale}
            currency={storeCurrency}
          >
            <SectionRenderer
              theme={theme}
              sections={templateSections}
              locale={locale}
              primaryLocale={primaryLocale}
              storeSlug={storeSlug}
              motion={storeMotionOf(storeData)}
              product={clientProduct as ProductContext}
              currency={storeCurrency}
              preloaded={preloaded}
            />
          </ProductPageStateProvider>
        </DesignerSessionProvider>
      </div>
    );
  }

  const translation =
    product.translations?.find((tr) => tr.locale === locale) ||
    product.translations?.find((tr) => tr.locale === 'en') ||
    product.translations?.[0];

  // JSON-LD: Product + BreadcrumbList. Built from data already in scope so it
  // costs nothing extra to render. URLs use the locale path-prefix form (no
  // prefix for primary locale, `/{locale}/...` for others).
  const storeBase = buildStoreOrigin(storeSlug, storeData?.custom_domain || null, storeData?.market);
  const ldPrimary = storeData?.language_config?.primary_locale || 'en';
  const productUrl = storeLocalePath(storeBase, locale, ldPrimary, `/products/${canonicalSlug}`);
  const productImages = (product.images || [])
    .map((img) => (img.url ? resolveMediaUrl(img.url) : ''))
    .filter((u: string) => !!u);
  const productLd = buildProduct({
    name: translation?.title || 'Product',
    description: translation?.description?.replace(/<[^>]+>/g, '') || undefined,
    url: productUrl,
    sku: product.sku || undefined,
    brand: storeData?.name || undefined,
    images: productImages,
    price: Number(product.base_price),
    priceCurrency: storeCurrency,
    // Simple products count too (was: always OutOfStock without variants).
    availability: productAvailability(product),
    videos: productVideosLd(product, translation?.title || 'Product', translation?.short_description),
  });

  // Home › ancestors… › primary › product (M6 §2; no "Collections" index
  // crumb, so the trail stays short on mobile). The path comes from the API
  // (`primary_collection_path`, root → leaf); products without a primary
  // collection fall back to Home › Products › product.
  // Each crumb links to its hierarchical URL (M6.7): the node's `path`, or
  // the chain prefix for payloads without it.
  const primaryChain = resolvePrimaryCollectionPath(product);
  const collectionCrumbs = primaryChain.map((node, i) => ({
    slug: node.slug,
    name: collectionDisplayName(node, locale),
    href: collectionHref({ path: collectionPathInChain(primaryChain, i), slug: node.slug }),
  }));
  // Separator points along the reading direction (RTL for Arabic).
  const Crumb = locale === 'ar' ? ChevronLeft : ChevronRight;

  const breadcrumbLd = buildBreadcrumb([
    { name: t('common.home'), url: storeLocalePath(storeBase, locale, ldPrimary, '') },
    ...(collectionCrumbs.length > 0
      ? [
          ...collectionCrumbs.map((c) => ({
            name: c.name,
            url: storeLocalePath(storeBase, locale, ldPrimary, c.href),
          })),
        ]
      : [{ name: t('common.products'), url: storeLocalePath(storeBase, locale, ldPrimary, '/products') }]),
    { name: translation?.title || 'Product', url: productUrl },
  ]);

  // The product's own FAQ, already rendered as a tab below. Marking it up lets
  // Google show the questions under the search result — the builder existed but
  // had never been called from anywhere.
  const faqLd = buildFaqPageFromProduct(product, locale, ldPrimary);

  // Store motion style on the built-in product page (no PRODUCT_TEMPLATE):
  // one fast surface of the motion engine. Undefined without the switch, so
  // the page keeps exactly its markup.
  const motion: MotionProp = storeMotionOf(storeData) ? 'scroll' : undefined;

  return (
    <div className="container mx-auto px-4 py-6 lg:py-10" dir={locale === 'ar' ? 'rtl' : 'ltr'} {...surface(motion, 'product', true)}>
      {draftPreview && <ProductPreviewBanner storeSlug={storeSlug} />}
      {focus && <FocusedBackCapture />}
      {/* Markets app: translated slugs for the country switcher / banner. */}
      {storeData?.market && <MarketPathsRegistrar pathByLocale={productPathByLocale(product)} />}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: ldJsonSafe(productLd) }}
      />
      {!focus && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: ldJsonSafe(breadcrumbLd) }}
        />
      )}
      {faqLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: ldJsonSafe(faqLd) }}
        />
      )}
      {/* Breadcrumb (not in a focused storefront: its crumbs lead to pages
          that redirect to the external site). */}
      {!focus && (
      <nav className="mb-6 lg:mb-8 flex items-center flex-wrap gap-1 text-sm" aria-label="Breadcrumb">
        <Link href={`${lp}/`} className="text-gray-400 hover:text-gray-700 transition-colors">
          {t('common.home')}
        </Link>
        {collectionCrumbs.length > 0 ? (
          <>
            {collectionCrumbs.map((c) => (
              <span key={c.slug} className="contents">
                <Crumb className="w-3.5 h-3.5 text-gray-300 shrink-0" />
                <Link
                  href={`${lp}${c.href}`}
                  className="text-gray-400 hover:text-gray-700 transition-colors"
                >
                  {c.name}
                </Link>
              </span>
            ))}
          </>
        ) : (
          <>
            <Crumb className="w-3.5 h-3.5 text-gray-300 shrink-0" />
            <Link href={`${lp}/products`} className="text-gray-400 hover:text-gray-700 transition-colors">
              {t('common.products')}
            </Link>
          </>
        )}
        <Crumb className="w-3.5 h-3.5 text-gray-300 shrink-0" />
        <span className="text-gray-700 font-medium truncate max-w-50">
          {translation?.title || 'Product'}
        </span>
      </nav>
      )}

      <ProductDetailClient
        product={projectProductForClient(product, locale, ldPrimary)}
        locale={locale}
        primaryLocale={ldPrimary}
        currency={storeCurrency}
        langPrefix={lp}
        {...(motion ? { motion } : null)}
      />
    </div>
  );
}

// Cached via store-tagged reads (see lib/api.ts); a newly published
// PRODUCT_TEMPLATE or product edit refreshes on-demand through /api/revalidate.
// The owner's DRAFT product preview is read with `cache: 'no-store'` (preview
// cookie token, `productReadOpts`), so a draft render never enters the data
// cache; the route itself is dynamic (cookies are read), never statically cached.