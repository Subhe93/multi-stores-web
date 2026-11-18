// Utilities for merging theme tokens with creator customizations and converting
// them into CSS custom properties that get injected into the storefront root.

import type { CSSProperties } from 'react';
import type { ColorTokens, FontFamilies, ProductTokens, ThemeCustomizations, ThemeTokens } from './types';
import { isUnreadable, readableTextOn } from '@/lib/readableText';
import { arabicFontOrNull } from '@/lib/arabicFonts';

type ContrastKey = 'primaryContrast' | 'secondaryContrast' | 'accentContrast';
const CONTRAST_PAIRS: [ContrastKey, 'primary' | 'secondary' | 'accent'][] = [
  ['primaryContrast', 'primary'],
  ['secondaryContrast', 'secondary'],
  ['accentContrast', 'accent'],
];

const filled = (v: unknown): v is string => typeof v === 'string' && v.trim() !== '';

/** Swatch shape: only the two known values; anything else = the theme's (round). */
export function mergeProduct(base?: ProductTokens, custom?: Partial<ProductTokens>): ProductTokens {
  const shape = custom?.swatchShape;
  return { swatchShape: shape === 'square' || shape === 'circle' ? shape : base?.swatchShape ?? 'circle' };
}

/**
 * Merge colours and resolve the text-on-colour tokens. A contrast colour the
 * store set explicitly always wins; otherwise the theme's own value is kept
 * while its background is untouched, and a customised background gets a
 * computed readable colour (dark on light, white on dark).
 */
export function mergeColors(base: ColorTokens, custom?: Partial<ColorTokens>): ColorTokens {
  const colors: ColorTokens = { ...base };
  // Blank strings mean "automatic" / "not set".
  for (const [k, v] of Object.entries(custom || {})) {
    if (filled(v)) (colors as unknown as Record<string, string>)[k] = v;
  }
  for (const [contrastKey, bgKey] of CONTRAST_PAIRS) {
    const explicit = custom?.[contrastKey];
    if (filled(explicit) && !isUnreadable(explicit, colors[bgKey])) continue;
    const bgCustomised = filled(custom?.[bgKey]) && custom![bgKey] !== base[bgKey];
    const themeValue = base[contrastKey];
    colors[contrastKey] =
      !bgCustomised && filled(themeValue) && !isUnreadable(themeValue, colors[bgKey])
        ? themeValue
        : readableTextOn(colors[bgKey]);
  }
  return colors;
}

/**
 * Text colour for the legacy `--store-primary` fill, which may differ from the
 * token primary (store.theme.primaryColor). An explicit primaryContrast wins.
 */
export function storePrimaryContrast(
  storePrimary: string,
  tokens: ThemeTokens,
  customizations?: ThemeCustomizations,
): string {
  // Explicit / theme values win only while still readable on this fill.
  const explicit = customizations?.colors?.primaryContrast;
  if (filled(explicit) && !isUnreadable(explicit, storePrimary)) return explicit;
  const themeValue = tokens.colors.primaryContrast;
  if (storePrimary === tokens.colors.primary && filled(themeValue) && !isUnreadable(themeValue, storePrimary)) {
    return themeValue;
  }
  return readableTextOn(storePrimary);
}

const FONT_SLOTS = ['heading', 'body'] as const;

/**
 * The Arabic-script fonts that take effect, per slot: an allow-listed family
 * (lib/arabicFonts.ts) that differs from the slot's own Latin family. The
 * sources are read in order and the first valid value of a slot wins. Null
 * when no slot is left, so callers add nothing at all for a store that has
 * not set one.
 */
function arabicFamilies(
  latin: FontFamilies,
  ...sources: (Partial<Record<keyof FontFamilies, unknown>> | undefined)[]
): Partial<FontFamilies> | null {
  const out: Partial<FontFamilies> = {};
  for (const slot of FONT_SLOTS) {
    for (const source of sources) {
      const family = arabicFontOrNull(source?.[slot]);
      if (!family) continue;
      if (family !== latin[slot]) out[slot] = family;
      break;
    }
  }
  return out.heading || out.body ? out : null;
}

