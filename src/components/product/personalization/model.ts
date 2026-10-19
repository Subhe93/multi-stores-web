/**
 * Personalization app — storefront form model (M4.1 §5). Pure helpers behind
 * `usePersonalizationFields` (advanced mode), `PersonalizationForm`,
 * `VariantCards` and the cart summary. No React, no DOM: unit-tested in
 * model.spec.ts.
 *
 * The evaluator mirror (`@/lib/personalization`) decides visibility, values,
 * errors, lines and price; this module only adapts it to the UI.
 */
import {
  buildPersonalizationGroups,
  charCount,
  compileAllowedChars,
  evaluatePersonalization,
  isAdvancedField,
  isPlainObject,
  normalizeText,
  pickFieldTranslation,
  readLinkedValidation,
  readUi,
  readValidationRules,
  repeaterIndexes,
  resolveLinkTarget,
  splitFieldTree,
  type FieldDef,
  type PContext,
  type PDisplayGroup,
  type PError,
  type PFieldDef,
  type PLine,
  type POptionConfig,
  type PResult,
} from '@multi-stores/core/personalization';
import { issueMessage, type Translate } from '@/lib/personalization/form';

// ---------------------------------------------------------------------------
// Payload blocks
// ---------------------------------------------------------------------------

/** `product.personalization` of the storefront payload (app on, own product). */
export interface StorefrontPersonalization {
  enabled: boolean;
  /** In the request currency; null = no badge. */
  free_shipping_threshold: number | null;
  currency: string | null;
}

/** Reads `product.personalization`; null unless `enabled === true`. */
export function readProductPersonalization(raw: unknown): StorefrontPersonalization | null {
  if (!isPlainObject(raw) || raw.enabled !== true) return null;
  const t = Number(raw.free_shipping_threshold);
  return {
    enabled: true,
    free_shipping_threshold:
      raw.free_shipping_threshold !== null && raw.free_shipping_threshold !== undefined && Number.isFinite(t) && t >= 0
        ? t
        : null,
    currency: typeof raw.currency === 'string' && raw.currency !== '' ? raw.currency : null,
  };
}

/** Public settings of the app (`apps.personalization.settings`, §3.9 whitelist). */
export interface PersonalizationSettings {
  free_shipping_badge: boolean;
  card_price_mode: 'selection' | 'from';
  validation_summary: boolean;
  /** param → field name | 'option:<Name>'. */
  url_prefill: Record<string, string>;
  listing_cta: string;
}

export const DEFAULT_PERSONALIZATION_SETTINGS: PersonalizationSettings = {
  free_shipping_badge: true,
  card_price_mode: 'selection',
  validation_summary: true,
  url_prefill: {},
  listing_cta: 'personalize',
};

/** Lenient read of the public settings; unknown or malformed keys take the defaults. */
export function readPersonalizationSettings(raw: unknown): PersonalizationSettings {
  const s = isPlainObject(raw) ? raw : {};
  const prefill: Record<string, string> = {};
  if (isPlainObject(s.url_prefill)) {
    for (const [k, v] of Object.entries(s.url_prefill)) {
      if (typeof v === 'string' && k.trim() !== '' && v.trim() !== '') prefill[k.trim()] = v.trim();
    }
  }
  return {
    free_shipping_badge: typeof s.free_shipping_badge === 'boolean' ? s.free_shipping_badge : true,
    card_price_mode: s.card_price_mode === 'from' ? 'from' : 'selection',
    validation_summary: typeof s.validation_summary === 'boolean' ? s.validation_summary : true,
    url_prefill: prefill,
    listing_cta: typeof s.listing_cta === 'string' && s.listing_cta !== '' ? s.listing_cta : 'personalize',
  };
}

// ---------------------------------------------------------------------------
// Field tree
// ---------------------------------------------------------------------------

/**
 * True when the product needs the app form: some field (or child) uses an
 * M4.1 feature. Without one, the M4.0 form and payload are kept unchanged.
 */
