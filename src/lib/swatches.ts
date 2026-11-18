// Colour swatch helpers: how an option value becomes a colour or an image.
// Extracted from the product page picker (VariantSelector), which imports
// them back; the product card reads the same rules so a value looks the same
// in a listing and on the product page. Pure module.

export { COLOR_KEYWORDS, isColorOptionKey } from './optionKeys';

export const COLOR_MAP: Record<string, string> = {
  black: '#000000', white: '#ffffff', red: '#ef4444', blue: '#3b82f6',
  green: '#22c55e', yellow: '#eab308', orange: '#f97316', purple: '#a855f7',
  pink: '#ec4899', gray: '#9ca3af', grey: '#9ca3af', brown: '#92400e',
  navy: '#1e3a5f', beige: '#f5f5dc', gold: '#d97706', silver: '#c0c0c0',
  teal: '#14b8a6', cyan: '#06b6d4', coral: '#f97171', cream: '#fffdd0',
  ivory: '#fffff0', khaki: '#c3b091', lavender: '#c4b5fd', maroon: '#7f1d1d',
  olive: '#65a30d', turquoise: '#2dd4bf', wine: '#722f37', charcoal: '#374151',
  mint: '#6ee7b7', peach: '#fdba74', rose: '#fb7185', salmon: '#fa8072', tan: '#d2b48c',
  'أسود': '#000000', 'أبيض': '#ffffff', 'أحمر': '#ef4444', 'أزرق': '#3b82f6',
  'أخضر': '#22c55e', 'أصفر': '#eab308', 'برتقالي': '#f97316', 'بنفسجي': '#a855f7',
  'وردي': '#ec4899', 'رمادي': '#9ca3af', 'بني': '#92400e',
};

/** CSS colour of a value by its name or literal (hex / rgb / hsl), or null. */
export function resolveColor(value: string): string | null {
  const mapped = COLOR_MAP[value.toLowerCase()];
  if (mapped) return mapped;
  if (/^#([0-9a-f]{3,8})$/i.test(value)) return value;
  if (/^(rgb|hsl)/i.test(value)) return value;
  return null;
}

export function isLightColor(hex: string): boolean {
  const c = hex.replace('#', '');
  if (c.length < 6) return true;
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 200;
}

/** The swatch maps of an option's display config (set in the dashboard). */
export interface SwatchMaps {
  colorMap?: Record<string, string>;
  dualColorMap?: Record<string, [string, string]>;
  // Value-level image (one per option value, e.g. per colour).
  imageMap?: Record<string, string>;
  // Swatch-only image per value: drawn in the swatch, never the product image.
  swatchMap?: Record<string, string>;
}

/** The two colours of a two-colour value, if the seller set them. */
export function swatchDualColor(config: SwatchMaps | undefined | null, value: string): [string, string] | undefined {
  return config?.dualColorMap?.[value];
}

/** CSS colour of a value: the seller's colour first, else by its name. */
export function swatchCssColor(config: SwatchMaps | undefined | null, value: string): string | null {
  return config?.colorMap?.[value] || resolveColor(value);
}

/** Configured image of a value: the swatch image first, then the value image. */
export function swatchConfiguredImage(config: SwatchMaps | undefined | null, value: string): string | undefined {
  return config?.swatchMap?.[value] ?? config?.imageMap?.[value];
}

/** CSS `background` of a two-colour swatch (diagonal split). */
export function dualColorBackground(pair: [string, string]): string {
  return `linear-gradient(135deg, ${pair[0]} 50%, ${pair[1]} 50%)`;
}