// A px string, like the sibling radius tokens (0px to 9999px).
const BUTTON_RADIUS_RE = /^\d{1,4}px$/;

/** The theme button radius when it is a valid px string, else null (unset). */
export function buttonRadiusOrNull(raw: unknown): string | null {
  return typeof raw === 'string' && BUTTON_RADIUS_RE.test(raw) ? raw : null;
}

/**
 * Deep-merge `customizations` over `base`. Only known token shapes are merged;
 * unknown keys are ignored to keep the contract strict.
 */
export function mergeTokens(base: ThemeTokens, customizations?: ThemeCustomizations): ThemeTokens {
  if (!customizations) return { ...base, colors: mergeColors(base.colors), product: mergeProduct(base.product) };
  const fontFamily = { ...base.typography.fontFamily, ...(customizations.typography?.fontFamily || {}) };
  // Optional: the key is added only when a slot holds a valid Arabic font, so
  // a store without one gets the same token object as before.
  const fontFamilyArabic = arabicFamilies(
    fontFamily,
    customizations.typography?.fontFamilyArabic,
    base.typography.fontFamilyArabic,
  );
  const radius = { ...base.spacing.radius, ...(customizations.spacing?.radius || {}) };
  // Optional button radius: anything but a plain px value means "not set".
  if ('button' in radius && !buttonRadiusOrNull(radius.button)) delete radius.button;
  return {
    colors: mergeColors(base.colors, customizations.colors),
    product: mergeProduct(base.product, customizations.product),
    typography: {
      fontFamily,
      scale: { ...base.typography.scale, ...(customizations.typography?.scale || {}) },
      lineHeight: { ...base.typography.lineHeight, ...(customizations.typography?.lineHeight || {}) },
      fontWeight: { ...base.typography.fontWeight, ...(customizations.typography?.fontWeight || {}) },
      ...(fontFamilyArabic ? { fontFamilyArabic } : {}),
    },
    spacing: {
      radius,
      shadow: { ...base.spacing.shadow, ...(customizations.spacing?.shadow || {}) },
      containerMaxWidth: customizations.spacing?.containerMaxWidth ?? base.spacing.containerMaxWidth,
    },
  };
}

/**
 * Flatten resolved tokens into a `style` object of CSS custom properties.
 * Naming convention: `--theme-<group>-<key>` so theme components reference them
 * consistently (e.g. `var(--theme-colors-primary)`).
 */
// Turn a fixed rem heading size into a fluid clamp() so large headings scale
// down gracefully on small screens without a media query in every section.
// max = the token value; min ≈ 64% of it; preferred grows with viewport width.
function fluidRem(rem: number): string {
  const max = rem;
  const min = Math.max(1, +(rem * 0.64).toFixed(3));
  const base = +(rem * 0.5).toFixed(3);
  return `clamp(${min}rem, ${base}rem + 2.2vw, ${max}rem)`;
}

/**
 * Font stack of one slot. The Latin family is always first, so every
 * character it can draw still comes from it; the optional Arabic family sits
 * behind it and only draws what the Latin font lacks. Without an Arabic
 * family the string is the one this variable always had.
 */
function fontStack(latin: string, arabic?: string): string {
  return arabic ? `"${latin}", "${arabic}", system-ui, sans-serif` : `"${latin}", system-ui, sans-serif`;
}

