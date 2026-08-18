import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { headers, cookies } from 'next/headers';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { storefront, legal, LEGAL_SLUGS, type LegalPageSummary } from '@/lib/api';
import { buildStoreOrigin } from '@/lib/storeUrl';
import { GOOGLE_FONT_SET } from '@/lib/google-fonts';
import { StoreHeader, type NavCollection } from '@/components/layout/StoreHeader';
import { StoreFooter } from '@/components/layout/StoreFooter';
import { StoreProviders } from '@/components/providers/StoreProviders';
import { resolveTheme } from '@/themes/registry';
import { mergeTokens, tokensToCssVars, tokenFonts } from '@/themes/tokens';
import { SectionRenderer } from '@/themes/SectionRenderer';
import type { ThemeCustomizations, SectionInstance, StoreContext } from '@/themes/types';
import { buildOrganization, buildWebSite, ldJsonSafe } from '@/lib/jsonld';

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

interface TypographyStyle {
  fontFamily?: string;
  color?: string;
  fontSize?: number;
}

interface Store {
  id: string;
  name: string;
  currency?: string;
  description?: string;
  logo_url?: string;
  language_config?: LanguageConfig | null;
  pages?: StorePage[];
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

// Escape `</style>` and backslashes when injecting user-supplied values into a <style> block.
function cssSafe(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/<\/style/gi, '<\\/style');
}

