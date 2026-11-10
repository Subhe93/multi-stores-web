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
  readRepeat,
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

/**
 * The repeater whose items stand for pieces 2..N while piece 1 is the product
 * itself (`start_index` > 1 — namez "st 2", "st 3", …). Returned only while it
 * has items, so the form can box piece 1 the same way ("st 1") and the
 * shopper sees one shape per piece instead of two different designs.
 */
export function pieceOneRepeater(
  defs: readonly PFieldDef[],
  visibleIds: readonly string[],
  ctx: Pick<PContext, 'variantOptions' | 'optionConfig'>,
  placement: Placement,
): PFieldDef | null {
  return (
    visibleFieldsAt(defs, visibleIds, placement).find(
      (d) => d.type === 'REPEATER' && (readRepeat(d.repeat)?.start ?? 1) > 1 && repeaterIndexes(d, ctx).length > 0,
    ) ?? null
  );
}

/** Heading index of the piece-1 box: one below the repeater's first item. */
export function pieceOneIndex(rep: PFieldDef): number {
  return (readRepeat(rep.repeat)?.start ?? 2) - 1;
}

/**
 * Product option names the repeater's colour palettes draw from
 * (`ui.palette_from_option`). Those product options ARE piece 1's colour, so
 * the page renders them inside the piece-1 box next to its text fields.
 */
export function pieceOneOptionKeys(defs: readonly PFieldDef[], rep: PFieldDef): string[] {
  const children = splitFieldTree(defs).childrenOf.get(rep.id) ?? [];
  const keys: string[] = [];
  for (const child of children) {
    if (child.type !== 'COLOR_PALETTE') continue;
    const option = readUi(child.ui).palette_from_option;
    if (typeof option === 'string' && option !== '' && !keys.includes(option)) keys.push(option);
  }
  return keys;
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

/** Theme-following default ribbon (no `ribbon_color`): theme text colour with the background as its text. */
export const DEFAULT_RIBBON_COLOR = 'var(--theme-colors-text, #111827)';
export const DEFAULT_RIBBON_TEXT_COLOR = 'var(--theme-colors-background, #fff)';

export interface CardOptionConfig {
  name: string;
  valueMeta?: Record<string, unknown> | null;
  /** Cards v2: 'grid' (default, today's look) or 'list' (one full-width row per value). */
  card_layout?: unknown;
  /** Cards v2: opt-in savings (struck compare-at price + savings chip); absent/false = today's look. */
  card_show_savings?: unknown;
  /** Cards v2 batch 2: per-unit line switch; absent/true = shown whenever the pieces are known. */
  card_show_unit_price?: unknown;
  /** Cards v2 batch 2: custom "each" wording (plain text, <= 30 chars) and its per-locale map. */
  card_unit_label?: unknown;
  card_unit_label_i18n?: unknown;
}

export type CardLayout = 'grid' | 'list';

export interface CardOptionSettings {
  layout: CardLayout;
  showSavings: boolean;
  /** False only with an explicit `card_show_unit_price: false`. */
  showUnitPrice: boolean;
}

/** Option-level card settings; anything malformed takes the defaults (grid, savings off, unit price on). */
export function cardOptionSettings(config: CardOptionConfig | null | undefined): CardOptionSettings {
  return {
    layout: config?.card_layout === 'list' ? 'list' : 'grid',
    showSavings: config?.card_show_savings === true,
    showUnitPrice: config?.card_show_unit_price !== false,
  };
}

/**
 * Custom per-unit wording of an option: `card_unit_label_i18n[locale]` →
 * `card_unit_label_i18n[primaryLocale]` → `card_unit_label`; undefined when
 * none is set (the caller then uses the translated `personalization.each`).
 * The label is plain text that the card renders as "{price} {label}".
 */
export function cardUnitLabel(
  config: CardOptionConfig | null | undefined,
  locale: string,
  primaryLocale: string,
): string | undefined {
  const i18n = isPlainObject(config?.card_unit_label_i18n) ? (config!.card_unit_label_i18n as Record<string, unknown>) : {};
  for (const key of [locale, primaryLocale]) {
    const v = str(i18n[key]);
    if (v) return v.trim();
  }
  const base = str(config?.card_unit_label);
  return base ? base.trim() : undefined;
}

export interface CardMeta {
  label: string;
  sublabel?: string;
  badge?: string;
  badgeColor: string;
  /** Tab on the top edge; absent = no ribbon. */
  ribbon?: string;
  /**
   * Ribbon background + text colour (set only with `ribbon`): an explicit hex
   * `ribbon_color` with a contrast-aware text, else the theme-following defaults.
   */
  ribbonColor?: string;
  ribbonTextColor?: string;
  /** Pieces in this value (`units` 2..99, else the repeat `count` >= 2) → per-unit price line. */
  units?: number;
}

const RIBBON_DARK_TEXT = '#111827';

/** `#rgb[a]`, `#rrggbb[aa]` or `rgb()/rgba()` → [r, g, b] (0..255); null for anything else. */
export function parseCssColor(raw: string | null | undefined): [number, number, number] | null {
  const v = (raw ?? '').trim().toLowerCase();
  const hex = /^#([0-9a-f]{3,8})$/.exec(v);
  if (hex) {
    let c = hex[1];
    if (c.length === 3 || c.length === 4) c = c.slice(0, 3).split('').map((x) => x + x).join('');
    else if (c.length === 6 || c.length === 8) c = c.slice(0, 6);
    else return null;
    return [0, 2, 4].map((k) => parseInt(c.slice(k, k + 2), 16)) as [number, number, number];
  }
  const rgb = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/.exec(v);
  if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])].map((n) => Math.min(255, n)) as [number, number, number];
  return null;
}

