'use client';

import { useTranslations } from 'next-intl';

/** ICU arguments from the error's `params` (strings and finite numbers only). */
function messageParams(e: { params?: unknown; field_name?: unknown }): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  if (e.params && typeof e.params === 'object' && !Array.isArray(e.params)) {
    for (const [k, v] of Object.entries(e.params as Record<string, unknown>)) {
      if (typeof v === 'string' || (typeof v === 'number' && Number.isFinite(v))) out[k] = v;
    }
  }
  // Field errors always name the field; fall back to its internal name so a
  // `{label}` placeholder never stays unresolved.
  if (out.label === undefined) out.label = typeof e.field_name === 'string' ? e.field_name : '';
  return out;
}

/**
 * Returns a function that turns an API error into a localized message.
 *
 * The API attaches a stable `code` to errors (see `api()` in `./api`), plus
 * ICU `params` for parameterized messages (e.g. `CUSTOM_FIELD_TOO_LONG` with
 * `{label, max}`). We look up `errors.<code>` in the active locale; if there's
 * no code or no matching translation, we fall back to the server-provided
 * English `message`, and finally to a generic message. This keeps every call
 * site safe — an unmapped code degrades gracefully to the raw message rather
 * than throwing.
 */
export function useApiError() {
  const t = useTranslations('errors');
  return (err: unknown): string => {
    const e = err as { code?: string; message?: string; params?: unknown; field_name?: unknown } | null | undefined;
    if (e?.code && t.has(e.code)) return t(e.code, messageParams(e));
    return e?.message || t('generic');
  };
}

/**
 * Like `useApiError`, but only for coded errors with a translation: returns
 * null otherwise, so callers can skip a reason rather than show raw English.
 */
export function useCodedApiError() {
  const t = useTranslations('errors');
  return (err: unknown): string | null => {
    const e = err as { code?: string; params?: unknown; field_name?: unknown } | null | undefined;
    return e?.code && t.has(e.code) ? t(e.code, messageParams(e)) : null;
  };
}