export function hasAdvancedFields(defs: readonly PFieldDef[] | null | undefined): boolean {
  const walk = (list: readonly PFieldDef[] | null | undefined): boolean =>
    Array.isArray(list) &&
    list.some((d) => !!d && (isAdvancedField(d) || (Array.isArray(d.children) && d.children.length > 0) || walk(d.children)));
  return walk(defs);
}

/** Quick-add rule (§5): a listing should link to the product page instead of adding directly. */
export function needsPersonalization(product: { personalization?: unknown; custom_fields?: unknown }): boolean {
  return (
    readProductPersonalization(product.personalization) !== null &&
    Array.isArray(product.custom_fields) &&
    product.custom_fields.length > 0
  );
}

export type Placement = 'before_variants' | 'after_variants';

/** `ui.placement`; fields without one render after the variants (M4.0 position). */
export function placementOf(def: PFieldDef): Placement {
  return readUi(def.ui).placement === 'before_variants' ? 'before_variants' : 'after_variants';
}

/** Visible top-level fields of one placement, in field order. */
export function visibleFieldsAt(
  defs: readonly PFieldDef[],
  visibleIds: readonly string[],
  placement: Placement,
): PFieldDef[] {
  const visible = new Set(visibleIds);
  return splitFieldTree(defs).top.filter((d) => visible.has(d.id) && placementOf(d) === placement);
}

// ---------------------------------------------------------------------------
// Keys (values, errors, element ids)
// ---------------------------------------------------------------------------

/** Error / element key: the field id, or `<repeaterId>#<index>#<childId>` for a repeater child. */
export function fieldKey(fieldId: string, groupIndex?: number | null, childId?: string | null): string {
  return typeof groupIndex === 'number' && childId ? `${fieldId}#${groupIndex}#${childId}` : fieldId;
}

export function errorKey(e: Pick<PError, 'field_id' | 'group_index' | 'child_id'>): string {
  return fieldKey(e.field_id || '_form', e.group_index, e.child_id);
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

export interface ContextVariant {
  options?: Record<string, string> | null;
  is_active?: boolean | null;
}

/** Option values present on active variants (palette filter, §3.2 COLOR_PALETTE). */
export function activeOptionValues(variants: readonly ContextVariant[] | null | undefined): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const v of variants ?? []) {
    if (!v || v.is_active === false || !isPlainObject(v.options)) continue;
    for (const [name, value] of Object.entries(v.options)) {
      if (typeof value !== 'string') continue;
      const list = (out[name] ??= []);
      if (!list.includes(value)) list.push(value);
    }
  }
  return out;
}

export interface FormContextInput {
  selections: Record<string, string>;
  optionConfig?: POptionConfig[] | null;
  activeOptionValues?: Record<string, string[]>;
  locale: string;
  primaryLocale: string;
}

export function formContext(input: FormContextInput): PContext {
  return {
    appEnabled: true,
    variantOptions: input.selections,
    optionConfig: input.optionConfig ?? null,
    activeOptionValues: input.activeOptionValues,
    locale: input.locale,
    primaryLocale: input.primaryLocale,
  };
}

/** Runs the evaluator on the form values (app mode). */
export function evaluateForm(defs: readonly PFieldDef[], values: Record<string, unknown>, ctx: PContext): PResult {
  return evaluatePersonalization(defs, values, ctx);
}

// ---------------------------------------------------------------------------
// Texts
// ---------------------------------------------------------------------------

export interface FieldText {
  label: string;
  placeholder?: string;
  sublabel?: string;
  note?: string;
  helpText?: string;
  helpImageUrl?: string;
  optionLabels?: Record<string, string>;
}

const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() !== '' ? v : undefined);

/**
 * Form texts of a field from one translation row (locale → primary → en →
 * first), so a page never mixes languages. The help image alone falls back
 * through the chain (images are usually language-neutral, D15).
 */
