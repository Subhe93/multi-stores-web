import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { headers, cookies } from 'next/headers';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { storefront, resolveMediaUrl, LEGAL_SLUGS, type StoreLegalPageSummary } from '@/lib/api';
import { getPlatformName } from '@/lib/platform';
import { isDefinitiveNotFound, StoreUnavailableError } from '@/lib/apiAvailability';
import { buildStoreOrigin } from '@/lib/storeUrl';
import { preload } from 'react-dom';
import { buildGoogleFontsHref, loadInlineFonts, type ArabicPreload } from '@/lib/storeFonts';
import { isArabicScriptLocale } from '@/lib/arabicFonts';
import { buildTypographyCss, cssSafe, type TypographyStyle } from '@/lib/storeTypography';
import { StoreHeader, type NavCollection } from '@/components/layout/StoreHeader';
import { StoreFooter } from '@/components/layout/StoreFooter';
import { StoreProviders } from '@/components/providers/StoreProviders';
import { normalizeStoreTax, type StoreTaxConfig } from '@/lib/tax';
import { readProductCard } from '@/lib/productCard/settings';
import { normalizeStoreApps, type StorefrontApps } from '@/lib/storeApps';
import { normalizeCheckoutSettings } from '@/lib/checkoutSettings';
import { focusedStorefront, resolveFocusForHost } from '@/lib/focusedStorefront';
import { FocusedHeader } from '@/components/layout/FocusedHeader';
import { FocusedFooter } from '@/components/layout/FocusedFooter';
import type { MarketRoute } from '@/lib/market';
import { getRequestMarket, getRequestNoindex, getRequestSuggestedMarket } from '@/lib/market.server';
import { MarketSuggestBanner } from '@/components/layout/MarketSuggestBanner';
import { MarketPreviewBanner } from '@/components/layout/MarketPreviewBanner';
import { EditHintBoot } from '@/components/edit-hint/EditHintBoot';
import { loadGatedStore, type GatedStore } from '@/lib/storeGate.server';
import { storeGate } from '@/lib/storeGate';
import { PLATFORM_FAVICON_ICON } from '@/lib/storeFavicon';
import { StoreGatePage } from '@/components/layout/StoreGatePage';
import { StorePreviewBar } from '@/components/layout/StorePreviewBar';
import { StorePreviewReset } from '@/components/layout/StorePreviewUnlock';
import { sellerDetailsOf, type TraderDetails } from '@/lib/traderDetails';
import { CountrySwitcher } from '@/components/layout/CountrySwitcher';
import { IfApp } from '@/components/IfApp';
import { BuyerTypeToggle } from '@/components/layout/BuyerTypeToggle';
import { normalizeB2bSettings } from '@/lib/b2bSettings';
import { BUYER_COOKIE, resolveInitialBuyerType, type BuyerType } from '@/lib/buyerType';
import { resolveTheme } from '@/themes/registry';
import { mergeTokens, tokensToCssVars, tokenFonts, tokenArabicFonts, tokenArabicFamilies, arabicBodyCss, themeButtonCss, storePrimaryContrast, motionAttrs } from '@/themes/tokens';
import { SectionRenderer } from '@/themes/SectionRenderer';
import { resolveMenuItems, type ThemeCustomizations, type SectionInstance, type StoreContext } from '@/themes/types';
import { buildOrganization, buildWebSite, ldJsonSafe } from '@/lib/jsonld';
import { resolveSocialHref } from '@/themes/minimal/sections/_shared/socialIcons';
import { StoreTracking } from '@/components/tracking/StoreTracking';
import { CookieSettingsLink } from '@/components/tracking/CookieSettingsLink';
import {
  cookiePolicyHref as resolveCookiePolicyHref,
  type StoreTracking as StoreTrackingIds,
} from '@/lib/consent';
import { sanitizeCustomCss } from '@/lib/customCss';
import { StoreCustomCss } from '@/components/StoreCustomCss';
import { clientMessages, creativeAttrs, readCreative } from '@/themes/creative/creativeAttrs';
import { CreativeBoot } from '@/themes/creative/boot.client';
import { StoreMotionAssets } from '@/themes/creative/primitives/StoreMotionAssets';

// ---------- Type definitions ----------

interface LanguageConfig {
  primary_locale: string;
  secondary_locales: string[];
}

interface PageTranslation {
  locale: string;
  title: string;
}

interface StorePage {
  slug: string;
  translations: PageTranslation[];
}

interface StoreTranslation {
  name?: string;
  description?: string;
  metaTitle?: string;
  metaDescription?: string;
}

