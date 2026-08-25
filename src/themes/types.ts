// Theme registry types. Themes are defined in code and referenced by `theme_key`
// in the Store table. Creators override individual tokens via `theme_customizations`.

import type { ComponentType, ReactNode } from 'react';
import type { HeroPageConfig } from '@/lib/hero';

export type LocalizedString = Record<string, string>;

// ── Design tokens ──────────────────────────────────────────────

export interface ColorTokens {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  surface: string;
  text: string;
  muted: string;
  border: string;
  // Optional dark-mode counterparts; themes may opt in.
  primaryContrast?: string;
}

export interface FontFamilies {
  heading: string;
  body: string;
}

export interface TypographyTokens {
  fontFamily: FontFamilies;
  // Multipliers applied to a 16px base (e.g. 2.5 → 40px).
  scale: {
    h1: number;
    h2: number;
    h3: number;
    h4: number;
    h5: number;
    h6: number;
    body: number;
    small: number;
  };
  lineHeight: {
    heading: number;
    body: number;
  };
  fontWeight: {
    heading: number;
    body: number;
    bold: number;
  };
}

export interface SpacingTokens {
  radius: {
    sm: string;
    md: string;
    lg: string;
    full: string;
  };
  shadow: {
    sm: string;
    md: string;
    lg: string;
  };
  containerMaxWidth: string;
}

export interface ThemeTokens {
  colors: ColorTokens;
  typography: TypographyTokens;
  spacing: SpacingTokens;
}

// Deep-partial of tokens; what creators store as `theme_customizations`.
export type ThemeCustomizations = {
  colors?: Partial<ColorTokens>;
  typography?: {
    fontFamily?: Partial<FontFamilies>;
    scale?: Partial<TypographyTokens['scale']>;
    lineHeight?: Partial<TypographyTokens['lineHeight']>;
    fontWeight?: Partial<TypographyTokens['fontWeight']>;
  };
  spacing?: {
    radius?: Partial<SpacingTokens['radius']>;
    shadow?: Partial<SpacingTokens['shadow']>;
    containerMaxWidth?: string;
  };
};

// ── Section schema ─────────────────────────────────────────────

export type FieldType =
  | 'text'
  | 'textarea'
  | 'richtext'
  | 'number'
  | 'boolean'
  | 'color'
  | 'image'
  | 'url'
  | 'select'
  | 'menuPicker'
  | 'productPicker'
  | 'collectionPicker'
  | 'repeater';

export interface FieldDefinition {
  key: string;
  type: FieldType;
  label: LocalizedString;
  description?: LocalizedString;
  required?: boolean;
  defaultValue?: unknown;
  // type-specific options
  maxLength?: number;
  min?: number;
  max?: number;
  options?: { value: string; label: LocalizedString }[]; // for `select`
  fields?: FieldDefinition[]; // for `repeater`
  // Conditional visibility inside a repeater — show only when sibling `key`'s
  // value is in `in`. Mirrors the dashboard FieldDefinition.
  showIf?: { key: string; in: string[] };
}

export interface SectionSchema {
  id: string;
  label: LocalizedString;
  icon?: string;
  category: 'showcase' | 'content' | 'commerce' | 'social' | 'layout' | 'header' | 'footer';
  description?: LocalizedString;
  // Keys from `schema` that hold translatable content (per-locale).
  // Everything else lives in `settings` (single value across locales).
  translatable: string[];
  schema: FieldDefinition[];
  // Page types where this section can be added. Defaults to "everywhere
  // except HEADER/FOOTER" so chrome-specific sections (header-bar, footer-
  // columns) don't pollute regular HOME/STATIC/LANDING palettes, and
  // page-content sections (hero, products, etc.) don't pollute the chrome
  // palettes. Omit on chrome-only sections and pass ['HEADER'] or ['FOOTER'].
  pageTypes?: Array<
    'HOME' | 'STATIC' | 'LANDING' | 'PRODUCT_TEMPLATE' | 'HEADER' | 'FOOTER' | 'CATALOG_TEMPLATE' | 'COLLECTION_TEMPLATE'
  >;
}

export interface SectionInstance {
  id: string;
  section_key: string;
  settings: Record<string, unknown>;
  sort_order: number;
  is_hidden?: boolean;
  // Per-locale content rows. Array form matches what the API serialises and
  // what's stored in version snapshots, so we don't have to convert at every
  // boundary. The renderer picks one row per request.
  translations: Array<{ locale: string; content: Record<string, unknown> }>;
}

// Lightweight shape of a product for magic sections to consume. Mirrors the
// shape returned by `GET /storefront/:slug/products/:productSlug`. Kept loose
// (Record<string, unknown> values) so storefront API tweaks don't break themes.
export interface ProductContext {
  id: string;
  base_price: number;
  compare_at_price?: number;
  translations: Array<{ locale: string; title?: string; description?: string; slug?: string }>;
  images: Array<{ url: string; alt_text?: string | null; sort_order?: number }>;
  variants?: Array<{
    id: string;
    price: number;
    compare_at_price?: number;
    stock?: number;
    sku?: string;
    variant_values?: Array<{ option_name: string; option_value: string }>;
  }>;
  faqs?: Array<{ translations: Array<{ locale: string; question?: string; answer?: string }> }>;
  // Catch-all so themes can read fields we haven't typed yet without ts-errors.
  [extra: string]: unknown;
}