export function fieldText(def: PFieldDef, locale: string, primaryLocale: string): FieldText {
  const tr = pickFieldTranslation(def.translations, locale, primaryLocale);
  let helpImageUrl = str(tr?.help_image_url);
  if (!helpImageUrl) {
    for (const key of [locale, primaryLocale, 'en']) {
      const row = (def.translations ?? []).find((t) => t && t.locale === key);
      helpImageUrl = str(row?.help_image_url);
      if (helpImageUrl) break;
    }
  }
  const labels = isPlainObject(tr?.option_labels) ? (tr!.option_labels as Record<string, unknown>) : null;
  const optionLabels: Record<string, string> = {};
  if (labels) for (const [k, v] of Object.entries(labels)) if (typeof v === 'string' && v !== '') optionLabels[k] = v;
  return {
    label: str(tr?.label) ?? def.name ?? '',
    placeholder: str(tr?.placeholder),
    sublabel: str(tr?.sublabel),
    note: str(tr?.note),
    helpText: str(tr?.help_text),
    helpImageUrl,
    optionLabels: Object.keys(optionLabels).length > 0 ? optionLabels : undefined,
  };
}

/** Repeater item heading: its label template with `{i}`, else the i18n `personalization.itemN`. */
export function groupHeading(rep: PFieldDef, index: number, locale: string, primaryLocale: string, t: Translate): string {
  const tr = pickFieldTranslation(rep.translations, locale, primaryLocale);
  const tpl = str(tr?.label) ?? str(tr?.display_label);
  return tpl ? tpl.replace(/\{i\}/g, String(index)) : t('personalization.itemN', { i: index });
}

// ---------------------------------------------------------------------------
// Values
// ---------------------------------------------------------------------------

/** Item objects of a repeater value (non-objects read as empty items). */
export function repeaterItems(values: Record<string, unknown>, repId: string): Record<string, unknown>[] {
  const list = values[repId];
  if (!Array.isArray(list)) return [];
  return list.map((it) => (isPlainObject(it) ? it : {}));
}

/** Sets one child value of item `pos` (0-based, = index - start_index). Gaps become `{}`. */
export function withChildValue(
  values: Record<string, unknown>,
  repId: string,
  pos: number,
  childId: string,
  value: unknown,
): Record<string, unknown> {
  const items = repeaterItems(values, repId);
  while (items.length <= pos) items.push({});
  const item = { ...items[pos] };
  if (value === undefined || value === null || value === '') delete item[childId];
  else item[childId] = value;
  items[pos] = item;
  return { ...values, [repId]: items };
}

/**
 * Values to keep after an evaluation (namez clears hidden sets, A L467-475,
 * D L102-104): top-level fields that became hidden lose their value, and
 * repeater items beyond the current count are removed. Returns null when
 * nothing changes (so callers can skip a state update).
 */
export function pruneHidden(
  values: Record<string, unknown>,
  defs: readonly PFieldDef[],
  result: Pick<PResult, 'visibleIds'>,
  ctx: Pick<PContext, 'variantOptions' | 'optionConfig'>,
): Record<string, unknown> | null {
  const { top } = splitFieldTree(defs);
  const visible = new Set(result.visibleIds);
  let next: Record<string, unknown> | null = null;
  const edit = () => (next ??= { ...values });
  for (const def of top) {
    if (!(def.id in values)) continue;
    if (!visible.has(def.id)) {
      delete edit()[def.id];
      continue;
    }
    if (def.type === 'REPEATER' && Array.isArray(values[def.id])) {
      const count = repeaterIndexes(def, ctx).length;
      const list = values[def.id] as unknown[];
      if (list.length > count) {
        if (count === 0) delete edit()[def.id];
        else edit()[def.id] = list.slice(0, count);
      }
    }
  }
  return next;
}

// ---------------------------------------------------------------------------
// Text limits (TextField)
// ---------------------------------------------------------------------------

export interface TextLimits {
  /** Effective max in code points (C14); null = none. */
  max: number | null;
  /** Normalized length of the equal_length target; null when it has no value. */
  targetLength: number | null;
  counter: 'none' | 'own' | 'linked';
  insertChar: string | null;
  uppercase: boolean;
  allowed: RegExp | null;
  allowedBody: string | null;
}

/**
 * Limits of a TEXT/TEXTAREA field. `siblings`/`siblingValues` are the field's
 * sibling set (top level, or one repeater item) for the equal_length target.
 */
