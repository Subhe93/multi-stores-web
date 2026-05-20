// Per-page hero/banner settings, stored freeform under `theme_config.hero` and
// surfaced by the storefront API as `store.theme.hero`. Two pages read it: the
// products listing and the collection page. Keeping the shape + resolver here
// avoids drift between the two call sites.

export type HeroHeight = 'sm' | 'md' | 'lg';

export interface HeroPageConfig {
  /** When false, the page renders without the banner entirely. */
  enabled?: boolean;
  /** Optional background image. Falls back to the theme gradient when empty. */
  image_url?: string;
  /** Vertical size of the banner. */
  height?: HeroHeight;
  /** Dark overlay percentage (0–80) painted over the background image. */
  overlay?: number;
  /** Whether to show the product count line. */
  show_count?: boolean;
  /** Hero text color (hex). Defaults to white when empty. */
  text_color?: string;
}

export interface StoreHero {
  products?: HeroPageConfig;
  collections?: HeroPageConfig;
}

// Vertical padding per height preset — mirrors the values the two pages used
// before the setting existed (products: md, collection: lg).
const HEIGHT_CLASS: Record<HeroHeight, string> = {
  sm: 'py-8',
  md: 'py-12 md:py-16',
  lg: 'py-16 md:py-24',
};

export interface ResolvedHero {
  enabled: boolean;
  heightClass: string;
  /** Clamped 0–80, expressed as a 0–1 alpha for rgba(). */
  overlayAlpha: number;
  showCount: boolean;
  imageUrl?: string;
  /** Resolved text color — the configured hex, or white as the default. */
  textColor: string;
}

/**
 * Normalise a raw HeroPageConfig into render-ready values, applying the
 * page-appropriate defaults when fields are absent.
 */
export function resolveHero(
  cfg: HeroPageConfig | undefined,
  defaults: { height: HeroHeight },
): ResolvedHero {
  const height = cfg?.height || defaults.height;
  const overlay = typeof cfg?.overlay === 'number' ? Math.min(80, Math.max(0, cfg.overlay)) : undefined;
  return {
    enabled: cfg?.enabled !== false,
    heightClass: HEIGHT_CLASS[height] || HEIGHT_CLASS.md,
    overlayAlpha: (overlay ?? 10) / 100,
    showCount: cfg?.show_count !== false,
    imageUrl: cfg?.image_url || undefined,
    textColor: cfg?.text_color || '#ffffff',
  };
}