export function tokensToCssVars(tokens: ThemeTokens): CSSProperties {
  // Validated again here: tokens may not have gone through mergeTokens.
  const arabic = arabicFamilies(tokens.typography.fontFamily, tokens.typography.fontFamilyArabic);
  const vars: Record<string, string> = {
    '--theme-colors-primary': tokens.colors.primary,
    '--theme-colors-secondary': tokens.colors.secondary,
    '--theme-colors-accent': tokens.colors.accent,
    '--theme-colors-background': tokens.colors.background,
    '--theme-colors-surface': tokens.colors.surface,
    '--theme-colors-text': tokens.colors.text,
    '--theme-colors-muted': tokens.colors.muted,
    '--theme-colors-border': tokens.colors.border,
    // Text on primary/secondary/accent fills; fall back to a computed colour
    // when tokens did not go through mergeTokens.
    '--theme-colors-primaryContrast': tokens.colors.primaryContrast || readableTextOn(tokens.colors.primary),
    '--theme-colors-secondaryContrast': tokens.colors.secondaryContrast || readableTextOn(tokens.colors.secondary),
    '--theme-colors-accentContrast': tokens.colors.accentContrast || readableTextOn(tokens.colors.accent),
    '--theme-font-heading': fontStack(tokens.typography.fontFamily.heading, arabic?.heading),
    '--theme-font-body': fontStack(tokens.typography.fontFamily.body, arabic?.body),
    '--theme-scale-h1': fluidRem(tokens.typography.scale.h1),
    '--theme-scale-h2': fluidRem(tokens.typography.scale.h2),
    '--theme-scale-h3': fluidRem(tokens.typography.scale.h3),
    '--theme-scale-h4': `${tokens.typography.scale.h4}rem`,
    '--theme-scale-h5': `${tokens.typography.scale.h5}rem`,
    '--theme-scale-h6': `${tokens.typography.scale.h6}rem`,
    '--theme-scale-body': `${tokens.typography.scale.body}rem`,
    '--theme-scale-small': `${tokens.typography.scale.small}rem`,
    '--theme-line-heading': String(tokens.typography.lineHeight.heading),
    '--theme-line-body': String(tokens.typography.lineHeight.body),
    '--theme-weight-heading': String(tokens.typography.fontWeight.heading),
    '--theme-weight-body': String(tokens.typography.fontWeight.body),
    '--theme-weight-bold': String(tokens.typography.fontWeight.bold),
    // Tighter tracking pairs with the larger headline scale for a premium feel.
    '--theme-tracking-heading': '-0.02em',
    '--theme-radius-sm': tokens.spacing.radius.sm,
    '--theme-radius-md': tokens.spacing.radius.md,
    '--theme-radius-lg': tokens.spacing.radius.lg,
    '--theme-radius-full': tokens.spacing.radius.full,
    '--theme-shadow-sm': tokens.spacing.shadow.sm,
    '--theme-shadow-md': tokens.spacing.shadow.md,
    '--theme-shadow-lg': tokens.spacing.shadow.lg,
    '--theme-container-max': tokens.spacing.containerMaxWidth,
    // Colour swatches (variant options + personalization palettes): a store
    // setting, so one choice restyles every swatch on the product page.
    '--theme-swatch-radius': tokens.product?.swatchShape === 'square' ? '0.5rem' : '9999px',
  };
  // Price colour only when set: consumers fall back to their own primary
  // (`var(--theme-colors-price, var(--theme-colors-primary))`).
  if (tokens.colors.price) vars['--theme-colors-price'] = tokens.colors.price;
  // Text links (fallback: the price colour, then primary).
  if (tokens.colors.link) vars['--theme-colors-link'] = tokens.colors.link;
  // Optional sale-badge colour; its label is readable automatically.
  if (tokens.colors.sale) {
    vars['--theme-colors-sale'] = tokens.colors.sale;
    vars['--theme-colors-saleContrast'] = tokens.colors.saleContrast || readableTextOn(tokens.colors.sale);
  }
  // Optional highlight behind prices (marker look: dark price on a brand colour).
  const priceBg = tokens.colors.priceBg?.trim();
  if (priceBg && /^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\))$/i.test(priceBg)) {
    vars['--theme-price-bg'] = priceBg;
    vars['--theme-price-pad'] = '0.05em 0.35em';
  }
  // Optional thin outline-like shadow around prices (e.g. yellow price, black edge).
  // Only a plain colour value is accepted (it is spliced into a shadow).
  const shadow = tokens.colors.priceShadow?.trim();
  if (shadow && /^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\))$/i.test(shadow)) {
    vars['--theme-price-shadow'] = `0 0 1px ${shadow}`;
  }
  // Optional button radius, last so the order of the other variables is
  // untouched. Read by themeButtonCss below and by the newer sections
  // (`var(--theme-radius-button, var(--theme-radius-full))`).
  const buttonRadius = buttonRadiusOrNull(tokens.spacing.radius.button);
  if (buttonRadius) vars['--theme-radius-button'] = buttonRadius;
  return vars as CSSProperties;
}