function luminance([r, g, b]: [number, number, number]): number {
  const ch = (x: number) => {
    const v = x / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
}

/** WCAG contrast ratio of two CSS colours; null when either cannot be parsed. */
export function contrastRatio(a: string | null | undefined, b: string | null | undefined): number | null {
  const ca = parseCssColor(a);
  const cb = parseCssColor(b);
  if (!ca || !cb) return null;
  const la = luminance(ca);
  const lb = luminance(cb);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Text colour readable on `hex` (WCAG contrast): white on dark backgrounds, near-black on light ones. */
export function contrastTextColor(hex: string): string {
  const onWhite = contrastRatio(hex, '#ffffff');
  const onDark = contrastRatio(hex, RIBBON_DARK_TEXT);
  if (onWhite === null || onDark === null) return '#ffffff';
  return onWhite >= onDark ? '#ffffff' : RIBBON_DARK_TEXT;
}

/** `valueMeta[v].units` as an integer 2..99, else undefined. */
function readUnits(raw: unknown): number | undefined {
  const n = typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : raw;
  return typeof n === 'number' && Number.isInteger(n) && n >= 2 && n <= 99 ? n : undefined;
}

/**
 * Pieces fallback (batch 2): without explicit `units`, the value's repeat
 * `count` (an integer >= 2) counts as its pieces. Explicit `units` always wins.
 */
function readCountAsUnits(raw: unknown): number | undefined {
  const n = typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : raw;
  return typeof n === 'number' && Number.isInteger(n) && n >= 2 && n <= 99 ? n : undefined;
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
  const out: CardMeta = {
    label: pick('label') ?? value,
    sublabel: pick('sublabel'),
    badge: pick('badge'),
    badgeColor: color && CSS_HEX.test(color) ? color : DEFAULT_BADGE_COLOR,
  };
  const ribbon = pick('ribbon');
  if (ribbon) {
    const rc = str(m.ribbon_color);
    out.ribbon = ribbon;
    if (rc && CSS_HEX.test(rc)) {
      out.ribbonColor = rc;
      out.ribbonTextColor = contrastTextColor(rc);
    } else {
      out.ribbonColor = DEFAULT_RIBBON_COLOR;
      out.ribbonTextColor = DEFAULT_RIBBON_TEXT_COLOR;
    }
  }
  const units = readUnits(m.units) ?? readCountAsUnits(m.count);
  if (units !== undefined) out.units = units;
  return out;
}

export interface CardVariant {
  id: string;
  price: number;
  /** Cards v2: the variant's "compare at" price (a string in some payloads). */
  compare_at_price?: number | string | null;
  stock?: number;
  options?: Record<string, string> | null;
  is_active?: boolean | null;
}

/**
 * Card price of `value` for option `option`: the variant matching the other
 * current picks plus this value (`mode:'selection'`), else the minimum over
 * active variants with this value, flagged `from` when the prices differ or
 * mode is `'from'`. Null when no active variant carries the value. The
 * compare-at comes from the same variant that gives the price (cards v2).
 */
export function cardPrice(
  variants: readonly CardVariant[],
  option: string,
  value: string,
  selections: Record<string, string>,
  optionNames: readonly string[],
  mode: 'selection' | 'from',
): CardPrice | null {
  const candidates = variants.filter(
    (v) => v && v.is_active !== false && v.options?.[option] === value && Number.isFinite(Number(v.price)),
  );
  if (candidates.length === 0) return null;
  const prices = candidates.map((v) => Number(v.price));
  const min = Math.min(...prices);
  const cheapest = candidates[prices.indexOf(min)];
  const allSame = prices.every((p) => p === min);
  if (mode === 'from') return withCompareAt(min, true, cheapest);
  const others = optionNames.filter((n) => n !== option);
  if (others.every((n) => typeof selections[n] === 'string')) {
    const exact = candidates.find((v) => others.every((n) => v.options?.[n] === selections[n]));
    if (exact) return withCompareAt(Number(exact.price), false, exact);
  }
  return withCompareAt(min, !allSame, cheapest);
}

/** A card price; `compareAt` is present only when the priced variant has a positive compare-at. */
export interface CardPrice {
  price: number;
  from: boolean;
  compareAt?: number;
}

function withCompareAt(price: number, from: boolean, v: CardVariant): CardPrice {
  const out: CardPrice = { price, from };
  const raw = v.compare_at_price;
  const c = raw === null || raw === undefined || raw === '' ? NaN : Number(raw);
  if (Number.isFinite(c) && c > 0) out.compareAt = c;
  return out;
}

/**
 * Savings of a card (cards v2): only when `compareAt` exceeds `price` by more
 * than 0.5 %. Percent is rounded down to an integer; amount = compareAt −
 * price (2 decimals). Pass the displayed (tax-adjusted) amounts of both.
 */
export function cardSavings(
  price: number,
  compareAt: number | null | undefined,
): { percent: number; amount: number } | null {
  if (typeof compareAt !== 'number' || !Number.isFinite(compareAt) || !Number.isFinite(price) || compareAt <= 0) {
    return null;
  }
  const diff = compareAt - price;
  if (diff <= 0 || diff / compareAt <= 0.005) return null;
  return {
    // The epsilon keeps an exact 38 % from reading as 37.999… and flooring to 37.
    percent: Math.floor((diff / compareAt) * 100 + 1e-9),
    amount: Math.round(diff * 100) / 100,
  };
}

/** Per-unit price (price / units, 2 decimals); null without a valid unit count. */
export function unitPrice(price: number, units: number | null | undefined): number | null {
  if (!Number.isFinite(price) || typeof units !== 'number' || !Number.isInteger(units) || units < 2) return null;
  return Math.round((price / units) * 100) / 100;
}

/** Free-shipping line of a card: `price ≥ threshold` (Q1). */
export function freeShippingReached(price: number, threshold: number | null | undefined): boolean {
  return typeof threshold === 'number' && Number.isFinite(threshold) && Number.isFinite(price) && price >= threshold;
}