// Compiled `allowed_chars` by body (M5 D9): `textLimits` runs on every
// keystroke (the linked length depends on the sibling values), and the regex
// is stateless (no `g` flag), so one instance per body is shared.
const ALLOWED_CHARS_CACHE = new Map<string, RegExp | null>();
const ALLOWED_CHARS_CACHE_MAX = 200;

/** `compileAllowedChars`, memoized by body. */
export function cachedAllowedChars(body: string): RegExp | null {
  const hit = ALLOWED_CHARS_CACHE.get(body);
  if (hit !== undefined) return hit;
  const compiled = compileAllowedChars(body);
  if (ALLOWED_CHARS_CACHE.size >= ALLOWED_CHARS_CACHE_MAX) ALLOWED_CHARS_CACHE.clear();
  ALLOWED_CHARS_CACHE.set(body, compiled);
  return compiled;
}

export function textLimits(
  def: PFieldDef,
  siblings: readonly PFieldDef[],
  siblingValues: Record<string, unknown>,
): TextLimits {
  const ui = readUi(def.ui);
  const rules = readValidationRules(def.validation_rules);
  const link = readLinkedValidation(def.linked_validation);
  let targetLength: number | null = null;
  if (link && link.type === 'equal_length') {
    const target = resolveLinkTarget(link, siblings as unknown as FieldDef[], def as unknown as FieldDef);
    const targetDef = target ? siblings.find((s) => s.id === target.id) : undefined;
    const raw = targetDef ? siblingValues[targetDef.id] : undefined;
    if (targetDef && (typeof raw === 'string' || typeof raw === 'number')) {
      const n = charCount(normalizeText(String(raw), readUi(targetDef.ui).transform));
      targetLength = n > 0 ? n : null;
    }
  }
  let max = typeof rules.max_length === 'number' && rules.max_length > 0 ? rules.max_length : null;
  if (ui.limit_to_target && targetLength !== null) max = max === null ? targetLength : Math.min(max, targetLength);
  const counter = ui.counter === 'linked' ? 'linked' : ui.counter === true ? 'own' : 'none';
  const insertChar = typeof ui.insert_char === 'string' && charCount(ui.insert_char) === 1 ? ui.insert_char : null;
  const allowedBody = rules.allowed_chars ?? null;
  return {
    max,
    targetLength,
    counter,
    insertChar,
    uppercase: ui.transform === 'uppercase',
    allowed: allowedBody ? cachedAllowedChars(allowedBody) : null,
    allowedBody,
  };
}

