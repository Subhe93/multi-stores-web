import type { CSSProperties, ReactNode } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { NextIntlClientProvider } from 'next-intl';
import { locales, type Locale } from '@/i18n/config';
import { StoreProviders } from '@/components/providers/StoreProviders';
import { DesignerSessionProvider } from '@/components/designer/DesignerSession';
import { ProductPageStateProvider } from '@/components/product/state/ProductPageState';
import type { ProductData } from '@/components/product/ProductDetailClient';
import { buildGoogleFontsHref, selfHostedFontsHref } from '@/lib/storeFonts';
import { cssSafe } from '@/lib/storeTypography';
import { toListingProduct, type StorefrontProductRow } from '@/lib/listing';
import { withCardExtras, type CardSourceRow } from '@/lib/productCard/model';
import { resolveProductCard } from '@/lib/productCard/settings';
import { projectProductForClient } from '@/lib/productPayload';
import { normalizeStoreTax } from '@/lib/tax';
import { SectionRenderer } from '@/themes/SectionRenderer';
import { minimalTheme } from '@/themes/minimal/theme';
import {
  arabicBodyCss,
  mergeTokens,
  motionAttrs,
  storePrimaryContrast,
  themeButtonCss,
  tokenArabicFonts,
  tokenFonts,
  tokensToCssVars,
} from '@/themes/tokens';
import type { ListingContext, ProductContext, SectionInstance, StoreContext, ThemeCustomizations } from '@/themes/types';
import { CreativeBoot } from '@/themes/creative/boot.client';
import { creativeAttrs, readCreative } from '@/themes/creative/creativeAttrs';
import { creativeDemoEnabled } from '@/themes/creative/demo/demoGate';
import { loadFixture, toInstances } from '@/themes/creative/demo/fixture';
import {
  PICKED_SECTION_KEYS,
  pickedSlugs,
  rowHasSlug,
  toPickedProduct,
  type PickedProduct,
  type PickedSourceRow,
} from '@/themes/creative/data/pickedProducts';
import { StoreMotionAssets } from '@/themes/creative/primitives/StoreMotionAssets';
import { resolveListingSettings } from '@/lib/listingFilters/settings';
import { parseFilterState } from '@/lib/listingFilters/query';
import { localPage, type LocalRow, type LocalSource } from '@/lib/listingFilters/local';
import { EXPLORER_PAGE_SIZE } from '@/lib/listingFilters/explorer';

// Demo page of the store motion style: a store home replayed outside any
// store (header, home sections, footer), plus a story page, a product
// listing and a product page. Development only (or CREATIVE_DEMO=1), never
// linked, never indexed. The content comes from an external JSON file
// (themes/creative/demo/fixture.ts) or, without one, neutral placeholders.
//
// Query:
//   view=home|story|listing|product   (default home)
//   locale=en|ar|tr|de|fr|sv          (ar is right-to-left)
//   dir=ltr|rtl                       (overrides the direction of the locale)
//   style=off                         (store switch off: the platform as it is today)
//   motion=calm|off                   (store motion profile)
//   curtain=1                         (page transition curtain)
//   progress=1                        (scroll progress bar)
//   cursor=1                          (cursor dot)
//   builder=1                         (builder preview state: static)
//   card=classic|editorial            (enhanced product card with every feature on; absent = the card as it is today)
//   filters=bar|rail                  (filtered listing, view=listing: filters, chips, sort, columns; filtered in the browser)
//   bar=0                             (hides the demo bar, for screenshots)
// plus the engine's own cx-motion=force.

