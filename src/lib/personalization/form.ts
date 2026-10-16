/**
 * Storefront personalization form helpers (M4.0 WP-C). Pure, React-free code
 * behind `usePersonalizationFields`: maps the storefront product's custom
 * fields to the form model, runs the shared validator (rules.ts) and turns its
 * issues — and coded API errors — into localized messages.
 *
 * Products without custom fields produce no form fields and the same payload
 * as before M4.0 (G0).
 */
import {
  charCount,
  readLinkedValidation,
  readValidationRules,
  resolveLinkTarget,
  validatePersonalization,
  type FieldDef,
} from './rules';
import {
  resolveCustomFieldLabel,
  resolveCustomFieldTranslation,
  type CustomFieldTranslationLike,
} from '@/lib/customFields';

/** A custom field as the storefront product payload carries it. */
export interface StorefrontCustomField {
  id: string;
  type: string;
  is_required?: boolean;
  required?: boolean;
  name?: string | null;
  sort_order?: number | null;
  translations?: CustomFieldTranslationLike[] | null;
  options?: unknown;
  validation_rules?: unknown;
  linked_validation?: unknown;
}

/** The product fields the personalization form reads. */
export interface PersonalizationProduct {
  custom_fields?: StorefrontCustomField[] | null;
  /** Creator-filled values (custom products). */
  field_values?: { custom_field_id: string; value?: string | null; file_url?: string | null }[] | null;
}

/** Resolved link of a field to its sibling (K3: target = sibling field name). */
export interface FormFieldLink {
  type: 'equal_length' | 'max_combined';
  targetId: string;
  targetLabel: string;
  fillChar?: string;
  max?: number;
}

/** Form model consumed by `CustomFieldsForm`. */
export interface FormField {
  id: string;
  type: 'TEXT' | 'NUMBER' | 'SELECT' | 'COLOR' | 'TEXTAREA' | 'BOOLEAN' | 'DATE' | 'IMAGE' | 'FILE' | 'FONT' | 'MULTI_IMAGE';
  label: string;
  placeholder?: string;
  required: boolean;
  options?: string[];
  /** Localized display label per raw option value; the submitted value stays raw. */
  optionLabels?: Record<string, string>;
  validation?: { min?: number; max?: number; pattern?: string };
  /** `allowed_chars` character-class body; TEXT/TEXTAREA input drops other characters. */
  allowedChars?: string;
  linked?: FormFieldLink;
}

/** "label: value" line kept on the cart line (same shape as `CartCustomFieldDisplay`). */
export interface FieldDisplayLine {
  id: string;
  label: string;
  value: unknown;
  display?: string | null;
}

/** ICU params accepted by next-intl. */
export type MessageParams = Record<string, string | number>;
export type Translate = (key: string, params?: MessageParams) => string;

/** Creator-filled values keyed by field id (value wins over file_url). */
export function prefilledValues(product: PersonalizationProduct): Record<string, string> {
  const out: Record<string, string> = {};
  for (const fv of product.field_values ?? []) {
    if (fv.value) out[fv.custom_field_id] = fv.value;
    else if (fv.file_url) out[fv.custom_field_id] = fv.file_url;
  }
  return out;
}

/** Initial form values: the creator-filled ones (custom products). */
export function initialFieldValues(product: PersonalizationProduct): Record<string, unknown> {
  return { ...prefilledValues(product) };
}

/** Field definitions for the shared validator. */
export function toFieldDefs(product: PersonalizationProduct): FieldDef[] {
  return (product.custom_fields ?? []).map((f) => ({
    id: f.id,
    name: f.name ?? '',
    type: f.type,
    is_required: f.is_required ?? f.required ?? false,
    options: f.options,
    validation_rules: f.validation_rules,
    linked_validation: f.linked_validation,
    sort_order: f.sort_order ?? 0,
  }));
}

/**
 * Visible form fields (creator-filled ones are hidden and sent as-is). Labels
 * use locale → store primary → 'en' → first, never the field id.
 */