/** Length shown by the counter (normalized like the evaluator, D7). */
export function displayLength(value: unknown): number {
  return typeof value === 'string' || typeof value === 'number' ? charCount(normalizeText(String(value))) : 0;
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

function labelResolvers(defs: readonly PFieldDef[], locale: string, primaryLocale: string) {
  const { top, childrenOf } = splitFieldTree(defs);
  const all: PFieldDef[] = [...top];
  for (const list of childrenOf.values()) all.push(...list);
  const label = (d: PFieldDef | undefined) => (d ? fieldText(d, locale, primaryLocale).label : undefined);
  return {
    childrenOf,
    labelOf: (id: string) => label(all.find((d) => d.id === id)),
    labelOfName: (name: string, scope?: readonly PFieldDef[]) =>
      label((scope ?? top).find((d) => d.name === name) ?? all.find((d) => d.name === name)),
  };
}

/** Localized text of one evaluator / API error: the creator's message, else `errors.<code>`. */
function errorText(
  e: PError,
  r: ReturnType<typeof labelResolvers>,
  t: Translate,
): { text: string; custom: boolean } {
  if (typeof e.message === 'string' && e.message !== '') return { text: e.message, custom: true };
  const scope = e.child_id ? r.childrenOf.get(e.field_id) : undefined;
  const text = issueMessage(
    {
      code: e.code,
      field_id: e.child_id ?? e.field_id,
      field_name: e.child_name ?? e.field_name,
      params: e.params,
    },
    r.labelOf,
    t,
    (name) => r.labelOfName(name, scope),
  );
  return { text, custom: false };
}

/** First message per error key (`fieldKey`), in error order. */
export function errorMessages(
  errors: readonly PError[],
  defs: readonly PFieldDef[],
  locale: string,
  primaryLocale: string,
  t: Translate,
): Record<string, string> {
  const r = labelResolvers(defs, locale, primaryLocale);
  const out: Record<string, string> = {};
  for (const e of errors) {
    const key = errorKey(e);
    if (out[key] === undefined) out[key] = errorText(e, r, t).text;
  }
  return out;
}

/**
 * Lines of the validation summary ("Vänligen komplettera följande fält:",
 * C1 L78-82): one per error key; i18n messages of repeater children get the
 * item heading as prefix (creator messages already carry "Artikel {i}").
 */
export function summaryMessages(
  errors: readonly PError[],
  defs: readonly PFieldDef[],
  locale: string,
  primaryLocale: string,
  t: Translate,
): { key: string; text: string }[] {
  const r = labelResolvers(defs, locale, primaryLocale);
  const { top } = splitFieldTree(defs);
  const seen = new Set<string>();
  const out: { key: string; text: string }[] = [];
  for (const e of errors) {
    const key = errorKey(e);
    if (seen.has(key)) continue;
    seen.add(key);
    const { text, custom } = errorText(e, r, t);
    const rep = typeof e.group_index === 'number' ? top.find((d) => d.id === e.field_id) : undefined;
    out.push({
      key,
      text: rep && !custom ? `${groupHeading(rep, e.group_index!, locale, primaryLocale, t)}: ${text}` : text,
    });
  }
  return out;
}

/**
 * `PERSONALIZATION_INVALID {errors}` from the API (add to cart, validate):
 * the evaluator errors, or null for any other error.
 */
export function readApiPersonalizationErrors(err: unknown): PError[] | null {
  if (!isPlainObject(err) && !(err instanceof Error)) return null;
  const e = err as { code?: unknown; errors?: unknown };
  if (e.code !== 'PERSONALIZATION_INVALID' || !Array.isArray(e.errors)) return null;
  const out: PError[] = [];
  for (const raw of e.errors) {
    if (!isPlainObject(raw) || typeof raw.code !== 'string') continue;
    const pe: PError = {
      code: raw.code as PError['code'],
      field_id: typeof raw.field_id === 'string' ? raw.field_id : '',
      field_name: typeof raw.field_name === 'string' ? raw.field_name : '',
      message: typeof raw.message === 'string' ? raw.message : '',
    };
    if (typeof raw.child_id === 'string') pe.child_id = raw.child_id;
    if (typeof raw.child_name === 'string') pe.child_name = raw.child_name;
    if (typeof raw.group_index === 'number') pe.group_index = raw.group_index;
    if (isPlainObject(raw.params)) pe.params = raw.params as PError['params'];
    out.push(pe);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Cart display lines (CustomFieldDisplay, contract §4.5)
// ---------------------------------------------------------------------------

/** One cart display line; the group keys are present only in app mode. */
export interface PersonalizationDisplayLine {
  id: string;
  label: string;
  value: unknown;
  display?: string | null;
  group_key?: string;
  group_index?: number;
  group_label?: string;
  hex?: string;
  source?: 'FIELD' | 'OPTION';
}

/** Evaluator lines → cart display lines (same shape as the API's enriched cart). */
export function linesToDisplay(lines: readonly PLine[]): PersonalizationDisplayLine[] {
  return lines.map((l) => {
    const base = l.field_id ?? `option:${l.field_name}`;
    const out: PersonalizationDisplayLine = {
      id: l.group_index !== null ? `${base}#${l.group_index}` : base,
      label: l.label,
      value: l.value,
      display: l.display_value !== l.value ? l.display_value : null,
      source: l.source,
    };
    if (l.group_key !== null) out.group_key = l.group_key;
    if (l.group_index !== null) out.group_index = l.group_index;
    if (l.group_label !== null) out.group_label = l.group_label;
    if (l.meta?.hex) out.hex = l.meta.hex;
    return out;
  });
}

/**
 * Cart summary split (PersonalizationSummary): repeater items as groups
 * (entries' text from `text`), plus the ungrouped field lines; option lines
 * outside a group are left out (the variant line shows them).
 */
export function splitDisplay<T extends PersonalizationDisplayLine>(
  display: readonly T[],
  text: (line: T) => string,
  defaultGroupLabel: (index: number) => string,
): { flat: T[]; groups: PDisplayGroup[] } {
  const { groups } = buildPersonalizationGroups(
    display.map((d) => ({
      label: d.label,
      value: text(d),
      group_key: d.group_key ?? null,
      group_index: typeof d.group_index === 'number' ? d.group_index : null,
      group_label: d.group_label ?? null,
      source: d.source ?? 'FIELD',
      hex: d.hex ?? null,
    })),
    { defaultGroupLabel: (i) => defaultGroupLabel(i) },
  );
  const flat = display.filter((d) => typeof d.group_index !== 'number' && d.source !== 'OPTION');
  return { flat, groups };
}

// ---------------------------------------------------------------------------
// Variation cards (§5 VariantCards, D9)
// ---------------------------------------------------------------------------

export const DEFAULT_BADGE_COLOR = '#fbde31';
const CSS_HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

export interface CardOptionConfig {
  name: string;
  valueMeta?: Record<string, unknown> | null;
}

export interface CardMeta {
  label: string;
  sublabel?: string;
  badge?: string;
  badgeColor: string;
}

/** Card texts of one option value: `valueMeta[v].i18n[locale]` → `valueMeta[v]` → the value. */
export function cardMeta(
  config: CardOptionConfig | null | undefined,
  value: string,
  locale: string,
  primaryLocale: string,
): CardMeta {
  const meta = isPlainObject(config?.valueMeta) ? (config!.valueMeta as Record<string, unknown>)[value] : undefined;
  const m = isPlainObject(meta) ? meta : {};
  const i18n = isPlainObject(m.i18n) ? m.i18n : {};
  const loc = [locale, primaryLocale].map((k) => (isPlainObject(i18n[k]) ? (i18n[k] as Record<string, unknown>) : null));
  const pick = (key: string): string | undefined => {
    for (const l of loc) {
      const v = str(l?.[key]);
      if (v) return v;
    }
    return str(m[key]);
  };
  const color = str(m.badge_color);
  return {
    label: pick('label') ?? value,
    sublabel: pick('sublabel'),
    badge: pick('badge'),
    badgeColor: color && CSS_HEX.test(color) ? color : DEFAULT_BADGE_COLOR,
  };
}

export interface CardVariant {
  id: string;
  price: number;
  stock?: number;
  options?: Record<string, string> | null;
  is_active?: boolean | null;
}

/**
 * Card price of `value` for option `option`: the variant matching the other
 * current picks plus this value (`mode:'selection'`), else the minimum over
 * active variants with this value, flagged `from` when the prices differ or
 * mode is `'from'`. Null when no active variant carries the value.
 */
export function cardPrice(
  variants: readonly CardVariant[],
  option: string,
  value: string,
  selections: Record<string, string>,
  optionNames: readonly string[],
  mode: 'selection' | 'from',
): { price: number; from: boolean } | null {
  const candidates = variants.filter(
    (v) => v && v.is_active !== false && v.options?.[option] === value && Number.isFinite(Number(v.price)),
  );
  if (candidates.length === 0) return null;
  const prices = candidates.map((v) => Number(v.price));
  const min = Math.min(...prices);
  const allSame = prices.every((p) => p === min);
  if (mode === 'from') return { price: min, from: true };
  const others = optionNames.filter((n) => n !== option);
  if (others.every((n) => typeof selections[n] === 'string')) {
    const exact = candidates.find((v) => others.every((n) => v.options?.[n] === selections[n]));
    if (exact) return { price: Number(exact.price), from: false };
  }
  return { price: min, from: !allSame };
}

/** Free-shipping line of a card: `price ≥ threshold` (Q1). */
export function freeShippingReached(price: number, threshold: number | null | undefined): boolean {
  return typeof threshold === 'number' && Number.isFinite(threshold) && Number.isFinite(price) && price >= threshold;
}
