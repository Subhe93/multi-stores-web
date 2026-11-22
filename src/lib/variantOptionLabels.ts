/**
 * M159: display labels of variant option names / values per locale.
 *
 * Mirror of the API's src/common/catalog/variant-option-labels.ts (read
 * side) — keep in step. Canonical keys (variant options, selections, carts,
 * orders, image maps, facet values, URLs) are always the store primary-locale
 * strings; labels only change the text a shopper reads. A missing label falls
 * back to the canonical string, never to another locale.
 */

export interface VariantOptionLabels {
  names?: Record<string, string>;
  values?: Record<string, Record<string, string>>;
}

export interface OptionDisplayEntry {
  name: string;
  value: string;
  name_label: string;
  value_label: string;
}

export interface OptionsDisplaySnapshot {
  locale: string;
  entries: OptionDisplayEntry[];
}

export interface LabelRow {
  locale: string;
  variant_option_labels?: unknown;
}

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const hasOwn = (o: object, k: string): boolean => Object.prototype.hasOwnProperty.call(o, k);

const baseLanguage = (locale: string) => locale.split(/[-_]/)[0].toLowerCase();

/** Defensive parse of the stored column: drops non-strings and empty maps. */
export function readVariantOptionLabels(raw: unknown): VariantOptionLabels | null {
  if (!isPlainObject(raw)) return null;
  const names: Record<string, string> = {};
  if (isPlainObject(raw.names)) {
    for (const [k, v] of Object.entries(raw.names)) if (typeof v === 'string' && v !== '') names[k] = v;
  }
  const values: Record<string, Record<string, string>> = {};
  if (isPlainObject(raw.values)) {
    for (const [name, map] of Object.entries(raw.values)) {
      if (!isPlainObject(map)) continue;
      const inner: Record<string, string> = {};
      for (const [k, v] of Object.entries(map)) if (typeof v === 'string' && v !== '') inner[k] = v;
      if (Object.keys(inner).length > 0) values[name] = inner;
    }
  }
  const out: VariantOptionLabels = {};
  if (Object.keys(names).length > 0) out.names = names;
  if (Object.keys(values).length > 0) out.values = values;
  return out.names || out.values ? out : null;
}

/**
 * Labels of `locale` from a product's translation rows: the exact row, else
 * the row of its base language (`de-AT` -> `de`). Never another language.
 */
export function labelsForLocale(
  rows: readonly LabelRow[] | null | undefined,
  locale: string | null | undefined,
): VariantOptionLabels | null {
  if (!rows || !locale) return null;
  const exact = rows.find((r) => r.locale === locale);
  if (exact) {
    const parsed = readVariantOptionLabels(exact.variant_option_labels);
    if (parsed) return parsed;
  }
  const base = baseLanguage(locale);
  const baseRow = rows.find((r) => r.locale !== locale && r.locale.toLowerCase() === base);
  return baseRow ? readVariantOptionLabels(baseRow.variant_option_labels) : null;
}

export function optionNameLabel(labels: VariantOptionLabels | null | undefined, name: string): string {
  const l = labels?.names;
  return l && hasOwn(l, name) && l[name] ? l[name] : name;
}

export function optionValueLabel(
  labels: VariantOptionLabels | null | undefined,
  name: string,
  value: string,
): string {
  const map = labels?.values && hasOwn(labels.values, name) ? labels.values[name] : null;
  return map && hasOwn(map, value) && map[value] ? map[value] : value;
}

/** One entry per option of the map, in map order. */
export function optionDisplayEntries(
  options: unknown,
  labels: VariantOptionLabels | null | undefined,
): OptionDisplayEntry[] {
  if (!isPlainObject(options)) return [];
  const out: OptionDisplayEntry[] = [];
  for (const [name, raw] of Object.entries(options)) {
    if (raw === null || raw === undefined) continue;
    const value = typeof raw === 'string' ? raw : String(raw as number);
    out.push({
      name,
      value,
      name_label: optionNameLabel(labels, name),
      value_label: optionValueLabel(labels, name, value),
    });
  }
  return out;
}

/** `"Farbe: Schwarz / Größe: M"` (the cart / order line format). */
export function formatOptionPairs(entries: readonly OptionDisplayEntry[]): string {
  return entries.map((e) => `${e.name_label}: ${e.value_label}`).join(' / ');
}

export function readOptionsDisplaySnapshot(raw: unknown): OptionsDisplaySnapshot | null {
  if (!isPlainObject(raw) || typeof raw.locale !== 'string' || !Array.isArray(raw.entries)) return null;
  const entries: OptionDisplayEntry[] = [];
  for (const e of raw.entries) {
    if (!isPlainObject(e) || typeof e.name !== 'string' || typeof e.value !== 'string') continue;
    entries.push({
      name: e.name,
      value: e.value,
      name_label: typeof e.name_label === 'string' && e.name_label !== '' ? e.name_label : e.name,
      value_label: typeof e.value_label === 'string' && e.value_label !== '' ? e.value_label : e.value,
    });
  }
  return entries.length > 0 ? { locale: raw.locale, entries } : null;
}

/**
 * The order line's options as the buyer saw them at purchase (the display
 * snapshot, whatever the current page locale), else null (canonical text).
 */
export function orderLineOptionsLabel(snapshot: unknown): string | null {
  const snap = readOptionsDisplaySnapshot(snapshot);
  return snap ? formatOptionPairs(snap.entries) : null;
}