// ── Listing context (CATALOG_TEMPLATE / COLLECTION_TEMPLATE) ───────
// Mirrors what the /products and /collections/[handle] routes already load.
// The route computes everything (filtering, sorting, hero config) and the
// `product-listing` magic section only renders it — exactly like `product`
// for PRODUCT_TEMPLATE. Kept loose (index signature) so storefront API tweaks
// don't break themes.

export interface ListingProduct {
  id: string;
  base_price: number;
  compare_at_price?: number;
  created_at?: string;
  translations: Array<{ locale: string; title?: string; slug?: string }>;
  images: Array<{ url: string }>;
  promotions?: unknown[];
  [extra: string]: unknown;
}

export interface ListingCollection {
  id: string;
  slug: string;
  is_active?: boolean;
  thumbnail_url?: string | null;
  translations: Array<{ locale: string; name: string; description?: string | null }>;
  children?: ListingCollection[];
}

export interface ListingContext {
  kind: 'catalog' | 'collection';
  /** Already filtered + sorted by the route. */
  products: ListingProduct[];
  /** Creator category TREE (catalog: for pills; collection: for children lookup). */
  collections: ListingCollection[];
  /** The current collection (kind === 'collection'). */
  collection?: ListingCollection;
  query: { search?: string; sort?: string; category?: string; creator_category?: string };
  /** store.theme.hero.products | .collections (raw, unresolved). */
  hero?: HeroPageConfig;
  /** '/products' or `/collections/${handle}` (no locale prefix). */
  basePath: string;
  isFiltered: boolean;
}

// A single navigation menu item. `parent_id` enables nesting (dropdowns /
// mega-menu groups); flat menus leave it null. `label_i18n` holds per-locale
// label overrides; `label` is the primary-locale value + fallback.
export interface NavMenuItem {
  id: string;
  parent_id?: string | null;
  label: string;
  label_i18n?: Record<string, string>;
  url: string;
  open_in_new_tab?: boolean;
}

// A named navigation menu the creator built once and references by `key`
// from chrome sections.
export interface NavMenu {
  id: string;
  key: string;
  name: string;
  items: NavMenuItem[];
}

// Global store context — populated only when StoreLayout renders chrome
// (HEADER / FOOTER) sections. Regular page sections leave it undefined since
// they don't need to know about store-wide nav or logos.
export interface StoreContext {
  storeName: string;
  storeDescription?: string;
  logoUrl?: string;
  primaryLocale: string;
  secondaryLocales: string[];
  /** Published static pages — used by header nav / footer link fallback. */
  pages: Array<{ slug: string; translations: { locale: string; title: string }[] }>;
  /** Navigation menus keyed by their `key`. Chrome sections look up a menu
   *  by the key the creator selected, then render its items. */
  menus?: NavMenu[];
}

/** Resolve a menu's items by key from a StoreContext. When `locale` is
 *  passed, each item's `label` is resolved to the locale-specific value
 *  (`label_i18n[locale]`) falling back to the base `label`. Returns [] when
 *  the key is missing so callers can fall back to their inline items. */
export function resolveMenuItems(
  ctx: StoreContext | undefined,
  key: string | undefined,
  locale?: string,
): NavMenuItem[] {
  if (!ctx?.menus || !key) return [];
  const items = ctx.menus.find((m) => m.key === key)?.items ?? [];
  if (!locale) return items;
  return items.map((it) => ({
    ...it,
    label: it.label_i18n?.[locale] || it.label,
  }));
}

// Props passed by the storefront renderer to every section component.
// `product` is populated for sections rendered inside a PRODUCT_TEMPLATE page
// or any context where the current product is known. Magic sections read from
// it; regular sections ignore it.
export interface SectionRenderProps {
  settings: Record<string, unknown>;
  content: Record<string, unknown>;
  locale: string;
  // Store's primary locale. Sections that build URLs use it to keep the
  // canonical form (no `?lang=`) for the primary locale and add it only for
  // secondary locales — matching the product page's own canonical convention.
  primaryLocale: string;
  storeSlug: string;
  product?: ProductContext;
  // Populated for sections rendered inside a CATALOG_TEMPLATE /
  // COLLECTION_TEMPLATE page. Only the `product-listing` magic section reads it.
  listing?: ListingContext;
  currency?: string;
  // Populated by StoreLayout when rendering HEADER / FOOTER chrome. Undefined
  // for page sections — they shouldn't depend on global store data.
  storeContext?: StoreContext;
}

export interface SectionDefinition {
  schema: SectionSchema;
  Component: ComponentType<SectionRenderProps>;
  // Defaults used when the section is added from the palette.
  defaultSettings?: Record<string, unknown>;
  defaultContent?: Record<string, unknown>;
}

// ── Theme definition ───────────────────────────────────────────

export interface ThemeLayoutProps {
  storeSlug: string;
  locale: string;
  storeName: string;
  storeDescription?: string;
  logoUrl?: string;
  children: ReactNode;
  // Hooks for storefront-supplied chrome (header dropdowns, footer pages, etc.)
  headerSlot?: ReactNode;
  footerSlot?: ReactNode;
}

export interface Theme {
  key: string;
  label: LocalizedString;
  description: LocalizedString;
  previewImage?: string;
  tokens: ThemeTokens;
  // Sections available to this theme (keys map to `sections[key]`).
  sections: Record<string, SectionDefinition>;
  // Default sections inserted when a creator first picks this theme on a Home page.
  defaultHomeSections: Array<{ section_key: string; settings?: Record<string, unknown>; content?: Record<string, unknown> }>;
  // The theme's outer layout (header + footer + page chrome).
  Layout: ComponentType<ThemeLayoutProps>;
}

export type ThemeRegistry = Record<string, Theme>;
