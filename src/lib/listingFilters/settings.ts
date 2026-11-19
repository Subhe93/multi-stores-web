// Product listing settings of a store: `theme_customizations.listing`.
// Opt-in like the product card: absent (or not a plain object) means the
// /products and collection pages render exactly as before. Present (even
// empty) means the filtered listing with the defaults below.
//
// Pure module (no React, no server-only import): read by the routes, the
// builder section and tests. The dashboard mirrors these value sets
// (lib/listing-settings.ts there).

export const LISTING_FILTER_KEYS = ['collection', 'type', 'price', 'availability', 'color', 'size'] as const;
export const LISTING_DENSITIES = [2, 3, 4] as const;
export const LISTING_MOBILE_DENSITIES = [1, 2] as const;
export const LISTING_STYLES = ['bar', 'rail'] as const;

export type ListingFilterKey = (typeof LISTING_FILTER_KEYS)[number];
export type ListingDensity = (typeof LISTING_DENSITIES)[number];
export type ListingMobileDensity = (typeof LISTING_MOBILE_DENSITIES)[number];
export type ListingStyle = (typeof LISTING_STYLES)[number];

/** The object as stored (every key optional). */
export interface ListingSettingsStored {
  /** Filters shown, in this order. Absent = all of them. */
  filters?: ListingFilterKey[];
  /** Default desktop columns. */
  density?: ListingDensity;
  /** Default phone columns. */
  mobile_density?: ListingMobileDensity;
  /** Desktop layout: a top bar of dropdowns, or a side rail. */
  style?: ListingStyle;
  /** Shoppers may switch the columns (default on). */
  density_switch?: boolean;
}

/** The settings with every default applied. */
export interface ListingSettings {
  filters: ListingFilterKey[];
  density: ListingDensity;
  mobileDensity: ListingMobileDensity;
  style: ListingStyle;
  densitySwitch: boolean;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Resolve a stored `listing` object; null when the store did not opt in. */
export function resolveListingSettings(stored: unknown): ListingSettings | null {
  if (!isRecord(stored)) return null;
  const filters = Array.isArray(stored.filters)
    ? stored.filters.filter(
        (f, i, all): f is ListingFilterKey =>
          (LISTING_FILTER_KEYS as readonly unknown[]).includes(f) && all.indexOf(f) === i,
      )
    : [...LISTING_FILTER_KEYS];
  const density = (LISTING_DENSITIES as readonly unknown[]).includes(stored.density)
    ? (stored.density as ListingDensity)
    : 4;
  const mobileDensity = (LISTING_MOBILE_DENSITIES as readonly unknown[]).includes(stored.mobile_density)
    ? (stored.mobile_density as ListingMobileDensity)
    : 2;
  const style = (LISTING_STYLES as readonly unknown[]).includes(stored.style) ? (stored.style as ListingStyle) : 'bar';
  return { filters, density, mobileDensity, style, densitySwitch: stored.density_switch !== false };
}

/** The store's listing settings from its `theme_customizations` (any shape). */
export function readListingSettings(customizations: unknown): ListingSettings | null {
  if (!isRecord(customizations)) return null;
  return resolveListingSettings(customizations.listing);
}