interface Store {
  id: string;
  name: string;
  /** Publication state (onboarding SPEC §3); LIVE for every store before the migration. */
  status?: string;
  /** Reduced payload of a store that is not LIVE yet (no catalog). */
  coming_soon?: boolean;
  /** Reduced payload of a PAUSED store. */
  paused?: boolean;
  /** MARKETPLACE | INDEPENDENT; decides which legal footer links render. */
  store_type?: string;
  /** Seller identity shown in the footer and legal pages (SPEC §1). */
  trader_details?: TraderDetails | null;
  /** Seller of record: the platform operator on MARKETPLACE stores. */
  seller_details?: TraderDetails | null;
  currency?: string;
  /** Tax settings (pricing mode, catalog display flag) — API-CONTRACT-TAX §3. */
  tax?: StoreTaxConfig | null;
  /** Enabled store apps — always sent by the API (`{}` when none). */
  apps?: StorefrontApps | null;
  /** Markets app only (M1-DESIGN §3.3): absent for other stores. */
  market?: MarketRoute | null;
  markets?: MarketRoute[];
  /** Checkout behaviour overrides (M5.1): absent for stores on the defaults. */
  checkout?: unknown;
  /** Tracking ids + consent flag (3.9); always sent, ids null when unset. */
  tracking?: StoreTrackingIds | null;
  custom_domain?: string | null;
  description?: string;
  logo_url?: string;
  favicon_url?: string;
  language_config?: LanguageConfig | null;
  pages?: StorePage[];
  /** Slug of the published cookie page of any type (consent v2); absent on older APIs. */
  cookie_page_slug?: string | null;
  theme_key?: string;
  theme_customizations?: ThemeCustomizations;
  theme?: {
    primaryColor?: string;
    secondaryColor?: string;
    fontFamily?: string;
    typography?: {
      heading?: TypographyStyle;
      body?: TypographyStyle;
      button?: TypographyStyle;
      link?: TypographyStyle;
      header?: TypographyStyle;
    };
    header?: {
      showStoreName?: boolean;
      logoSize?: number;
    };
    templateId?: string;
    socials?: {
      instagram?: string;
      facebook?: string;
      twitter?: string;
      tiktok?: string;
      youtube?: string;
    };
    contact?: {
      email?: string;
      phone?: string;
      whatsapp?: string;
      address?: string;
    };
    seo?: {
      metaTitle?: string;
      metaDescription?: string;
    };
    translations?: Record<string, StoreTranslation>;
  };
}

// ---------- Layout props ----------

interface StoreLayoutProps {
  children: React.ReactNode;
  params: Promise<{ storeSlug: string }>;
}

// ---------- generateMetadata ----------

export async function generateMetadata({
  params,
}: {
  params: Promise<{ storeSlug: string }>;
}): Promise<Metadata> {
  const { storeSlug } = await params;
  try {
    const cookieStore = await cookies();
    const requestHeaders = await headers();
    const urlLocale = cookieStore.get('x-store-locale')?.value || requestHeaders.get('x-locale');
    const store = await storefront.getStore(storeSlug, await getRequestMarket()) as Store;
    const primaryLocale = store.language_config?.primary_locale || 'en';
    const lang = urlLocale || primaryLocale;
    const trans = store.theme?.translations?.[lang];

    const origin = buildStoreOrigin(storeSlug, store.custom_domain || null, store.market);

    // Deliberately NO `alternates` here. Metadata merges per top-level field,
    // so a canonical set at the layout is inherited verbatim by every route
    // that doesn't define its own — which meant /products, /collections/*,
    // /cart and /account all declared the store homepage as their canonical,
    // asking Google not to index them. Each route now owns its canonical, and
    // a route without one simply has none.
    // The store-level SEO overrides written by the dashboard's store settings
    // live under `theme.seo`; only `theme.translations[locale]` was ever read,
    // so those fields silently did nothing. Per-locale still wins.
    const storeSeo = store.theme?.seo;

    // Not LIVE: the layout renders the coming-soon / closed page for every
    // route; it must never be indexed (the body also emits a robots meta).
    if (storeGate(store) !== 'live') {
      return {
        metadataBase: new URL(origin),
        title: trans?.name || store.name,
        robots: { index: false, follow: false },
      };
    }

    return {
      // Resolves relative URLs (e.g. a page's uploaded OG image) against this
      // store's own origin rather than Next's localhost default.
      metadataBase: new URL(origin),
      title: trans?.metaTitle || storeSeo?.metaTitle || trans?.name || store.name,
      description:
        trans?.metaDescription ||
        storeSeo?.metaDescription ||
        trans?.description ||
        store.description,
      // The creator uploads a favicon in store settings; it was stored and
      // never rendered, so every storefront showed the framework default.
      // A store without one keeps the single platform icon link it always
      // had (an `undefined` here would resolve to no icon link at all).
      icons: store.favicon_url
        ? { icon: resolveMediaUrl(store.favicon_url) }
        : { icon: [{ ...PLATFORM_FAVICON_ICON }] },
    };
  } catch {
    return {};
  }
}