/**
 * The buttons that follow the theme button radius: the call-to-action links
 * of the sections below, and the newsletter form's input wrapper + submit
 * button (designed as a pair). `data-section-key` is set by SectionRenderer
 * on every section wrapper.
 */
export const THEME_BUTTON_SELECTORS = [
  '.store-root [data-section-key="hero-banner"] a',
  '.store-root [data-section-key="hero-split"] a',
  '.store-root [data-section-key="image-with-text"] a',
  '.store-root [data-section-key="call-to-action"] a',
  '.store-root [data-section-key="newsletter-signup"] form>*',
] as const;

/**
 * One rule that makes those buttons follow `--theme-radius-button`, or '' when
 * the store has not set one (then no <style> is rendered at all).
 *
 * The sections keep their inline `border-radius: var(--theme-radius-full)`
 * (the classic theme uses `--theme-radius-sm`), so their HTML is the same for
 * every store; the rule re-scopes those two variables on the buttons only. A
 * per-section corner radius is an inline `border-radius: Npx` and still wins.
 */
export function themeButtonCss(tokens: ThemeTokens): string {
  if (!buttonRadiusOrNull(tokens.spacing.radius.button)) return '';
  return `${THEME_BUTTON_SELECTORS.join(',')}{--theme-radius-full:var(--theme-radius-button);--theme-radius-sm:var(--theme-radius-button)}`;
}

/**
 * Returns the unique set of Google Fonts referenced by a token set so the
 * storefront layout can inject a single Google Fonts <link>.
 */
export function tokenFonts(tokens: ThemeTokens): string[] {
  return Array.from(new Set([
    tokens.typography.fontFamily.heading,
    tokens.typography.fontFamily.body,
  ]));
}

/**
 * The Arabic-script families of a token set (unique, heading first), added to
 * the same font request. Empty for a store that has not set one, so its
 * request is unchanged.
 */
export function tokenArabicFonts(tokens: ThemeTokens): string[] {
  const arabic = arabicFamilies(tokens.typography.fontFamily, tokens.typography.fontFamilyArabic);
  if (!arabic) return [];
  return Array.from(new Set([arabic.heading, arabic.body].filter((f): f is string => !!f)));
}

/**
 * The validated Arabic-script family of each slot (the same rule as
 * tokensToCssVars), or null for a store that has not set one.
 */
export function tokenArabicFamilies(tokens: ThemeTokens): Partial<FontFamilies> | null {
  return arabicFamilies(tokens.typography.fontFamily, tokens.typography.fontFamilyArabic);
}

/**
 * One rule that adds the Arabic body family to the font of <body> itself, or
 * '' without one (then no <style> is rendered at all). Text outside the theme
 * layout (the mobile menu drawer, lightboxes, the preview bar, the consent
 * banner and dialog) inherits the body font, not `--theme-font-body`.
 *
 * The stack mirrors the body rule of globals.css with the family placed
 * after its Latin font. The family comes from the allow-list, so it is safe
 * inside CSS.
 */
export function arabicBodyCss(tokens: ThemeTokens): string {
  const family = tokenArabicFamilies(tokens)?.body;
  if (!family) return '';
  return `body{font-family:'Inter',"${family}",system-ui,-apple-system,sans-serif}`;
}
