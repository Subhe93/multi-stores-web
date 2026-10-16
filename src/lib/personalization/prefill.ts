/**
 * URL prefill of the personalization form (M4.1 §5, namez A L14-32).
 * Web-only helper (not part of the evaluator mirror). Pure code.
 *
 * Sources, applied in this order (later wins):
 * 1. the store's `url_prefill` aliases (`apps.personalization.settings`):
 *    `{ "<param>": "<field name>" | "option:<Option name>" }`, e.g. namez
 *    `?name1=&name2=&model_text=&color=`;
 * 2. `?cf[<field name>]=<value>` for a top-level field without pricing
 *    (a priced field is prefilled through a configured alias only, so an
 *    arbitrary link cannot add a paid personalization to the buyer's line).
 *
 * Values are only suggestions: the form still validates them and the server
 * evaluates them again. Unknown fields, unknown option values and empty
 * values are ignored.
 */

/** Field types whose value is a single string the URL can carry. */
const PREFILLABLE_TYPES: ReadonlySet<string> = new Set([
  'TEXT',
  'TEXTAREA',
  'NUMBER',
  'SELECT',
  'FONT',
  'DATE',
  'COLOR',
  'COLOR_PALETTE',
]);

/** Longest prefilled value (code points); longer input is cut. */
export const PREFILL_MAX_CHARS = 500;

/** Most URL parameters read (protects against absurd query strings). */
const MAX_PARAMS = 100;

export interface PrefillField {
  id: string;
  name?: string | null;
  type: string;
  /** The field has a price modifier: `cf[]` cannot fill it (aliases can). */
  priced?: boolean;
}

export interface PrefillOption {
  name: string;
  values?: readonly string[] | null;
}

export interface PrefillResult {
  /** Field id → value (top-level fields only). */
  fields: Record<string, string>;
  /** Option name → one of its values (canonical spelling). */
  options: Record<string, string>;
}

const CF_PARAM = /^cf\[(.+)\]$/;
const OPTION_PREFIX = 'option:';

function cleanValue(raw: string): string {
  const s = raw.normalize('NFC').trim();
  const chars = Array.from(s);
  return chars.length > PREFILL_MAX_CHARS ? chars.slice(0, PREFILL_MAX_CHARS).join('') : s;
}

/** Option value as configured: exact match first, then case-insensitive. */
export function matchOptionValue(values: readonly string[], wanted: string): string | null {
  const w = wanted.normalize('NFC').trim();
  if (w === '') return null;
  const exact = values.find((v) => v === w);
  if (exact !== undefined) return exact;
  const lower = w.toLocaleLowerCase();
  return values.find((v) => v.normalize('NFC').toLocaleLowerCase() === lower) ?? null;
}

/** Reads `url_prefill` leniently: string → string pairs only. */
export function readPrefillAliases(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === 'string' && k.trim() !== '' && v.trim() !== '') out[k.trim()] = v.trim();
  }
  return out;
}

/**
 * Prefill values from a query string (`location.search`, with or without the
 * leading `?`) or a `URLSearchParams`.
 */
export function readPrefill(
  search: string | URLSearchParams,
  aliases: Record<string, string>,
  fields: readonly PrefillField[],
  options: readonly PrefillOption[],
): PrefillResult {
  const params = typeof search === 'string' ? new URLSearchParams(search) : search;
  const result: PrefillResult = { fields: {}, options: {} };

  const byName = new Map<string, PrefillField>();
  for (const f of fields) {
    if (f && typeof f.name === 'string' && f.name !== '' && !byName.has(f.name)) byName.set(f.name, f);
  }
  const optionByName = new Map<string, PrefillOption>();
  for (const o of options) if (o && typeof o.name === 'string' && o.name !== '') optionByName.set(o.name, o);

  const setField = (name: string, raw: string, viaAlias: boolean) => {
    const field = byName.get(name);
    if (!field || !PREFILLABLE_TYPES.has(field.type)) return;
    if (field.priced && !viaAlias) return;
    const v = cleanValue(raw);
    if (v !== '') result.fields[field.id] = v;
  };
  const setOption = (name: string, raw: string) => {
    const option = optionByName.get(name);
    if (!option) return;
    const values = Array.isArray(option.values) ? option.values.filter((v): v is string => typeof v === 'string') : [];
    const v = matchOptionValue(values, raw);
    if (v !== null) result.options[option.name] = v;
  };

  const entries: [string, string][] = [];
  for (const entry of params.entries()) {
    if (entries.length >= MAX_PARAMS) break;
    entries.push(entry);
  }

  // 1. Store aliases.
  for (const [param, value] of entries) {
    const target = Object.prototype.hasOwnProperty.call(aliases, param) ? aliases[param] : undefined;
    if (!target) continue;
    if (target.startsWith(OPTION_PREFIX)) setOption(target.slice(OPTION_PREFIX.length).trim(), value);
    else setField(target, value, true);
  }
  // 2. Explicit `cf[name]`.
  for (const [param, value] of entries) {
    const m = CF_PARAM.exec(param);
    if (m) setField(m[1]!, value, false);
  }
  return result;
}