export const metadata: Metadata = {
  title: 'Store motion demo',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

interface DemoProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const VIEWS = ['home', 'story', 'listing', 'product'] as const;
type View = (typeof VIEWS)[number];

const DEMO_SLUG = 'creative-demo';
const one = (v: string | string[] | undefined): string => (Array.isArray(v) ? v[0] || '' : v || '');

/** Sections of a product page and of a listing when the store has no template of its own. */
const PRODUCT_SECTIONS: SectionInstance[] = [
  { id: 'product-1', section_key: 'product-page', settings: {}, sort_order: 0, translations: [] },
  {
    id: 'product-2',
    section_key: 'featured-products',
    settings: { filter: 'newest', aspect: 'portrait', limit: 4, columns: 4, columns_tablet: 3, columns_mobile: 2 },
    sort_order: 1,
    translations: [
      { locale: 'en', content: { heading: 'You may also like' } },
      { locale: 'ar', content: { heading: 'قد يعجبك أيضاً' } },
    ],
  },
];
const LISTING_SECTIONS: SectionInstance[] = [
  { id: 'listing-1', section_key: 'product-listing', settings: {}, sort_order: 0, translations: [] },
];

export default async function CreativeDemoPage({ searchParams }: DemoProps) {
  if (!creativeDemoEnabled()) notFound();
  const query = await searchParams;

  const requested = one(query.locale);
  const locale: Locale = (locales as readonly string[]).includes(requested) ? (requested as Locale) : 'en';
  const dirParam = one(query.dir);
  const dir: 'ltr' | 'rtl' = dirParam === 'rtl' || dirParam === 'ltr' ? dirParam : locale === 'ar' ? 'rtl' : 'ltr';
  const view: View = (VIEWS as readonly string[]).includes(one(query.view)) ? (one(query.view) as View) : 'home';
  const styleOn = one(query.style) !== 'off';
  const profile = one(query.motion);
  const curtain = one(query.curtain) === '1';
  const progress = one(query.progress) === '1';
  const cursor = one(query.cursor) === '1';
  const builder = one(query.builder) === '1';
  const showBar = one(query.bar) !== '0';
  const cardParam = one(query.card);
  // Enhanced card of the demo: every feature on, so each part is visible.
  const productCard =
    cardParam === 'classic' || cardParam === 'editorial'
      ? resolveProductCard({
          style: cardParam,
          hover_image: true,
          swatches: true,
          sizes_line: true,
          availability: 'sold_out_and_low',
          badge: cardParam === 'editorial' ? 'sale' : 'percent',
          quick_add: true,
        })
      : null;

  const { fixture, source } = await loadFixture();
  const messages = (await import(`@/i18n/messages/${locale}.json`)).default;

  // The store's look, with the motion keys of this request on top.
  const stored = fixture.themeCustomizations;
  const motion: Record<string, unknown> = {};
  if (profile === 'calm' || profile === 'off') motion.reveal = profile;
  if (styleOn)
    motion.creative = {
      enabled: true,
      ...(curtain ? { transition: 'curtain' } : null),
      ...(progress ? { progress: 'bar' } : null),
      ...(cursor ? { cursor: 'dot' } : null),
    };
  const customizations = {
    ...stored,
    ...(Object.keys(motion).length ? { motion } : { motion: undefined }),
  } as ThemeCustomizations;

  const tokens = mergeTokens(minimalTheme.tokens, customizations);
  const cssVars = tokensToCssVars(tokens);
  const primaryContrast = storePrimaryContrast(tokens.colors.primary, tokens, customizations);
  const rootVars: Array<[string, string]> = [
    ...Object.entries(cssVars),
    ['--store-primary', tokens.colors.primary],
    ['--store-primary-contrast', primaryContrast],
    ['--store-secondary', tokens.colors.secondary],
  ];
  const rootVarsCss = `:root {\n${rootVars.map(([k, v]) => `  ${k}: ${cssSafe(String(v))};`).join('\n')}\n}`;
  // Same-origin font CSS (/fonts-cdn/css2), never Google.
  const fontsHref = selfHostedFontsHref(buildGoogleFontsHref([...tokenFonts(tokens), ...tokenArabicFonts(tokens)]));
  const arabicCss = arabicBodyCss(tokens);
  const buttonCss = themeButtonCss(tokens);
  const creative = builder ? null : readCreative(customizations);

  const storeCtx: StoreContext = {
    storeName: fixture.name,
    storeDescription: fixture.description,
    logoUrl: fixture.logoUrl,
    primaryLocale: fixture.primaryLocale,
    secondaryLocales: fixture.secondaryLocales,
    pages: fixture.pages,
    menus: fixture.menus,
    apps: {},
  };

  const shared = {
    theme: minimalTheme,
    locale,
    primaryLocale: fixture.primaryLocale,
    storeSlug: DEMO_SLUG,
    motion: !!creative,
    currency: fixture.currency,
    builderPreview: builder || undefined,
  };

  const products = fixture.products as unknown as StorefrontProductRow[];
  // Card projection: with the card model when the demo card is on, else as today.
  const toCard = (p: StorefrontProductRow) =>
    productCard ? withCardExtras(toListingProduct(p), p as unknown as CardSourceRow) : toListingProduct(p);
  let body: ReactNode;
  if (view === 'product' && fixture.product) {
    const clientProduct = projectProductForClient(
      fixture.product as Parameters<typeof projectProductForClient>[0],
      locale,
      fixture.primaryLocale,
    );
    const designer = (clientProduct as { designer?: Parameters<typeof DesignerSessionProvider>[0]['designer'] }).designer;
    body = (
      <DesignerSessionProvider designer={designer} productId={String(fixture.product.id ?? '')} locale={locale}>
        <ProductPageStateProvider
          product={clientProduct as unknown as ProductData}
          locale={locale}
          primaryLocale={fixture.primaryLocale}
          currency={fixture.currency}
        >
          <SectionRenderer
            {...shared}
            sections={PRODUCT_SECTIONS}
            product={clientProduct as unknown as ProductContext}
            preloaded={{ 'product-2': products.slice(1, 5).map(toCard) }}
          />
        </ProductPageStateProvider>
      </DesignerSessionProvider>
    );
  } else if (view === 'listing') {
    const filtersParam = one(query.filters);
    const listingSettings =
      filtersParam === 'bar' || filtersParam === 'rail' ? resolveListingSettings({ style: filtersParam }) : null;
    let explorer: ListingContext['explorer'];
    if (listingSettings) {
      // Filtered in the browser: the demo has no API behind it.
      const local: LocalSource = {
        rows: fixture.products as unknown as LocalRow[],
        collections: (fixture.collections ?? []).map((c) => ({
          slug: c.slug,
          label: c.label[locale] || c.label.en || c.slug,
          parent: c.parent ?? null,
        })),
      };
      const state = parseFilterState(query);
      const first = localPage(local, state, { locale, page: 1, limit: EXPLORER_PAGE_SIZE });
      explorer = {
        storeSlug: DEMO_SLUG,
        locale,
        lp: '',
        basePath: '/products',
        kind: 'catalog',
        currency: fixture.currency,
        settings: listingSettings,
        state,
        products: first.items.map((r) => toCard(r as unknown as StorefrontProductRow)),
        total: first.total,
        hasMore: first.has_more,
        facets: first.facets,
        card: !!productCard,
        priorityFirst: true,
        local,
      };
    }
    const listing: ListingContext = {
      kind: 'catalog',
      products: products.map(toCard),
      collections: [],
      query: {},
      basePath: '/products',
      isFiltered: false,
      ...(explorer ? { explorer } : {}),
    };
    body = <SectionRenderer {...shared} sections={LISTING_SECTIONS} listing={listing} />;
  } else {
    const sections = toInstances(view === 'story' ? fixture.story : fixture.home, view);
    const preloaded: Record<string, unknown> = {};
    for (const s of sections) {
      if (s.section_key === 'featured-products') {
        const limit = typeof s.settings.limit === 'number' ? s.settings.limit : 4;
        preloaded[s.id] = products.slice(0, limit).map(toCard);
      }
      // Brand sections with a linked product: the same shape the store preload gives.
      if ((PICKED_SECTION_KEYS as readonly string[]).includes(s.section_key)) {
        const slugs = new Set<string>();
        for (const tr of s.translations) for (const slug of pickedSlugs(s.section_key, s.settings, tr.content)) slugs.add(slug);
        for (const slug of pickedSlugs(s.section_key, s.settings, {})) slugs.add(slug);
        const picks: Record<string, PickedProduct> = {};
        for (const slug of slugs) {
          const row = (fixture.products as unknown as PickedSourceRow[]).find((p) => rowHasSlug(p, slug));
          const hit = row ? toPickedProduct(row, slug, locale, fixture.primaryLocale, fixture.currency) : null;
          if (hit) picks[slug] = hit;
        }
        if (Object.keys(picks).length) preloaded[s.id] = { products: picks };
      }
    }
    body = <SectionRenderer {...shared} sections={sections} preloaded={preloaded} />;
  }

  const segment = view === 'listing' || view === 'product' ? 'products' : null;
  const href = (patch: Record<string, string | null>): string => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      const v = one(value);
      if (v) params.set(key, v);
    }
    for (const [key, value] of Object.entries(patch)) {
      if (value === null) params.delete(key);
      else params.set(key, value);
    }
    const qs = params.toString();
    return qs ? `/dev/creative-demo?${qs}` : '/dev/creative-demo';
  };

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <StoreProviders
        locale={locale}
        storeSlug={DEMO_SLUG}
        storeCurrency={fixture.currency}
        storeTax={normalizeStoreTax(fixture.tax as Parameters<typeof normalizeStoreTax>[0])}
        storeApps={{}}
        market={null}
        markets={null}
        primaryLocale={fixture.primaryLocale}
        productCard={productCard}
      >
        {fontsHref && <link rel="stylesheet" href={fontsHref} />}
        <style dangerouslySetInnerHTML={{ __html: rootVarsCss }} />
        {arabicCss && <style dangerouslySetInnerHTML={{ __html: arabicCss }} />}
        {buttonCss && <style dangerouslySetInnerHTML={{ __html: buttonCss }} />}
        <div
          dir={dir}
          lang={locale}
          data-theme={minimalTheme.key}
          {...motionAttrs(customizations)}
          {...(builder ? { 'data-cx-builder': '' } : creativeAttrs(customizations))}
          className="store-root min-h-screen flex flex-col"
          style={
            {
              ...cssVars,
              backgroundColor: 'var(--theme-colors-background)',
              color: 'var(--theme-colors-text)',
              fontFamily: 'var(--theme-font-body)',
              lineHeight: 'var(--theme-line-body)',
              '--store-primary': tokens.colors.primary,
              '--store-primary-contrast': primaryContrast,
              '--store-secondary': tokens.colors.secondary,
              // Same frame as the minimal layout: clip the 100vw full-bleed trick.
              overflowX: 'clip',
            } as CSSProperties
          }
        >
          {creative && (
            <>
              <StoreMotionAssets />
              <CreativeBoot
                options={creative}
                curtainLabel={messages.creative.loadingPage}
                logoUrl={fixture.logoUrl}
                segmentOverride={segment}
              />
            </>
          )}
          <div id="store-nav-header" style={{ display: 'contents' }}>
            <SectionRenderer
              theme={minimalTheme}
              sections={toInstances(fixture.header, 'header')}
              locale={locale}
              storeSlug={DEMO_SLUG}
              motion={!!creative}
              primaryLocale={fixture.primaryLocale}
              storeContext={storeCtx}
              chrome
            />
          </div>
          <main className="flex-1">
            <div style={{ maxWidth: 'var(--theme-container-max)', marginInline: 'auto', paddingInline: '1.5rem' }}>
              {body}
            </div>
          </main>
          <footer id="store-nav-footer">
            <SectionRenderer
              theme={minimalTheme}
              sections={toInstances(fixture.footer, 'footer')}
              locale={locale}
              storeSlug={DEMO_SLUG}
              motion={!!creative}
              primaryLocale={fixture.primaryLocale}
              storeContext={storeCtx}
              chrome
              collapseWrappers={false}
            />
          </footer>
        </div>
        {showBar && (
          <DemoBar
            groups={[
              VIEWS.map((v) => ({ label: v, href: href({ view: v === 'home' ? null : v }), on: v === view })),
              locales.map((l) => ({ label: l, href: href({ locale: l === 'en' ? null : l, dir: null }), on: l === locale })),
              [
                { label: 'ltr', href: href({ dir: 'ltr' }), on: dir === 'ltr' },
                { label: 'rtl', href: href({ dir: 'rtl' }), on: dir === 'rtl' },
              ],
              [
                { label: 'motion on', href: href({ style: null, motion: null }), on: styleOn && !profile },
                { label: 'calm', href: href({ style: null, motion: 'calm' }), on: styleOn && profile === 'calm' },
                { label: 'profile off', href: href({ style: null, motion: 'off' }), on: styleOn && profile === 'off' },
                { label: 'switch off', href: href({ style: 'off', motion: null }), on: !styleOn },
              ],
              [
                { label: 'curtain', href: href({ curtain: curtain ? null : '1' }), on: curtain },
                { label: 'progress', href: href({ progress: progress ? null : '1' }), on: progress },
                { label: 'cursor', href: href({ cursor: cursor ? null : '1' }), on: cursor },
              ],
              [
                { label: 'card today', href: href({ card: null }), on: !productCard },
                { label: 'card classic+', href: href({ card: 'classic' }), on: cardParam === 'classic' },
                { label: 'card editorial', href: href({ card: 'editorial' }), on: cardParam === 'editorial' },
              ],
              [
                { label: 'filters off', href: href({ filters: null }), on: !one(query.filters) },
                { label: 'filters bar', href: href({ filters: 'bar', view: 'listing' }), on: one(query.filters) === 'bar' },
                { label: 'filters rail', href: href({ filters: 'rail', view: 'listing' }), on: one(query.filters) === 'rail' },
              ],
            ]}
            note={source === 'neutral' ? 'neutral placeholder content' : fixture.name}
          />
        )}
      </StoreProviders>
    </NextIntlClientProvider>
  );
}

interface BarLink {
  label: string;
  href: string;
  on: boolean;
}

/** Development toolbar (plain links, outside the store root, English only). */
function DemoBar({ groups, note }: { groups: BarLink[][]; note: string }) {
  return (
    <nav
      aria-label="Demo controls"
      dir="ltr"
      style={{
        position: 'fixed',
        insetInline: 0,
        bottom: 0,
        zIndex: 2147483000,
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: '4px 14px',
        padding: '6px 12px',
        background: 'rgba(17,17,17,.92)',
        color: '#fff',
        font: '500 11px/1.4 system-ui, sans-serif',
      }}
    >
      <span style={{ opacity: 0.6 }}>{note}</span>
      {groups.map((group, gi) => (
        <span key={gi} style={{ display: 'inline-flex', gap: 4 }}>
          {group.map((link) => (
            <a
              key={link.label}
              href={link.href}
              aria-current={link.on ? 'true' : undefined}
              style={{
                padding: '2px 7px',
                borderRadius: 3,
                color: link.on ? '#111' : '#fff',
                background: link.on ? '#fff' : 'rgba(255,255,255,.12)',
                textDecoration: 'none',
              }}
            >
              {link.label}
            </a>
          ))}
        </span>
      ))}
    </nav>
  );
}
