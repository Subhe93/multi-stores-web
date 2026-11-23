import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, permanentRedirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { storefront, resolveMediaUrl, getProductPreviewToken } from '@/lib/api';
import { isDefinitiveNotFound, StoreUnavailableError } from '@/lib/apiAvailability';
import { buildStoreOrigin, storeLocalePath } from '@/lib/storeUrl';
import { productAlternates, productLinkFallbackLocale, productPathByLocale } from '@/lib/productPaths';
import { buildProductJsonLd, shippingRateCountries, type ProductShippingRates } from '@/lib/productJsonLd';
import { organizationId, storeBrandName } from '@/lib/storeBrand';
import { buildStoreOpenGraph, ogFallbackImage, requestCountry } from '@/lib/storeOpenGraph';
import { metaDescriptionFallback } from '@/lib/pageExcerpt';
import type { MarketRoute } from '@/lib/market';
import { getRequestMarket, getRequestNoindex, getRequestPathPrefix } from '@/lib/market.server';
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
import { productLinkRewriter } from '@/lib/productLinkCanonical.server';
import { preloadSectionData } from '@/lib/preloadSections';
import { readProductCard } from '@/lib/productCard/settings';
import type { ProductContext, SectionInstance } from '@/themes/types';
import { projectProductForClient } from '@/lib/productPayload';
import { buildBreadcrumb, buildFaqPage, buildTwitterMeta, ldJsonSafe } from '@/lib/jsonld';
import { buildVideoObjectsJsonLd, type StorefrontProductVideo } from '@/lib/productVideo';
import { collectionDisplayName, collectionHref, collectionPathInChain, resolvePrimaryCollectionPath } from '@/lib/collectionPath';
import { canonicalRedirectHref, routeSlug } from '@/lib/slugRoute';
import { matchedProductSlug, productRedirectSlug } from '@/lib/productRedirect';
import { isReviewLocale } from '@/lib/storeLocales';
import { pageLinkPrefix } from '@/lib/localePaths';

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
  /** Relative upload path; the Open Graph image fallback (M161 C). */
  logo_url?: string | null;
  /** `theme.seo.brandName`: optional brand override (M161 B3). */
  theme?: { seo?: { brandName?: unknown } | null } | null;
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
    const locale = lang || primaryLocale;
    const tr =
      product.translations?.find((t) => t.locale === locale) ||
      product.translations?.find((t) => t.locale === primaryLocale) ||
      product.translations?.[0];

    const pathPrefix = await getRequestPathPrefix();
    // Same helper as the page body's JSON-LD and the sitemap (M161 A/B1).
    const alternates = productAlternates({
      storeSlug,
      store: storeData,
      translations: product.translations,
      slug: matchedProductSlug(product, productSlug),
      locale,
      pathPrefix,
      noindex: await getRequestNoindex(),
    });

    const firstImage = product.images?.[0]?.url
      ? resolveMediaUrl(product.images[0].url)
      : undefined;
    // An author-written meta_desc is used as is; the fallback is clipped at
    // a word boundary (M161 D).
    const description = tr?.meta_desc || metaDescriptionFallback(tr?.description);
    const openGraph = buildStoreOpenGraph({
      title: tr?.meta_title || tr?.title || undefined,
      description,
      url: alternates.canonical,
      image: firstImage,
      fallbackImage: ogFallbackImage(storeData, resolveMediaUrl),
      locale,
      country: requestCountry(storeData?.market, pathPrefix),
    });

    return {
      title: tr?.meta_title || tr?.title || 'Product',
      description,
      alternates,
      // Owner preview of a DRAFT product: served to the owner only, never
      // indexable (the public answer is a 404).
      ...(product.status === 'DRAFT' ? { robots: { index: false, follow: false } } : {}),
      openGraph,
      twitter: buildTwitterMeta({
        title: tr?.meta_title || tr?.title || undefined,
        description,
        image: openGraph.images?.[0],
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
  // Link prefix: the proxy's path prefix on a locale-path market (M156),
  // else the URL's own locale folder.
  const pathPrefix = await getRequestPathPrefix();
  const lp = pageLinkPrefix(pathPrefix, lang);

  let product: ProductRecord;
  let storeData: StoreRecord | null;
  let storeCurrency = 'EUR';
  let template: { snapshot?: { sections?: SectionInstance[] } } | null = null;
  // M161 B6: JSON-LD shippingDetails; null (no rates) on any failure.
  let shippingRates: ProductShippingRates | null = null;
  // Without a locale prefix in the URL the content is rendered in the store's
  // primary locale, not in English — so the store is read first (it is cached).
  let locale = lang || 'en';
  const marketKey = await getRequestMarket();
  try {
    storeData = (await storefront.getStore(storeSlug, marketKey)) as StoreRecord | null;
    locale = lang || storeData?.language_config?.primary_locale || 'en';
    const shipCountries = shippingRateCountries(storeData?.market, pathPrefix, storeData?.trader_details?.country);
    [product, template, shippingRates] = await Promise.all([
      storefront.getProduct(storeSlug, productSlug, locale, marketKey) as Promise<ProductRecord>,
      storefront.getPublishedProductTemplate(storeSlug).catch(() => null) as Promise<{
        snapshot?: { sections?: SectionInstance[] };
      } | null>,
      shipCountries.length > 0
        ? storefront.getProductShippingRates(storeSlug, productSlug, shipCountries, marketKey).catch(() => null)
        : Promise.resolve(null),
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

  // Focused storefront (src/lib/focusedStorefront.ts): null for every other store.
  const focus = await requestFocusedStorefront(storeData?.checkout);
  const requestNoindex = await getRequestNoindex();

  // Permanent hop to the canonical slug (M164): the same product requested
  // in another letter case / Unicode form (WordPress canonical redirect), or
  // on a market store with another locale's slug, goes to exactly the slug
  // of the canonical (productAlternates), query string and path prefix kept.
  // The target is a fixed point, so this cannot loop. Owner previews, market
  // previews, review locales and focused stores keep the case rule only.
  // Only when a stored translation slug matched (never towards a guess).
  const canonicalSlug = matchedProductSlug(product, productSlug);
  const previewing =
    draftPreview ||
    marketKey?.preview === true ||
    isReviewLocale(locale) ||
    Boolean(await getProductPreviewToken(storeSlug));
  const redirectSlug = productRedirectSlug({
    rawSlug,
    translations: product.translations,
    store: storeData,
    locale,
    allowLocaleRedirect: !previewing && !focus,
    noindex: requestNoindex,
  });
  if (redirectSlug) {
    permanentRedirect(canonicalRedirectHref(`/products/${redirectSlug}`, query, pathPrefix));
  }

  // One canonical for metadata, JSON-LD url / offers.url and the breadcrumb's
  // last item on every render path (M161 B1).
  const productCanonical = productAlternates({
    storeSlug,
    store: storeData,
    translations: product.translations,
    slug: canonicalSlug,
    locale,
    pathPrefix,
    noindex: requestNoindex,
  }).canonical;
  const ldOrigin = buildStoreOrigin(storeSlug, storeData?.custom_domain || null, storeData?.market);
  const ldImages = (product.images || [])
    .map((img) => (img.url ? resolveMediaUrl(img.url) : ''))
    .filter((u: string) => !!u);
  // Product / ProductGroup markup of the rendered translation (M161 B3-B6).
  const productJsonLd = (tr: ProductRecord['translations'][number] | undefined) =>
    buildProductJsonLd({
      product,
      name: tr?.title || 'Product',
      descriptionHtml: tr?.description,
      locale,
      canonical: productCanonical,
      images: ldImages,
      brand: storeBrandName(storeData) || undefined,
      sellerId: organizationId(ldOrigin),
      currency: storeCurrency,
      shipping: shippingRates,
      videos: productVideosLd(product, tr?.title || 'Product', tr?.short_description),
      resolveMedia: resolveMediaUrl,
    });

  // If the creator has published a PRODUCT_TEMPLATE, render the page through
  // the active theme using its sections + this product as the magic context.
  // The default layout below stays as the fallback for stores without one.
  // Focused storefront (`focus` above): the page keeps its content but loses
  // every path into a listing: no breadcrumb (visible or JSON-LD) and no
  // product listing sections of the template.

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
    // Same Product / FAQPage markup as the regular page; no breadcrumb (its
    // crumbs lead to pages that redirect to the external site).
    const focusedProductLd = productJsonLd(tr);
    const focusedFaqLd = buildFaqPageFromProduct(product, locale, primaryLocale);
    return (
      <div dir={locale === 'ar' ? 'rtl' : 'ltr'}>
        {draftPreview && <ProductPreviewBanner storeSlug={storeSlug} />}
        {/* Markets app: translated slugs for the country switcher / banner. */}
        {storeData?.market && <MarketPathsRegistrar pathByLocale={productPathByLocale(product.translations)} />}
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
  // M165 product references (every store, focused ones too) + M164
  // owner-typed product links (market stores only; focused storefronts keep
  // typed links as typed) -> canonical URL of this locale.
  const productLinks = await productLinkRewriter(storeSlug, storeData, locale);
  const templateSections =
    focus && publishedSections
      ? await productLinks.refs(focusedProductSections(publishedSections))
      : await productLinks.sections(publishedSections);
  if (templateSections && templateSections.length > 0) {
    const theme = resolveTheme(storeData?.theme_key);
    // M6.4: collection-products sections render their list from the server.
    const preloaded = await preloadSectionData(storeSlug, templateSections, {
      locale,
      refSlug: productLinks.refSlug,
      // Picked products link the canonical slug of this locale (M163).
      fallbackLocale: productLinkFallbackLocale(storeData?.language_config?.primary_locale, storeData?.market),
      marketRef: marketKey,
      // Product rows of the template carry the card fields when the store has card settings.
      card: readProductCard((storeData as { theme_customizations?: unknown } | null | undefined)?.theme_customizations),
    });
    const primaryLocale = storeData?.language_config?.primary_locale || 'en';
    const tr =
      product.translations?.find((t) => t.locale === locale) ||
      product.translations?.find((t) => t.locale === primaryLocale) ||
      product.translations?.[0];
    const tplStoreBase = ldOrigin;
    // The canonical (with the locale / path prefix), not the bare origin
    // path the template branch used to build (M161 B1).
    const tplProductLd = productJsonLd(tr);
    const tplFaqLd = buildFaqPageFromProduct(product, locale, primaryLocale);
    // Client sections get a slim copy (current-locale rows only); JSON-LD
    // above keeps the full product.
    const clientProduct = projectProductForClient(product, locale, primaryLocale);
    // Same trail as the visible breadcrumb of the product-page section:
    // Home › ancestors… › primary › product (Home › Products › product
    // without a primary collection).
    const tplChain = resolvePrimaryCollectionPath(product);
    const tplBreadcrumbLd = buildBreadcrumb([
      { name: t('common.home'), url: storeLocalePath(tplStoreBase, locale, primaryLocale, '', pathPrefix) },
      ...(tplChain.length > 0
        ? tplChain.map((node, i) => ({
            name: collectionDisplayName(node, locale),
            url: storeLocalePath(
              tplStoreBase,
              locale,
              primaryLocale,
              collectionHref({ path: collectionPathInChain(tplChain, i), slug: node.slug }),
              pathPrefix,
            ),
          }))
        : [{ name: t('common.products'), url: storeLocalePath(tplStoreBase, locale, primaryLocale, '/products', pathPrefix) }]),
      { name: tr?.title || 'Product', url: productCanonical },
    ]);
    return (
      <div dir={locale === 'ar' ? 'rtl' : 'ltr'}>
        {draftPreview && <ProductPreviewBanner storeSlug={storeSlug} />}
        {focus && <FocusedBackCapture />}
        {/* Markets app: translated slugs for the country switcher / banner. */}
        {storeData?.market && <MarketPathsRegistrar pathByLocale={productPathByLocale(product.translations)} />}
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
              pathPrefix={pathPrefix}
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
  const storeBase = ldOrigin;
  const ldPrimary = storeData?.language_config?.primary_locale || 'en';
  const productUrl = productCanonical;
  const productLd = productJsonLd(translation);

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
    { name: t('common.home'), url: storeLocalePath(storeBase, locale, ldPrimary, '', pathPrefix) },
    ...(collectionCrumbs.length > 0
      ? [
          ...collectionCrumbs.map((c) => ({
            name: c.name,
            url: storeLocalePath(storeBase, locale, ldPrimary, c.href, pathPrefix),
          })),
        ]
      : [{ name: t('common.products'), url: storeLocalePath(storeBase, locale, ldPrimary, '/products', pathPrefix) }]),
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
      {storeData?.market && <MarketPathsRegistrar pathByLocale={productPathByLocale(product.translations)} />}
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