/** Minimal structural shape of a personalization line (core `PLine`). */
export interface RelabelableLine {
  source: string;
  field_id?: string | null;
  label: string;
  value: string;
  display_value: string;
  field_name: string;
  meta?: { option_name?: string } | null;
  i18n?: {
    label: Record<string, string> | null;
    display_value: Record<string, string> | null;
    group_label?: unknown;
  };
}

/**
 * Relabels personalization `source: 'OPTION'` lines for `locale` (same rule
 * as the API, so guest and signed-in carts match): `label` / `display_value`
 * and the `locale` keys of `i18n`; `value`, `field_name`, `meta.option_name`
 * and the primary-locale i18n keys stay canonical. No-op without labels or
 * for the primary locale.
 */
export function relabelOptionLines<T extends RelabelableLine>(
  lines: readonly T[],
  labels: VariantOptionLabels | null | undefined,
  locale: string | null | undefined,
  primaryLocale: string | null | undefined,
  /**
   * Field defs of the lines (flat or tree). With them, COLOR_PALETTE FIELD
   * lines whose palette is a product option are relabelled too.
   */
  defs?: readonly RelabelableFieldDef[] | null,
): T[] {
  if (!labels || !locale || (primaryLocale && locale === primaryLocale)) return lines.slice();
  const fieldDefs = indexFieldDefs(defs);
  return lines.map((line) => {
    if (line.source === 'FIELD') return relabelPaletteLine(line, fieldDefs, labels, locale, primaryLocale);
    if (line.source !== 'OPTION') return line;
    const name = line.meta?.option_name ?? line.field_name;
    const nameLabel = optionNameLabel(labels, name);
    const valueLabel = optionValueLabel(labels, name, line.value);
    if (nameLabel === name && valueLabel === line.value) return line;
    const i18n = line.i18n
      ? {
          ...line.i18n,
          label: { ...(line.i18n.label ?? {}), [locale]: nameLabel },
          display_value: { ...(line.i18n.display_value ?? {}), [locale]: valueLabel },
        }
      : line.i18n;
    return { ...line, label: nameLabel, display_value: valueLabel, i18n };
  });
}

/** Minimal structural shape of a personalization field def (core `PFieldDef`). */
export interface RelabelableFieldDef {
  id: string;
  type: string;
  ui?: unknown;
  translations?: readonly ({ locale: string; option_labels?: unknown } | null)[] | null;
  children?: readonly RelabelableFieldDef[] | null;
}

/** The product option a COLOR_PALETTE field takes its palette from, else null. */
export function paletteSourceOption(def: RelabelableFieldDef): string | null {
  if (def.type !== 'COLOR_PALETTE' || !isPlainObject(def.ui)) return null;
  const option = def.ui.palette_from_option;
  return typeof option === 'string' && option !== '' ? option : null;
}

/**
 * Product option label of a palette value, for a COLOR_PALETTE field whose
 * palette is a product option (`ui.palette_from_option`) and which has no own
 * label of that value for `locale` (exact translation row, as the evaluator
 * reads it). Null = keep the field's own text.
 */
export function paletteValueLabel(
  def: RelabelableFieldDef,
  labels: VariantOptionLabels | null | undefined,
  locale: string | null | undefined,
  value: string,
): string | null {
  const option = paletteSourceOption(def);
  if (!option || !labels || !locale) return null;
  const own = (def.translations ?? []).find((t) => t && t.locale === locale);
  if (own && isPlainObject(own.option_labels)) {
    const l = own.option_labels[value];
    if (typeof l === 'string' && l !== '') return null;
  }
  const label = optionValueLabel(labels, option, value);
  return label === value ? null : label;
}

function indexFieldDefs(
  defs: readonly RelabelableFieldDef[] | null | undefined,
): Map<string, RelabelableFieldDef> {
  const out = new Map<string, RelabelableFieldDef>();
  const add = (list: readonly RelabelableFieldDef[] | null | undefined) => {
    for (const d of list ?? []) {
      if (!d || typeof d.id !== 'string' || out.has(d.id)) continue;
      out.set(d.id, d);
      add(d.children);
    }
  };
  add(defs);
  return out;
}

/**
 * A palette FIELD line with the product option's label of `locale`:
 * `display_value` and `i18n.display_value[locale]`. `value` stays canonical
 * and the primary-locale key keeps (or gets) the canonical text for staff.
 */
function relabelPaletteLine<T extends RelabelableLine>(
  line: T,
  fieldDefs: Map<string, RelabelableFieldDef>,
  labels: VariantOptionLabels,
  locale: string,
  primaryLocale: string | null | undefined,
): T {
  const def = line.field_id ? fieldDefs.get(line.field_id) : undefined;
  const valueLabel = def ? paletteValueLabel(def, labels, locale, line.value) : null;
  if (valueLabel === null) return line;
  const prev = line.i18n?.display_value ?? null;
  const display: Record<string, string> = { ...(prev ?? {}) };
  if (primaryLocale && !hasOwn(display, primaryLocale)) display[primaryLocale] = line.value;
  display[locale] = valueLabel;
  const i18n = line.i18n ? { ...line.i18n, display_value: display } : line.i18n;
  return { ...line, display_value: valueLabel, i18n };
}