export function mapFormFields(
  product: PersonalizationProduct,
  locale: string,
  primaryLocale: string,
): FormField[] {
  const fields = product.custom_fields ?? [];
  if (fields.length === 0) return [];
  const prefilled = prefilledValues(product);
  const defs = toFieldDefs(product);
  const labelOf = (f: StorefrontCustomField) => resolveCustomFieldLabel(f, locale, primaryLocale);

  return fields
    .filter((field) => !(field.id in prefilled))
    .map((field) => {
      const tr = resolveCustomFieldTranslation(field, locale, primaryLocale);
      const raw = (field.validation_rules ?? null) as Record<string, unknown> | null;
      const rules = readValidationRules(field.validation_rules);
      const mapped: FormField = {
        id: field.id,
        type: field.type as FormField['type'],
        required: field.is_required ?? field.required ?? false,
        label: labelOf(field),
        placeholder: tr?.placeholder ?? undefined,
        options: Array.isArray(field.options) ? (field.options as string[]) : undefined,
        optionLabels: tr?.option_labels ?? undefined,
        validation: raw
          ? { min: rules.min_length, max: rules.max_length, pattern: rules.pattern }
          : undefined,
      };
      if (rules.allowed_chars && (field.type === 'TEXT' || field.type === 'TEXTAREA')) {
        mapped.allowedChars = rules.allowed_chars;
      }
      const link = readLinkedValidation(field.linked_validation);
      const self = defs.find((d) => d.id === field.id);
      const target = link && self ? resolveLinkTarget(link, defs, self) : null;
      if (link && target) {
        const targetField = fields.find((f) => f.id === target.id);
        mapped.linked = {
          type: link.type,
          targetId: target.id,
          targetLabel: targetField ? labelOf(targetField) : target.name,
          ...(link.type === 'equal_length' && link.fill_char ? { fillChar: link.fill_char } : {}),
          ...(link.type === 'max_combined' ? { max: link.max } : {}),
        };
      }
      return mapped;
    });
}

/**
 * Cart payload and display lines — the exact output of the pre-M4.0 inline
 * code in ProductDetailClient: field ids as keys, '' and null/undefined
 * dropped, `undefined` when no value was ever set.
 */
export function buildCartPayload(
  values: Record<string, unknown>,
  formFields: FormField[],
): { fields?: Record<string, unknown>; display?: FieldDisplayLine[] } {
  if (Object.keys(values).length === 0) return {};
  const fields = Object.fromEntries(Object.entries(values).filter(([, v]) => v !== '' && v != null));
  const display = Object.entries(fields).map(([fieldId, value]) => {
    const def = formFields.find((f) => f.id === fieldId);
    return {
      id: fieldId,
      label: def?.label || fieldId,
      value,
      display: typeof value === 'string' && def?.optionLabels ? def.optionLabels[value] ?? null : null,
    };
  });
  return { fields, display };
}

/** Runs the shared validator over the current form values. */
export function validateFormValues(product: PersonalizationProduct, values: Record<string, unknown>) {
  return validatePersonalization({
    fields: toFieldDefs(product),
    values,
    prefilled: prefilledValues(product),
  });
}

/** Keeps only finite numbers and strings (next-intl ICU arguments). */
function icuParams(raw: unknown): MessageParams {
  const out: MessageParams = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === 'string' || (typeof v === 'number' && Number.isFinite(v))) out[k] = v;
  }
  return out;
}

/** A validator issue, or a coded API error about one field. */
export interface IssueLike {
  code: string;
  field_id: string;
  field_name: string;
  params?: object;
}

/** Localized message for one validator issue (`errors.CUSTOM_FIELD_*`). */
export function issueMessage(
  issue: IssueLike,
  labelOf: (fieldId: string) => string | undefined,
  t: Translate,
  labelOfName: (fieldName: string) => string | undefined = () => undefined,
): string {
  const params = icuParams(issue.params);
  params.label = labelOf(issue.field_id) || issue.field_name || '';
  // `target` is the sibling's internal name; show its label instead.
  if (typeof params.target === 'string') params.target = labelOfName(params.target) || params.target;
  return t(`errors.${issue.code}`, params);
}

/** First message per field id, in issue order (payload issues under `_form`). */
export function fieldErrorsFrom(
  issues: IssueLike[],
  product: PersonalizationProduct,
  locale: string,
  primaryLocale: string,
  t: Translate,
): Record<string, string> {
  const fields = product.custom_fields ?? [];
  const label = (f: StorefrontCustomField | undefined) =>
    f ? resolveCustomFieldLabel(f, locale, primaryLocale) : undefined;
  const labelOf = (id: string) => label(fields.find((f) => f.id === id));
  const labelOfName = (name: string) => label(fields.find((f) => f.name === name));
  const out: Record<string, string> = {};
  for (const issue of issues) {
    const key = issue.field_id || '_form';
    if (out[key] === undefined) out[key] = issueMessage(issue, labelOf, t, labelOfName);
  }
  return out;
}