// Quote a font family name so values like "Playfair Display" survive the CSS parser.
function quoteFont(name: string): string {
  const escaped = cssSafe(name).replace(/"/g, '\\"');
  return `"${escaped}"`;
}

// Build a scoped <style> rule body for a typography element.
function typoBlock(selector: string, style?: TypographyStyle): string {
  if (!style) return '';
  const parts: string[] = [];
  if (style.fontFamily) parts.push(`font-family: ${quoteFont(style.fontFamily)}, system-ui, sans-serif;`);
  if (style.color) parts.push(`color: ${cssSafe(style.color)};`);
  if (typeof style.fontSize === 'number' && style.fontSize > 0) {
    // Clamp into a sane range so a stray edit can't break layout.
    const px = Math.max(8, Math.min(160, style.fontSize));
    parts.push(`font-size: ${px}px;`);
  }
  if (!parts.length) return '';
  return `${selector} { ${parts.join(' ')} }`;
}

// Build a single Google Fonts CSS2 URL covering every distinct font the store
// uses. The full family catalog is the allowlist — anything outside it is
// treated as a system font and skipped from the <link> request.
function buildGoogleFontsHref(fonts: (string | undefined)[]): string | null {
  const unique = Array.from(new Set(
    fonts.filter((f): f is string => !!f && GOOGLE_FONT_SET.has(f))
  ));
  if (!unique.length) return null;
  const families = unique
    .map((f) => `family=${encodeURIComponent(f).replace(/%20/g, '+')}:wght@400;500;600;700`)
    .join('&');
  return `https://fonts.googleapis.com/css2?${families}&display=swap`;
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
    const store = await storefront.getStore(storeSlug) as Store;
    const primaryLocale = store.language_config?.primary_locale || 'en';
    const lang = urlLocale || primaryLocale;
    const trans = store.theme?.translations?.[lang];

    const origin = buildStoreOrigin(storeSlug, (store as { custom_domain?: string | null }).custom_domain || null);

    // Deliberately NO `alternates` here. Metadata merges per top-level field,
    // so a canonical set at the layout is inherited verbatim by every route
    // that doesn't define its own — which meant /products, /collections/*,
    // /cart and /account all declared the store homepage as their canonical,
    // asking Google not to index them. Each route now owns its canonical, and
    // a route without one simply has none.
    return {
      // Resolves relative URLs (e.g. a page's uploaded OG image) against this
      // store's own origin rather than Next's localhost default.
      metadataBase: new URL(origin),
      title: trans?.metaTitle || trans?.name || store.name,
      description: trans?.metaDescription || trans?.description || store.description,
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

  let store: Store;
  try {
    store = await storefront.getStore(storeSlug) as Store;
  } catch {
    notFound();
  }

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

  // Navigation menus the creator built — chrome sections resolve a menu key
  // to its items via storeContext.menus. Soft-fail to an empty list.
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
    is_active?: boolean;
    thumbnail_url?: string | null;
    translations: { locale: string; name: string }[];
    children?: RawCreatorCategory[];
  }
  let creatorCategoriesRaw: RawCreatorCategory[] = [];
  try {
    creatorCategoriesRaw = (await storefront.getCreatorCategories(
      storeSlug,
    )) as RawCreatorCategory[];
  } catch {
    creatorCategoriesRaw = [];
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
  const fontFamily = store.theme?.fontFamily;
  const typography = store.theme?.typography || {};
  const headerCfg = store.theme?.header || {};
  const showStoreName = headerCfg.showStoreName !== false;
  const logoSize = typeof headerCfg.logoSize === 'number' && headerCfg.logoSize > 0 ? headerCfg.logoSize : 32;
  const primaryLocale = store.language_config?.primary_locale || 'en';
  const secondaryLocales = store.language_config?.secondary_locales || [];

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
    ['--store-secondary', secondaryColor],
  ]
    .map(([k, v]) => `  ${k}: ${cssSafe(String(v))};`)
    .join('\n')}\n}`;

  // Scope typography under `.store-root main` so colors don't leak into the
  // dark-bg footer (text-white) or into the dashboard. The header has its own
  // rule because it lives outside <main>. `.store-overlay` covers the portaled
  // cart drawer, which is visually part of the store but not a DOM descendant.
  const typographyCss = [
    typoBlock('.store-root main h1, .store-root main h2, .store-root main h3, .store-root main h4, .store-root main h5, .store-root main h6', typography.heading),
    typoBlock('.store-root main p, .store-root main li, .store-root main span', typography.body),
    typoBlock('.store-root main button', typography.button),
    typoBlock('.store-root main a', typography.link),
    typoBlock('.store-root header, .store-root header *', typography.header),
    typoBlock('.store-overlay p, .store-overlay li, .store-overlay span', typography.body),
    typoBlock('.store-overlay button', typography.button),
    typoBlock('.store-overlay a', typography.link),
  ].filter(Boolean).join('\n');

  // Combine every font the user has selected so the browser actually loads them.
  // Theme fonts come first so they're always loaded; legacy per-element fonts
  // are appended so existing stores keep their custom typography.
  const fontsHref = buildGoogleFontsHref([
    ...themeFonts,
    fontFamily,
    typography.heading?.fontFamily,
    typography.body?.fontFamily,
    typography.button?.fontFamily,
    typography.link?.fontFamily,
    typography.header?.fontFamily,
  ]);

  // If URL had a locale prefix use it; otherwise fall back to the store's primary locale
  const currentLang = urlLocale || primaryLocale;

  // Resolve translated store name and description for current locale
  const storeTranslations = store.theme?.translations || {};
  const localeTrans = storeTranslations[currentLang];
  const storeName = localeTrans?.name || store.name;
  const storeDescription = localeTrans?.description || store.description;

  // Published static pages forwarded to header and footer
  const pages = store.pages ?? [];

  // Platform legal pages (Privacy / Terms / Refund / Shipping). Fetched here
  // so the footer renders them with the same localized titles the admin
  // published. Soft-fail to an empty list so a transient API hiccup never
  // blanks the storefront.
  let platformLegalPages: LegalPageSummary[] = [];
  try {
    const all = await legal.list(currentLang);
    const bySlug = new Map(all.map((p) => [p.slug, p] as const));
    platformLegalPages = LEGAL_SLUGS
      .map((slug) => bySlug.get(slug))
      .filter((p): p is LegalPageSummary => !!p);
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
  const navCollections: NavCollection[] = creatorCategoriesRaw
    .filter((c) => c.is_active !== false)
    .map((c) => ({
      slug: c.slug,
      title: resolveCollectionTitle(c.translations, c.slug),
      thumbnailUrl: c.thumbnail_url ?? null,
      children: (c.children || [])
        .filter((ch) => ch.is_active !== false)
        .map((ch) => ({
          slug: ch.slug,
          title: resolveCollectionTitle(ch.translations, ch.slug),
          thumbnailUrl: ch.thumbnail_url ?? null,
        })),
    }));

  // Social and contact info from store theme
  const socials = store.theme?.socials;
  const contact = store.theme?.contact;

  // JSON-LD: Organization + WebSite. Embedded at the storefront root so every
  // page inside this store inherits them. The url is the store's subdomain
  // (custom_domain wins) — never the internal /store/{slug} path.
  const storeUrl = buildStoreOrigin(storeSlug, (store as { custom_domain?: string | null }).custom_domain || null);
  const sameAs = [socials?.instagram, socials?.facebook, socials?.twitter, socials?.tiktok, socials?.youtube]
    .filter((u): u is string => !!u && /^https?:\/\//i.test(u));
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
    searchUrlTemplate: `${storeUrl}/products?search={search_term_string}`,
  });

  // Load i18n messages for store pages (locale resolved via request.ts fallback)
  const messages = await getMessages();

  return (
    <NextIntlClientProvider locale={currentLang} messages={messages}>
      <StoreProviders locale={currentLang} storeId={store.id} storeCurrency={store.currency}>
        {fontsHref && (
          <>
            <link rel="preconnect" href="https://fonts.googleapis.com" />
            <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
            <link rel="stylesheet" href={fontsHref} />
          </>
        )}
        {/* Emitted outside .store-root so body-level portals inherit the theme. */}
        <style dangerouslySetInnerHTML={{ __html: rootVarsCss }} />
        <div
          dir={currentLang === 'ar' ? 'rtl' : 'ltr'}
          lang={currentLang}
          data-theme={activeTheme.key}
          className="store-root min-h-screen flex flex-col"
          style={{
            ...themeCssVars,
            // Page background + text follow the active theme (was hard-coded
            // white/gray, which kept the storefront light on every theme).
            backgroundColor: 'var(--theme-colors-background)',
            color: 'var(--theme-colors-text)',
            '--store-primary': primaryColor,
            '--store-secondary': secondaryColor,
            '--store-logo-size': `${logoSize}px`,
            ...(fontFamily ? { fontFamily: `"${fontFamily}", system-ui, sans-serif` } : {}),
          } as React.CSSProperties}
        >
          {typographyCss && (
            <style dangerouslySetInnerHTML={{ __html: typographyCss }} />
          )}
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
            };

            const headerSections = publishedHeader?.snapshot?.sections;
            const footerSections = publishedFooter?.snapshot?.sections;

            const headerSlot =
              headerSections && headerSections.length > 0 ? (
                <div id="store-nav-header" style={{ display: 'contents' }}>
                  <SectionRenderer
                    theme={activeTheme}
                    sections={headerSections}
                    locale={currentLang}
                    storeSlug={storeSlug}
                    primaryLocale={primaryLocale}
                    storeContext={storeCtx}
                    chrome
                  />
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
                  />
                </div>
              );

            const footerSlot =
              footerSections && footerSections.length > 0 ? (
                <div id="store-nav-footer">
                  <SectionRenderer
                    theme={activeTheme}
                    sections={footerSections}
                    locale={currentLang}
                    storeSlug={storeSlug}
                    primaryLocale={primaryLocale}
                    storeContext={storeCtx}
                    chrome
                  />
                </div>
              ) : (
                <div id="store-nav-footer">
                  <StoreFooter
                    storeName={storeName}
                    primaryColor={primaryColor}
                    pages={pages}
                    platformLegalPages={platformLegalPages}
                    socials={socials}
                    contact={contact}
                    currentLang={currentLang}
                    primaryLocale={primaryLocale}
                  />
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
      </Sto