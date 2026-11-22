// Swatch and size readers of the card model. OWNER: builder W2.
//
// Both read the list payload only (variants with their options, stock and
// active flag, plus the option display config) and follow the product page
// picker: the same option order, the same colour rules (lib/swatches), the
// same notion of "can be bought". Pure module, safe on server and client.

import { isColorOptionKey, isSizeOptionKey } from '@/lib/optionKeys';
import { swatchConfiguredImage, swatchCssColor, swatchDualColor, type SwatchMaps } from '@/lib/swatches';
import { optionValueLabel, type VariantOptionLabels } from '@/lib/variantOptionLabels';
import {
  CARD_SIZE_MAX,
  CARD_SWATCH_MAX,
  type CardSizes,
  type CardSourceRow,
  type CardSwatch,
  type CardSwatches,
  type CardVariantRow,
} from './model';

interface CardOptionConfig extends SwatchMaps {
  name: string;
  style?: string;
  values?: string[];
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** The option display config as an ordered list (array or keyed object in the payload). */
function readConfigs(raw: unknown): CardOptionConfig[] {
  const out: CardOptionConfig[] = [];
  if (Array.isArray(raw)) {
    for (const c of raw) {
      if (isRecord(c) && typeof c.name === 'string' && c.name) out.push(c as unknown as CardOptionConfig);
    }
  } else if (isRecord(raw)) {
    for (const [name, c] of Object.entries(raw)) {
      if (isRecord(c)) out.push({ ...(c as object), name } as CardOptionConfig);
    }
  }
  return out;
}

/** A variant the storefront offers at all (hidden variants never reach a card). */
function isActive(v: CardVariantRow): boolean {
  return v.is_active !== false;
}

/** Active and not sold out; unknown stock counts as in stock (as the picker). */
function isPurchasable(v: CardVariantRow): boolean {
  return isActive(v) && (typeof v.stock !== 'number' || v.stock > 0);
}

interface OptionGroup {
  name: string;
  values: string[];
  config?: CardOptionConfig;
}

/**
 * The options of the product's active variants, arranged as the seller set
 * them up. The variant `options` column is jsonb (no key order) and values
 * would otherwise come in variant-creation order, so the config drives both
 * levels; whatever it does not mention is appended.
 */
function optionGroups(row: CardSourceRow): { groups: OptionGroup[]; variants: CardVariantRow[] } {
  const variants = (row.variants ?? []).filter(isActive);
  const discovered = new Map<string, string[]>();
  for (const v of variants) {
    for (const [key, value] of Object.entries(v.options ?? {})) {
      if (typeof value !== 'string' || !value) continue;
      const list = discovered.get(key) ?? [];
      if (!list.includes(value)) list.push(value);
      discovered.set(key, list);
    }
  }

  const groups: OptionGroup[] = [];
  const placed = new Set<string>();
  for (const config of readConfigs(row.variant_option_config)) {
    const values = discovered.get(config.name);
    if (!values || placed.has(config.name)) continue;
    placed.add(config.name);
    const configured = Array.isArray(config.values) ? config.values : [];
    groups.push({
      name: config.name,
      config,
      values: [...configured.filter((v) => values.includes(v)), ...values.filter((v) => !configured.includes(v))],
    });
  }
  for (const [name, values] of discovered) {
    if (!placed.has(name)) groups.push({ name, values });
  }
  return { groups, variants };
}

/** How one colour value is drawn, or null when nothing resolves. */
function toSwatch(config: CardOptionConfig | undefined, value: string): CardSwatch | null {
  if (config?.style === 'image') {
    const image = swatchConfiguredImage(config, value);
    if (image) return { value, image };
  }
  const dual = swatchDualColor(config, value);
  if (Array.isArray(dual) && dual[0] && dual[1]) return { value, css: dual[0], css2: dual[1] };
  const css = swatchCssColor(config, value);
  return css ? { value, css } : null;
}

/** `{ label }` when the value has a display label (M159), else nothing (unchanged shape). */
function labelOf(labels: VariantOptionLabels | null | undefined, name: string, value: string): { label?: string } {
  const label = optionValueLabel(labels, name, value);
  return label !== value ? { label } : {};
}

/** Colour values of the product's colour option, or null without one. */
export function cardSwatches(row: CardSourceRow, labels?: VariantOptionLabels | null): CardSwatches | null {
  const { groups } = optionGroups(row);
  // The colour option as the product page sees it: styled as colours by the
  // seller, or named like one.
  const group =
    groups.find((g) => g.config?.style === 'color') ?? groups.find((g) => isColorOptionKey(g.name));
  if (!group || group.values.length === 0) return null;

  const total = group.values.length;
  const resolved = group.values.map((value) => toSwatch(group.config, value));
  // One value without a colour or image: a row of dots would misreport the
  // range, so the card prints "N colours" instead (empty items, total set).
  if (resolved.some((s) => s === null)) return { items: [], more: 0, total };

  const items = (resolved as CardSwatch[])
    .slice(0, CARD_SWATCH_MAX)
    .map((s) => ({ ...s, ...labelOf(labels, group.name, s.value) }));
  return { items, more: total - items.length, total };
}

/** Values of the product's size option with their availability, or null without one. */
export function cardSizes(row: CardSourceRow, labels?: VariantOptionLabels | null): CardSizes | null {
  const { groups, variants } = optionGroups(row);
  const group = groups.find((g) => isSizeOptionKey(g.name));
  if (!group || group.values.length === 0) return null;

  const all = group.values.map((value) => ({
    value,
    available: variants.some((v) => v.options?.[group.name] === value && isPurchasable(v)),
    ...labelOf(labels, group.name, value),
  }));
  const items = all.slice(0, CARD_SIZE_MAX);
  return { items, more: all.length - items.length };
}