/** Field-level API error (K2: rules enforced on add-to-cart, coded errors carry the field). */
export interface FieldApiError {
  code: string;
  fieldId: string;
  message: string;
}

const FIELD_ERROR_PREFIXES = ['CUSTOM_FIELD_', 'CUSTOMER_UPLOAD_'];

/**
 * Maps a coded API error (`{code, params, field_id, field_name}` copied by
 * `api()`) to a localized message on one of this product's fields. Returns
 * null when the error is not about a field of this product.
 */
export function fieldErrorFromApi(
  err: unknown,
  product: PersonalizationProduct,
  locale: string,
  primaryLocale: string,
  t: Translate,
  has: (key: string) => boolean,
): FieldApiError | null {
  const e = err as { code?: unknown; field_id?: unknown; field_name?: unknown; params?: unknown } | null;
  const code = typeof e?.code === 'string' ? e.code : '';
  if (!FIELD_ERROR_PREFIXES.some((p) => code.startsWith(p))) return null;
  const fieldId = typeof e?.field_id === 'string' ? e.field_id : '';
  const field = (product.custom_fields ?? []).find((f) => f.id === fieldId);
  if (!field || !has(`errors.${code}`)) return null;
  const messages = fieldErrorsFrom(
    [
      {
        code,
        field_id: fieldId,
        field_name: typeof e?.field_name === 'string' ? e.field_name : field.name ?? '',
        params: icuParams(e?.params),
      },
    ],
    product,
    locale,
    primaryLocale,
    t,
  );
  return { code, fieldId, message: messages[fieldId] ?? '' };
}

/**
 * Removes characters an `allowed_chars` body rejects (namez behaviour: the
 * input simply refuses them). Variation selectors are always kept — they are
 * ignored by the rule (K4). Returns the input unchanged for an invalid body.
 */
export function filterAllowedChars(value: string, re: RegExp | null): string {
  if (!re) return value;
  let out = '';
  for (const ch of Array.from(value.normalize('NFC'))) {
    if (ch === '\uFE0E' || ch === '\uFE0F' || re.test(ch)) out += ch;
  }
  return out;
}

/**
 * True for a usable fill char: exactly one character as `charCount` counts it
 * (one code point once variation selectors are removed), so `❤️` with VS16
 * qualifies. The API enforces the same rule on the link.
 */
function isSingleFillChar(fillChar: string | undefined): fillChar is string {
  return typeof fillChar === 'string' && charCount(fillChar) === 1;
}

/**
 * Fields whose equal_length link can be fixed with "Fill with <char>" right
 * now: both texts set, lengths differ, and the shorter one is editable.
 * Returns `fieldId → fill char` for the field carrying the link.
 */
export function fillableFields(
  formFields: FormField[],
  values: Record<string, unknown>,
  prefilled: Record<string, string>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of formFields) {
    const link = f.linked;
    if (!link || link.type !== 'equal_length' || !isSingleFillChar(link.fillChar)) continue;
    const own = values[f.id];
    const other = values[link.targetId];
    if (typeof own !== 'string' || typeof other !== 'string' || !own.trim() || !other.trim()) continue;
    const a = charCount(own.trim());
    const b = charCount(other.trim());
    if (a === b) continue;
    const shorterId = a < b ? f.id : link.targetId;
    if (shorterId in prefilled) continue;
    out[f.id] = link.fillChar;
  }
  return out;
}

/**
 * Pads the shorter of a linked pair with the fill char so both have the same
 * length (the dashboard's "auto-fill" promise). Returns the changed values.
 */
export function padLinkedPair(
  formField: FormField,
  values: Record<string, unknown>,
): Record<string, string> {
  const link = formField.linked;
  const fillChar = link?.type === 'equal_length' ? link.fillChar : undefined;
  if (!link || !isSingleFillChar(fillChar)) return {};
  const own = values[formField.id];
  const other = values[link.targetId];
  if (typeof own !== 'string' || typeof other !== 'string') return {};
  const ownText = own.trim();
  const otherText = other.trim();
  const a = charCount(ownText);
  const b = charCount(otherText);
  if (a === b) return {};
  // Lengths are compared by `charCount`, so one fill char (VS included) adds
  // exactly one counted character per repeat.
  const [id, text, missing] = a < b ? [formField.id, ownText, b - a] : [link.targetId, otherText, a - b];
  return { [id]: text + fillChar.repeat(missing) };
}