// ---------- Layout ----------

export default async function StoreLayout({
  children,
  params,
}: StoreLayoutProps) {
  const { storeSlug } = await params;

  // Read locale forwarded by middleware (cookie is the most reliable mechanism across rewrites)
  const cookieStore = await cookies();
  const requestHeaders = await headers();
  const urlLocale = cookieStore.get('x-store-locale')?.value || requestHeaders.get('x-locale');

  // Market of the request host (markets app) + the proxy's geo suggestion.
  // Both are undefined/null for stores without the app.
  const marketKey = await getRequestMarket();
  const suggestedMarket = marketKey ? await getRequestSuggestedMarket() : null;
  // The proxy's indexing verdict for this host (M6.1): preview, NEVER, or
  // AUTO on the platform subdomain.
  const noindex = await getRequestNoindex();

  let gated: GatedStore<Store>;
  try {
    // Publication gate: a store that is not LIVE answers a reduced payload
    // (`coming_soon` / `paused`); the owner's preview cookie unlocks the
    // full storefront through `GET /storefront/:slug/preview`.
    gated = await loadGatedStore<Store>(storeSlug, marketKey);
  } catch (err) {
    // Only a definitive API answer (404 STORE_NOT_FOUND, other 4xx) means
    // the store does not exist. An unreachable API (maintenance window,
    // network error, 502/503/504, timeout) must never become a 404 that
    // search engines act on: it is thrown, so the error boundary answers a
    // 5xx. The proxy normally catches the outage first and serves the 503
    // maintenance page (src/lib/apiAvailability.ts).
    if (isDefinitiveNotFound(err)) notFound();
    throw new StoreUnavailableError();
  }
  const store: Store = gated.store;
  const storePreview = gated.preview;

  // Not LIVE and no owner preview: the branded "Coming soon" / "Temporarily
  // closed" page replaces the whole storefront (every route, noindex).
  if (gated.gate !== 'live') {
    const gateLocale = urlLocale || store.language_config?.primary_locale || 'en';
    const gateTokens = mergeTokens(resolveTheme(store.theme_key).tokens, store.theme_customizations);
    const gateName = store.theme?.translations?.[gateLocale]?.name || store.name || storeSlug;
    return (
      <NextIntlClientProvider locale={gateLocale} messages={clientMessages(await getMessages())}>
        <StoreGatePage
          kind={gated.gate}
          storeSlug={storeSlug}
          storeName={gateName}
          logoUrl={store.logo_url}
          primaryColor={store.theme?.primaryColor || gateTokens.colors.primary}
          locale={gateLocale}
        />
      </NextIntlClientProvider>
    );
  }

  // Focused storefront (src/lib/focusedStorefront.ts): the store is a
  // purchase step of the owner's external site. THE gate for the whole chrome:
  // when `focus` is set, the header and footer slots below render the focused
  // pair instead of the built-in or the published builder chrome, and the
  // menu / collection / published-chrome reads are skipped. The settings are
  // resolved for the request host first (loop guard) and the same object goes
  // to the client providers, so server and client always agree. Null for
  // every store without the flag: nothing below changes for them.
  const checkoutSettings = resolveFocusForHost(
    normalizeCheckoutSettings(store.checkout),
    requestHeaders.get('host'),
  );
  const focus = focusedStorefront(checkoutSettings);

  // Published HEADER / FOOTER chrome. Either can be null — that means the
  // creator hasn't published the chrome yet, so we fall back to the built-in
  // <StoreHeader> / <StoreFooter> components below. Failing soft so a
  // chrome-fetch hiccup never blanks out the whole storefront.
  interface PublishedChromeSnapshot {
    sections?: SectionInstance[];
  }
  interface PublishedChrome {
    id: string;
    snapshot: PublishedChromeSnapshot;
  }
  let publishedHeader: PublishedChrome | null = null;
  let publishedFooter: PublishedChrome | null = null;
  if (!focus) {
    try {
      publishedHeader = (await storefront.getPublishedHeader(storeSlug)) as PublishedChrome | null;
    } catch {
      publishedHeader = null;
    }
    try {
      publishedFooter = (await storefront.getPublishedFooter(storeSlug)) as PublishedChrome | null;
    } catch {
      publishedFooter = null;
    }
  }

  // Enabled store apps — `{}` for stores without any (D2 keeps output identical).
  const storeApps = normalizeStoreApps(store.apps);

  // b2b app (M2-DESIGN §4.1): seed the buyer type from the `ms-buyer-type`
  // cookie / the app's default. The cookie is only read for stores with the
  // app, so every other store renders exactly as before.
  const buyerType: BuyerType | undefined = storeApps.b2b
    ? resolveInitialBuyerType({
        cookie: cookieStore.get(BUYER_COOKIE)?.value,
        settings: normalizeB2bSettings(storeApps.b2b.settings),
      })
    : undefined;

  // Navigation menus the creator built — chrome sections resolve a menu key
  // to its items via storeContext.menus. Soft-fail to an empty list.
  // Focused storefront: only the `footer` menu is used (the links column of
  // FocusedFooter); the read is the same cached one.
  let storeMenus: StoreContext['menus'] = [];
  try {
    storeMenus = (await storefront.getMenus(storeSlug)) as StoreContext['menus'];
  } catch {
    storeMenus = [];
  }

  // Creator collections power the desktop dropdown + mobile section in the header.
  // Failing softly here keeps the store rendering if the endpoint hiccups.
  interface RawCreatorCategory {
    slug: string;
    /** M6.7: slugs root → self. */
    path?: string[];
    is_active?: boolean;
    thumbnail_url?: string | null;
    translations: { locale: string; name: string }[];
    children?: RawCreatorCategory[];
  }
  let creatorCategoriesRaw: RawCreatorCategory[] = [];
  if (!focus) {
    try {
      creatorCategoriesRaw = (await storefront.getCreatorCategories(
        storeSlug,
      )) as RawCreatorCategory[];
    } catch {
      creatorCategoriesRaw = [];
    }
  }

  // Resolve the active theme up front so brand colours can fall back to its
  // tokens when the creator hasn't set an explicit colour. This is what makes
  // "Choose a theme" actually recolour the live storefront (--store-* below),
  // not just the registry-token sections.
  const activeTheme = resolveTheme(store.theme_key);
  const resolvedTokens = mergeTokens(activeTheme.tokens, store.theme_customizations);
  // Explicit creator colour wins; otherwise follow the chosen theme's tokens.
  const primaryColor = store.theme?.primaryColor || resolvedTokens.colors.primary;
  const secondaryColor = store.theme?.secondaryColor || resolvedTokens.colors.secondary;
  // Readable label colour on --store-primary fills (dark on a yellow brand).
  const primaryContrast = storePrimaryContrast(primaryColor, resolvedTokens, store.theme_customizations);
  const fontFamily = store.theme?.fontFamily;
  const typography = store.theme?.typography || {};
  const headerCfg = store.theme?.header || {};
  const showStoreName = headerCfg.showStoreName !== false;
  const logoSize = typeof headerCfg.logoSize === 'number' && headerCfg.logoSize > 0 ? headerCfg.logoSize : 32;
  const primaryLocale = store.language_config?.primary_locale || 'en';
  const secondaryLocales = store.language_config?.secondary_locales || [];

  // Admin-configured platform name — inherited by the footer attribution.
  const platformName = await getPlatformName();

  // CSS custom properties (`var(--theme-*)`) consumed by sections inside
  // <main>. `activeTheme` / `resolvedTokens` are resolved above so the legacy
  // `--store-*` brand colours can share the same source.
  const themeCssVars = tokensToCssVars(resolvedTokens);
  const themeFonts = tokenFonts(resolvedTokens);

  // The same variables, emitted at :root as well as on .store-root. Overlay UI
  // (the cart drawer) is portaled to <body> to escape the header's
  // backdrop-filter containing block, which puts it outside .store-root — and
  // custom properties only inherit down the tree, so without this the drawer
  // resolved none of the theme's fonts or colours.
  const rootVarsCss = `:root {\n${[
    ...Object.entries(themeCssVars),
    // The legacy brand colours live only as inline styles on .store-root, so
    // portaled UI would lose them too.
    ['--store-primary', primaryColor],
    ['--store-primary-contrast', primaryContrast],
    ['--store-secondary', secondaryColor],
  ]
    .map(([k, v]) => `  ${k}: ${cssSafe(String(v))};`)
    .join('\n')}\n}`;
  // Optional theme button radius: one rule that makes the main buttons of
  // the page sections follow it. Empty (no element at all) when unset.
  const buttonCss = themeButtonCss(resolvedTokens);

  // Optional Arabic-script families (theme token), per slot. Null for a store
  // that has not set one: then nothing below adds a string, a rule, a preload
  // or an element.
  const arabicFamilies = tokenArabicFamilies(resolvedTokens);
  // The Arabic body family on <body> itself, for text outside the theme
  // layout (mobile menu drawer, lightboxes, preview bar, consent UI).
  const arabicCss = arabicBodyCss(resolvedTokens);

  // Scoped rules of the legacy per-element typography (lib/storeTypography.ts);
  // with an Arabic family its stacks carry that family too.
  const typographyCss = buildTypographyCss(typography, arabicFamilies);

  // If URL had a locale prefix use it; otherwise fall back to the store's primary locale
  const currentLang = urlLocale || primaryLocale;

  // Combine every font the user has selected so the browser actually loads them.
  // Theme fonts come first so they're always loaded; legacy per-element fonts
  // are appended so existing stores keep their custom typography.
  const primaryFonts = [
    ...themeFonts,
    fontFamily,
    typography.heading?.fontFamily,
    typography.body?.fontFamily,
    typography.button?.fontFamily,
    typography.link?.fontFamily,
    typography.header?.fontFamily,
  ];
  // Optional Arabic-script fallback fonts (theme customizer). They go last,
  // so a store without them builds the same URL (and the same cached fetch).
  const arabicFonts = tokenArabicFonts(resolvedTokens);
  const fontsHref = buildGoogleFontsHref([...primaryFonts, ...arabicFonts]);
  const arabicPreload: ArabicPreload[] = [];
  if (arabicFamilies && isArabicScriptLocale(currentLang)) {
    if (arabicFamilies.body) {
      arabicPreload.push({ family: arabicFamilies.body, weight: resolvedTokens.typography.fontWeight.body });
    }
    if (arabicFamilies.heading) {
      arabicPreload.push({ family: arabicFamilies.heading, weight: resolvedTokens.typography.fontWeight.heading });
    }
  }
  // Self-hosted fonts: the Google CSS is inlined with same-origin font URLs
  // (no render-blocking request, no visitor IP sent to Google). Null keeps
  // the classic <link> below as a fallback.
  const inlineFonts = fontsHref
    ? await loadInlineFonts(
        fontsHref,
        [
          typography.body?.fontFamily || fontFamily || resolvedTokens.typography.fontFamily.body,
          typography.heading?.fontFamily || resolvedTokens.typography.fontFamily.heading || fontFamily,
        ],
        undefined,
        // Only their Arabic subset is kept, unless the family is also one of
        // the store's main fonts. On a Latin page they are not preloaded: the
        // browser fetches the file only when Arabic text is rendered.
        arabicFonts.filter((f) => !primaryFonts.includes(f)),
        // An Arabic-script page draws them at once: their files are requested
        // early, like the Latin ones (body first, then heading).
        arabicPreload,
      )
    : null;
  for (const href of inlineFonts?.preloads ?? []) {
    preload(href, { as: 'font', type: 'font/woff2', crossOrigin: 'anonymous' });
  }

  // Owner's store-wide custom CSS (theme customizer). Sanitized so it cannot
  // close the <style> element; the raw value is never rendered.
  const customCss = sanitizeCustomCss(store.theme_customizations?.customCss);

  // Resolve translated store name and description for current locale
  const storeTranslations = store.theme?.translations || {};
  const localeTrans = storeTranslations[currentLang];
  const storeName = localeTrans?.name || store.name;
  const storeDescription = localeTrans?.description || store.description;

  // Published static pages forwarded to header and footer
  const pages = store.pages ?? [];

  // Consent v2: the banner and the settings dialog link to the store's
  // cookie page when one is published under a known slug (every store: the
  // dialog also serves external media on stores without trackers);
  // otherwise the link is simply omitted.
  // Locale prefix is applied client-side (useLocalePath) like every page link.
  const cookiePolicyHref = resolveCookiePolicyHref(store);

  // Legal pages (Privacy / Terms / Refund / Shipping) at /legal/{slug}: the
  // store's own page titles, the default template's, or the platform's for
  // MARKETPLACE stores — resolved by the API per store and locale. Soft-fail
  // to an empty list so a transient API hiccup never blanks the storefront.
  let platformLegalPages: StoreLegalPageSummary[] = [];
  try {
    const all = await storefront.getLegalPages(storeSlug, currentLang, await getRequestMarket());
    const bySlug = new Map(all.map((p) => [p.slug, p] as const));
    platformLegalPages = LEGAL_SLUGS
      .map((slug) => bySlug.get(slug))
      .filter((p): p is StoreLegalPageSummary => !!p);
  } catch {
    platformLegalPages = [];
  }

  // Resolve creator collections for the current locale (header dropdown shape).
  const resolveCollectionTitle = (
    translations: { locale: string; name: string }[] | undefined,
    fallback: string,
  ) => {
    if (!translations?.length) return fallback;
    return (
      translations.find((t) => t.locale === currentLang)?.name ||
      translations.find((t) => t.locale === 'en')?.name ||
      translations[0]?.name ||
      fallback
    );
  };
  // Root / child / grandchild (M6 §3) — deeper nodes are not rendered.
  const NAV_COLLECTION_MAX_DEPTH = 2;
  // `trail` = ancestor slugs, the fallback for the M6.7 hierarchical URL
  // when the payload carries no `path`.
  const toNavCollection = (c: RawCreatorCategory, depth: number, trail: string[]): NavCollection => {
    const path = c.path?.length ? c.path : [...trail, c.slug];
    return {
      slug: c.slug,
      path,
      title: resolveCollectionTitle(c.translations, c.slug),
      thumbnailUrl: c.thumbnail_url ?? null,
      children:
        depth < NAV_COLLECTION_MAX_DEPTH
          ? (c.children || [])
              .filter((ch) => ch.is_active !== false)
              .map((ch) => toNavCollection(ch, depth + 1, path))
          : [],
    };
  };
  const navCollections: NavCollection[] = creatorCategoriesRaw
    .filter((c) => c.is_active !== false)
    .map((c) => toNavCollection(c, 0, []));

  // Social and contact info from store theme
  const socials = store.theme?.socials;
  const contact = store.theme?.contact;

  // JSON-LD: Organization + WebSite. Embedded at the storefront root so every
  // page inside this store inherits them. The url is the store's subdomain
  // (custom_domain wins) — never the internal /store/{slug} path.
  const storeUrl = buildStoreOrigin(storeSlug, store.custom_domain || null, store.market);
  // Values are normalised first (`facebook.com/namez.se` → `https://…`) so a
  // scheme-less profile still counts; only absolute http(s) URLs are emitted.
  const sameAs = (['instagram', 'facebook', 'twitter', 'tiktok', 'youtube'] as const)
    .map((platform) => resolveSocialHref(platform, socials?.[platform] || ''))
    .filter((u) => /^https?:\/\//i.test(u));
  // Seller of record shown in the footer: Namez AB on MARKETPLACE stores.
  const sellerDetails = sellerDetailsOf(store);
  const organizationLd = buildOrganization({
    name: storeName,
    url: storeUrl,
    logo: store.logo_url || undefined,
    description: typeof storeDescription === 'string' ? storeDescription : undefined,
    sameAs,
    email: contact?.email,
    phone: contact?.phone,
  });
  const websiteLd = buildWebSite({
    name: storeName,
    url: storeUrl,
    // The product listing redirects to the external site in focused mode:
    // no search action is advertised then.
    searchUrlTemplate: focus ? undefined : `${storeUrl}/products?search={search_term_string}`,
  });

  // Load i18n messages for store pages (locale resolved via request.ts fallback)
  const messages = await getMessages();

  // Creative engine store switch: null for every store that did not turn it
  // on, and in the focused storefront.
  const creative = focus ? null : readCreative(store.theme_customizations);
  const creativeCurtainLabel =
    (messages as { creative?: { loadingPage?: string } }).creative?.loadingPage || '';

  return (
    <NextIntlClientProvider locale={currentLang} messages={clientMessages(messages)}>
      <StoreProviders locale={currentLang} storeSlug={storeSlug} storeId={store.id} storeCurrency={store.currency} storeTax={normalizeStoreTax(store.tax)} storeApps={storeApps} market={store.market ?? null} markets={store.markets ?? null} storeCustomDomain={store.custom_domain ?? null} buyerType={buyerType} primaryLocale={primaryLocale} checkout={checkoutSettings} productCard={readProductCard(store.theme_customizations)}>
        {inlineFonts ? (
          <style dangerouslySetInnerHTML={{ __html: inlineFonts.css }} />
        ) : fontsHref && (
          <>
            <link rel="preconnect" href="https://fonts.googleapis.com" />
            <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
            <link rel="stylesheet" href={fontsHref} />
          </>
        )}
        {/* Emitted outside .store-root so body-level portals inherit the theme. */}
        <style dangerouslySetInnerHTML={{ __html: rootVarsCss }} />
        {/* Arabic body family on <body>: rendered only for a store that set one. */}
        {arabicCss && <style dangerouslySetInnerHTML={{ __html: arabicCss }} />}
        {/* Theme button radius: rendered only for a store that set one. */}
        {buttonCss && <style dangerouslySetInnerHTML={{ __html: buttonCss }} />}
        {/* Market preview host or a request the proxy flagged noindex (M6.1
            `x-store-noindex`): never indexable (React hoists the meta into
            <head>; the proxy also sends X-Robots-Tag). Pages own `robots` in
            their metadata, so a layout-level metadata value would be
            overridden — the tag is emitted here instead. */}
        {(store.market?.preview || noindex) && <meta name="robots" content="noindex, nofollow" />}
        <div
          dir={currentLang === 'ar' ? 'rtl' : 'ltr'}
          lang={currentLang}
          data-theme={activeTheme.key}
          {...motionAttrs(store.theme_customizations)}
          {...creativeAttrs(store.theme_customizations)}
          className="store-root min-h-screen flex flex-col"
          style={{
            ...themeCssVars,
            // Page background + text follow the active theme (was hard-coded
            // white/gray, which kept the storefront light on every theme).
            backgroundColor: 'var(--theme-colors-background)',
            color: 'var(--theme-colors-text)',
            '--store-primary': primaryColor,
            '--store-primary-contrast': primaryContrast,
            '--store-secondary': secondaryColor,
            '--store-logo-size': `${logoSize}px`,
            ...(fontFamily
              ? {
                  fontFamily: arabicFamilies?.body
                    ? `"${fontFamily}", "${arabicFamilies.body}", system-ui, sans-serif`
                    : `"${fontFamily}", system-ui, sans-serif`,
                }
              : {}),
          } as React.CSSProperties}
        >
          {typographyCss && (
            <style dangerouslySetInnerHTML={{ __html: typographyCss }} />
          )}
          {/* Store-wide custom CSS: after the global stylesheet, the theme
              variables and the typography rules above, so it can override
              them. Only rendered inside this store's layout tree; its
              selectors are global for the document. Left out on checkout,
              sign-in and account pages (ownerCodeGate). */}
          {customCss && <StoreCustomCss css={customCss} />}
          {/* Market preview strip (nothing for other hosts). */}
          <MarketPreviewBanner />
          {/* Consent manager (consent v2) for every store: the banner and
              vendor tags only for stores with gated trackers, the settings
              dialog (external media) everywhere. Renders nothing on the
              server (no layout shift, no scripts). */}
          <StoreTracking
            storeSlug={storeSlug}
            tracking={store.tracking ?? null}
            cookiePolicyHref={cookiePolicyHref}
            privacyHref="/legal/privacy"
          />
          {/* Store-owner "Edit" button: renders nothing (and loads nothing)
              unless the dashboard handed this browser an owner token. */}
          <EditHintBoot storeSlug={storeSlug} />
          {/* Motion style of the store (theme_customizations.motion.creative):
              the gate script, the stylesheets of the motion recipes and the
              runtime (section scan, smooth scrolling, magnetic buttons, optional
              page curtain). Nothing is rendered for a store that never set it. */}
          {creative && (
            <>
              <StoreMotionAssets />
              <CreativeBoot
                options={creative}
                curtainLabel={creativeCurtainLabel}
                logoUrl={store.logo_url ? resolveMediaUrl(store.logo_url) : undefined}
              />
            </>
          )}
          {/* Owner preview of a store that is not LIVE yet. */}
          {storePreview ? <StorePreviewBar /> : <StorePreviewReset />}
          {/* Site-wide structured data: Organization + WebSite. */}
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: ldJsonSafe(organizationLd) }}
          />
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: ldJsonSafe(websiteLd) }}
          />
          {/* Theme.Layout owns the page chrome (container, spacing, decorative
              strips). Header + footer are either rendered from the creator's
              published HEADER/FOOTER pages (section-based, fully customizable)
              or fall back to the built-in <StoreHeader>/<StoreFooter>
              components — that keeps stores rendering for creators who
              haven't touched the chrome builder yet. */}
          {(() => {
            const storeCtx: StoreContext = {
              storeName,
              storeDescription: typeof storeDescription === 'string' ? storeDescription : undefined,
              logoUrl: store.logo_url,
              primaryLocale,
              secondaryLocales,
              pages: pages as StoreContext['pages'],
              menus: storeMenus,
              apps: storeApps,
              ...(store.market ? { market: store.market, markets: store.markets ?? [] } : {}),
              ...(socials ? { socials } : {}),
              ...(sellerDetails ? { traderDetails: sellerDetails } : {}),
            };

            const headerSections = publishedHeader?.snapshot?.sections;
            const footerSections = publishedFooter?.snapshot?.sections;

            // "You seem to be in {country} — switch market?" strip under the
            // header. Only market stores receive the proxy's suggestion, and
            // <IfApp> keeps it out of the tree for everyone else.
            const marketBanner = suggestedMarket && !focus ? (
              <IfApp app="markets">
                <MarketSuggestBanner storeSlug={storeSlug} suggestedKey={suggestedMarket.key} country={suggestedMarket.country} />
              </IfApp>
            ) : null;

            const headerSlot = focus ? (
              // Focused storefront: logo + back to site + cart, whichever
              // header the store uses (built-in or published HEADER page).
              // Same wrapper id, so the checkout layout still hides it.
              <div id="store-nav-header" style={{ display: 'contents' }}>
                <FocusedHeader
                  storeName={storeName}
                  logoUrl={store.logo_url}
                  primaryColor={primaryColor}
                  logoSize={logoSize}
                />
              </div>
            ) :
              headerSections && headerSections.length > 0 ? (
                <div id="store-nav-header" style={{ display: 'contents' }}>
                  <SectionRenderer
                    theme={activeTheme}
                    sections={headerSections}
                    locale={currentLang}
                    storeSlug={storeSlug}
                    motion={!!creative}
                    primaryLocale={primaryLocale}
                    storeContext={storeCtx}
                    chrome
                  />
                  {/* A published chrome header has no built-in switcher slot
                      yet (a chrome section is a later milestone), so market
                      stores get a slim strip with the country switcher, and
                      b2b stores the Person | Company toggle (M2-DESIGN §4.2). */}
                  {(store.market || storeApps.b2b) && (
                    // Phones: the buyer toggle sits in the header's menu drawer,
                    // so the strip shows below md only when it also carries the
                    // country switcher (which needs two markets or more).
                    <div className={`store-surface store-bd border-b px-4 py-1 justify-end items-center gap-3 ${store.market && (store.markets?.length ?? 0) >= 2 ? 'flex' : 'hidden md:flex'}`}>
                      <IfApp app="b2b">
                        <div className="hidden md:block">
                          <BuyerTypeToggle primaryColor={primaryColor} />
                        </div>
                      </IfApp>
                      {store.market && (
                        <IfApp app="markets">
                          <CountrySwitcher storeSlug={storeSlug} primaryColor={primaryColor} />
                        </IfApp>
                      )}
                    </div>
                  )}
                  {marketBanner}
                </div>
              ) : (
                <div id="store-nav-header" style={{ display: 'contents' }}>
                  <StoreHeader
                    storeName={storeName}
                    storeSlug={storeSlug}
                    logoUrl={store.logo_url}
                    primaryColor={primaryColor}
                    primaryLocale={primaryLocale}
                    secondaryLocales={secondaryLocales}
                    pages={pages}
                    collections={navCollections}
                    currentLang={currentLang}
                    showStoreName={showStoreName}
                    logoSize={logoSize}
                    {...(creative ? { motion: 'scroll' as const } : null)}
                  />
                  {marketBanner}
                </div>
              );

            const footerSlot = focus ? (
              // Focused storefront: brand band with the seller's contact
              // block, the `footer` menu (else the legal pages), back to
              // site and the legal line with the cookie settings link.
              <div id="store-nav-footer">
                <FocusedFooter
                  storeName={storeName}
                  logoUrl={store.logo_url}
                  menuLinks={resolveMenuItems({ menus: storeMenus } as StoreContext, 'footer', currentLang)}
                  legalPages={platformLegalPages}
                  cookiePolicyHref={cookiePolicyHref}
                  traderDetails={sellerDetails}
                  platformName={platformName}
                />
              </div>
            ) :
              footerSections && footerSections.length > 0 ? (
                // The page's footer landmark. The legacy branch below stays a
                // div: StoreFooter renders its own <footer>.
                <footer id="store-nav-footer">
                  <SectionRenderer
                    theme={activeTheme}
                    sections={footerSections}
                    locale={currentLang}
                    storeSlug={storeSlug}
                    motion={!!creative}
                    primaryLocale={primaryLocale}
                    storeContext={storeCtx}
                    chrome
                    collapseWrappers={false}
                  />
                  {/* Permanent way back to the cookie settings (consent v2 D4a). */}
                  <CookieSettingsLink variant="footer-row" />
                </footer>
              ) : (
                <div id="store-nav-footer">
                  <StoreFooter
                    storeName={storeName}
                    primaryColor={primaryColor}
                    pages={pages}
                    platformLegalPages={platformLegalPages}
                    storeType={store.store_type}
                    socials={socials}
                    contact={contact}
                    traderDetails={sellerDetails}
                    currentLang={currentLang}
                    primaryLocale={primaryLocale}
                    platformName={platformName}
                    {...(creative ? { motion: 'scroll' as const } : null)}
                  />
                  <CookieSettingsLink variant="footer-row" />
                </div>
              );

            return (
              <activeTheme.Layout
                storeSlug={storeSlug}
                locale={currentLang}
                storeName={storeName}
                storeDescription={typeof storeDescription === 'string' ? storeDescription : undefined}
                logoUrl={store.logo_url}
                headerSlot={headerSlot}
                footerSlot={footerSlot}
              >
                {children}
              </activeTheme.Layout>
            );
          })()}
        </div>
      </StoreProviders>
    </NextIntlClientProvider>
  );
}
