// Locale resolution for product custom fields (labels, placeholders and
// per-option display labels). Pure helpers, safe on server and client.

export interface CustomFieldTranslationLike {
  locale: string;
  label: string;
  placeholder?: string | null;
  /** Display label per raw option value (`Record<optionValue, displayLabel>`). */
  option_labels?: Record<string, string> | null;
}

export interface CustomFieldLike {
  id?: string;
  /** Internal creator-facing name; used as a last-resort visible label. */
  name?: string | null;
  translations?: CustomFieldTranslationLike[] | null;
}

/**
 * Pick the best translation for a custom field.
 * Chain: exact `locale` → store `primaryLocale` → 'en' → first translation → null.
 */
export function resolveCustomFieldTranslation<T extends CustomFieldTranslationLike>(
  field: { translations?: T[] | null } | null | undefined,
  locale?: string,
  primaryLocale?: string,
): T | null {
  const translations = field?.translations;
  if (!translations?.length) return null;
  const candidates = [locale, primaryLocale, 'en'].filter(
    (l, i, arr): l is string => !!l && arr.indexOf(l) === i,
  );
  for (const candidate of candidates) {
    const match = translations.find((t) => t.locale === candidate);
    if (match) return match;
  }
  return translations[0] ?? null;
}

/**
 * Visible label for a custom field. Never falls back to the field id:
 * translation label → `field.name` → ''.
 */
export function resolveCustomFieldLabel(
  field: CustomFieldLike | null | undefined,
  locale?: string,
  primaryLocale?: string,
): string {
  const translation = resolveCustomFieldTranslation(field, locale, primaryLocale);
  return translation?.label || field?.name || '';
}

/**
 * Display label for a raw option value (select / font / radio-style fields).
 * The submitted value must stay the raw option value; only the display changes.
 */
export function resolveOptionLabel(
  translation: CustomFieldTranslationLike | null | undefined,
  value: string,
): string {
  return translation?.option_labels?.[value] ?? value;
}

// ── Order snapshot (M4.0 §6, C18) ─────────────────────────────────────────
// Order value rows keep a frozen copy of the field (`field_label`,
// `display_value` as `{locale: text}` maps), so renaming or deleting a field
// never rewrites past orders. Mirror of the API's
// `src/common/personalization/snapshot-label.ts`.

/** Customer upload behind a file value (M4.0 §8, order API include). */
export interface OrderFieldUpload {
  id: string;
  preview_url?: string | null;
  original_name?: string | null;
  mime?: string | null;
  width?: number | null;
  height?: number | null;
  purged_at?: string | null;
}

/** An `OrderCustomFieldValue` row as the order API returns it. */
export interface OrderFieldValueRow {
  id?: string;
  custom_field_id?: string | null;
  value?: string | null;
  file_url?: string | null;
  field_name?: string | null;
  field_type?: string | null;
  field_label?: unknown;
  display_value?: unknown;
  sort_order?: number | null;
  /** Live field; null once the field was deleted (snapshot only). */
  custom_field?: (CustomFieldLike & { translations?: CustomFieldTranslationLike[] | null }) | null;
  upload?: OrderFieldUpload | null;
}

function pickLocaleText(map: unknown, locale?: string, primaryLocale?: string): string | null {
  if (!map || typeof map !== 'object' || Array.isArray(map)) return null;
  const m = map as Record<string, unknown>;
  for (const key of [locale, primaryLocale, 'en']) {
    if (key && typeof m[key] === 'string' && m[key]) return m[key] as string;
  }
  for (const v of Object.values(m)) {
    if (typeof v === 'string' && v) return v;
  }
  return null;
}

/**
 * Label and text of an order value row.
 * label: snapshot `field_label` (locale → primary → en → first) → live
 * translation → `field_name` → '—'.
 * value: snapshot `display_value` (same chain) → live option label → `value`
 * → '' (file rows have no text value).
 */
export function snapshotLabel(
  row: OrderFieldValueRow,
  locale?: string,
  primaryLocale?: string,
): { label: string; value: string } {
  const label =
    pickLocaleText(row.field_label, locale, primaryLocale) ||
    resolveCustomFieldLabel(row.custom_field, locale, primaryLocale) ||
    row.field_name ||
    '—';
  let value = pickLocaleText(row.display_value, locale, primaryLocale);
  if (!value && row.value) {
    const tr = resolveCustomFieldTranslation(row.custom_field, locale, primaryLocale);
    value = resolveOptionLabel(tr, row.value);
  }
  return { label, value: value ?? '' };
}

/** Sorts value rows by `sort_order` (missing last), keeping the original order otherwise. */
export function sortOrderFieldValues<T extends Pick<OrderFieldValueRow, 'sort_order'>>(rows: T[]): T[] {
  return rows
    .map((row, i) => ({ row, i }))
    .sort((a, b) => {
      const sa = a.row.sort_order ?? Number.POSITIVE_INFINITY;
      const sb = b.row.sort_order ?? Number.POSITIVE_INFINITY;
      return sa === sb ? a.i - b.i : sa - sb;
    })
    .map((x) => x.row);
}
