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
