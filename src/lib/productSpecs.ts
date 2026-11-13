// Product specifications (attributes) helpers, ported from
// ProductDetailClient.renderAttrValue and its specifications-tab label logic.
// ProductDetailClient is intentionally not refactored onto these helpers (the
// live product page stays untouched); productSpecs.spec.ts pins the outputs
// to the monolith's rules instead.

export interface ProductAttributeLike {
  id: string;
  value: unknown;
  template?: {
    name: string;
    type?: string;
    unit?: string;
    translations?: Array<{ locale?: string; label: string }>;
  } | null;
}

/** Label of an attribute: the locale's label, then the first label, then the template name. */
export function attrLabel(attr: ProductAttributeLike, locale: string): string {
  return (
    attr.template?.translations?.find((at) => at.locale === locale)?.label ||
    attr.template?.translations?.[0]?.label ||
    attr.template?.name ||
    ''
  );
}

/**
 * Display text of an attribute value. COLOR values return the colour itself
 * (callers draw the swatch next to it, see `attrSwatchColor`).
 */
export function formatAttrValue(attr: ProductAttributeLike, words: { yes: string; no: string }): string {
  const type = attr.template?.type;
  const val = attr.value;
  const unit = attr.template?.unit;
  if (type === 'COLOR' && typeof val === 'string') return val;
  if (type === 'BOOLEAN') return val ? words.yes : words.no;
  if (type === 'DIMENSIONS' && typeof val === 'object' && val !== null) {
    return Object.entries(val as Record<string, unknown>).map(([, v]) => `${v}${unit || ''}`).join(' × ');
  }
  if (type === 'MULTI_SELECT' && Array.isArray(val)) return val.join(', ');
  const str = typeof val === 'object' ? JSON.stringify(val) : String(val);
  return unit ? `${str} ${unit}` : str;
}

/** Swatch colour for a COLOR attribute, null for every other type. */
export function attrSwatchColor(attr: ProductAttributeLike): string | null {
  return attr.template?.type === 'COLOR' && typeof attr.value === 'string' ? attr.value : null;
}

// Yes / No in the storefront locales (same words as common.yes / common.no
// in src/i18n/messages). A server section cannot call useTranslations.
const YES_NO: Record<string, { yes: string; no: string }> = {
  en: { yes: 'Yes', no: 'No' },
  ar: { yes: 'نعم', no: 'لا' },
  tr: { yes: 'Evet', no: 'Hayır' },
  de: { yes: 'Ja', no: 'Nein' },
  fr: { yes: 'Oui', no: 'Non' },
  sv: { yes: 'Ja', no: 'Nej' },
};

export function yesNoWords(locale: string): { yes: string; no: string } {
  return YES_NO[locale] || YES_NO[(locale || '').split('-')[0]] || YES_NO.en;
}

/**
 * Find one attribute by key: the template name (case-insensitive), or any of
 * its translated labels. Used by the "product attribute" dynamic source.
 */
export function findAttribute<T extends ProductAttributeLike>(attrs: T[] | undefined | null, key: string): T | null {
  const k = (key || '').trim().toLowerCase();
  if (!k || !attrs?.length) return null;
  return (
    attrs.find((a) => (a.template?.name || '').trim().toLowerCase() === k) ||
    attrs.find((a) => a.template?.translations?.some((t) => (t.label || '').trim().toLowerCase() === k)) ||
    null
  );
}
