'use client';

import { useCallback, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { CartCustomFieldDisplay } from '@/hooks/useCart';
import {
  buildCartPayload,
  fieldErrorFromApi,
  fieldErrorsFrom,
  fillableFields,
  initialFieldValues,
  mapFormFields,
  padLinkedPair,
  prefilledValues,
  validateFormValues,
  type FormField,
  type MessageParams,
  type PersonalizationProduct,
} from '@/lib/personalization/form';
import type { PContext, PFieldDef, POptionConfig, PResult } from '@/lib/personalization';
import {
  errorKey,
  errorMessages,
  evaluateForm,
  formContext,
  hasAdvancedFields,
  linesToDisplay,
  pruneHidden,
  readApiPersonalizationErrors,
  summaryMessages,
  withChildValue,
} from '@/components/product/personalization/model';

/**
 * Personalization app input (M4.1). Without it, or with `enabled: false`, or
 * for a product without M4.1 field features, the hook is the M4.0 hook:
 * same form, same rules, same payload.
 */
export interface PersonalizationAppInput {
  /** `apps.personalization` on and `product.personalization.enabled`. */
  enabled: boolean;
  /** Partial option picks, original-case option names. */
  selections: Record<string, string>;
  optionConfig?: POptionConfig[] | null;
  /** Option values present on active variants. */
  activeOptionValues?: Record<string, string[]>;
}

/** App-mode state exposed to `PersonalizationForm` (null in M4.0 mode). */
export interface PersonalizationAdvanced {
  /** Field tree as the storefront sends it (children nested). */
  defs: PFieldDef[];
  ctx: PContext;
  /** Form values (top level by field id; repeaters as arrays of items). */
  values: Record<string, unknown>;
  result: PResult;
  /** Message per error key (`fieldKey`): client evaluator + API errors. */
  errors: Record<string, string>;
  /** Validation-summary lines (after a submit attempt). */
  summary: { key: string; text: string }[];
  setValue: (fieldId: string, value: unknown) => void;
  setChildValue: (repeaterId: string, position: number, childId: string, value: unknown) => void;
}

/**
 * Personalization state of one product form (M4.0 §2.2): shared by the
 * product page (`ProductDetailClient`) and the theme's `AddToCartMagic`, so
 * both send the same values and run the same rules as the API. With the
 * personalization app (M4.1) the shared evaluator replaces the M4.0
 * validator: visibility, repeaters, canonical values and grouped lines.
 */
export function usePersonalizationFields(
  product: PersonalizationProduct | null | undefined,
  locale: string,
  primaryLocale: string,
  app?: PersonalizationAppInput,
) {
  const t = useTranslations();
  const source = useMemo<PersonalizationProduct>(() => product ?? {}, [product]);
  // Creator-filled values (custom products) start in the form and are sent as-is.
  const [values, setValues] = useState<Record<string, unknown>>(() => initialFieldValues(source));
  // After a submit attempt every error shows (also "required" on empty fields).
  const [showAllErrors, setShowAllErrors] = useState(false);
  // Errors the API returned for a field (K2); cleared when that field changes.
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});

  const translate = useCallback((key: string, params?: MessageParams) => t(key, params), [t]);
  const fields: FormField[] = useMemo(
    () => mapFormFields(source, locale, primaryLocale),
    [source, locale, primaryLocale],
  );
  const prefilled = useMemo(() => prefilledValues(source), [source]);

  // ── App mode (M4.1) ─────────────────────────────────
  const defs = useMemo(() => (source.custom_fields ?? []) as unknown as PFieldDef[], [source]);
  const appOn = Boolean(app?.enabled) && hasAdvancedFields(defs);
  const selections = app?.selections;
  const optionConfig = app?.optionConfig;
  const activeValues = app?.activeOptionValues;
  const ctx = useMemo<PContext | null>(
    () =>
      appOn
        ? formContext({
            selections: selections ?? {},
            optionConfig,
            activeOptionValues: activeValues,
            locale,
            primaryLocale,
          })
        : null,
    [appOn, selections, optionConfig, activeValues, locale, primaryLocale],
  );
  const evaluation = useMemo(() => (ctx ? evaluateForm(defs, values, ctx) : null), [ctx, defs, values]);

  // Hidden fields and repeater items beyond the count lose their value (D8),
  // adjusted during render; `pruneHidden` returns null once nothing is left
  // to remove, so this settles after one extra render.
  const pruned = evaluation && ctx ? pruneHidden(values, defs, evaluation, ctx) : null;
  if (pruned) setValues(pruned);

  // ── M4.0 mode ───────────────────────────────────────
  const result = useMemo(() => validateFormValues(source, values), [source, values]);
  const clientErrors = useMemo(
    () =>
      evaluation
        ? errorMessages(evaluation.errors, defs, locale, primaryLocale, translate)
        : fieldErrorsFrom(result.issues, source, locale, primaryLocale, translate),
    [evaluation, defs, result, source, locale, primaryLocale, translate],
  );
  const errors = useMemo(() => ({ ...clientErrors, ...serverErrors }), [clientErrors, serverErrors]);
  const fillable = useMemo(() => fillableFields(fields, values, prefilled), [fields, values, prefilled]);

  const clearServerError = useCallback((key: string) => {
    setServerErrors((prev) => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const onChange = useCallback((fieldId: string, value: unknown) => {
    setValues((prev) => ({ ...prev, [fieldId]: value }));
    clearServerError(fieldId);
  }, [clearServerError]);

  const setChildValue = useCallback(
    (repeaterId: string, position: number, childId: string, value: unknown) => {
      setValues((prev) => withChildValue(prev, repeaterId, position, childId, value));
      // Server errors of a child are keyed `<repeater>#<index>#<child>`.
      setServerErrors((prev) => {
        const keys = Object.keys(prev).filter((k) => k.startsWith(`${repeaterId}#`) && k.endsWith(`#${childId}`));
        if (keys.length === 0) return prev;
        const next = { ...prev };
        for (const k of keys) delete next[k];
        return next;
      });
    },
    [],
  );

  const onFill = useCallback(
    (fieldId: string) => {
      const field = fields.find((f) => f.id === fieldId);
      if (!field) return;
      const patch = padLinkedPair(field, values);
      for (const [id, v] of Object.entries(patch)) onChange(id, v);
    },
    [fields, values, onChange],
  );

  /** Runs the shared validator; shows every error and returns the first message. */
  // `fieldId` is set when the first error is shown inline on that field (app
  // mode: the error key, e.g. `<repeater>#2#<child>`).
  const validateAll = useCallback((): { ok: boolean; firstError?: string; fieldId?: string } => {
    setShowAllErrors(true);
    if (evaluation) {
      if (evaluation.ok) return { ok: true };
      const first = evaluation.errors[0];
      const key = first ? errorKey(first) : '_form';
      return { ok: false, firstError: clientErrors[key], ...(first?.field_id ? { fieldId: key } : {}) };
    }
    if (result.ok) return { ok: true };
    const first = result.issues[0];
    const key = first?.field_id || '_form';
    return { ok: false, firstError: clientErrors[key], ...(first?.field_id ? { fieldId: first.field_id } : {}) };
  }, [evaluation, result, clientErrors]);

  /** Cart payload (`undefined` when nothing was set) and the guest display lines. */
  const buildPayload = useCallback((): {
    fields?: Record<string, unknown>;
    display?: CartCustomFieldDisplay[];
  } => {
    if (evaluation) {
      // Canonical values (the line key, D3 step 8); the server re-evaluates them.
      if (Object.keys(evaluation.values).length === 0) return {};
      return { fields: evaluation.values, display: linesToDisplay(evaluation.lines) };
    }
    return buildCartPayload(values, fields);
  }, [evaluation, values, fields]);

  /**
   * Shows a coded API error (`CUSTOM_FIELD_*`, `CUSTOMER_UPLOAD_*`, app mode
   * `PERSONALIZATION_INVALID {errors}`) inline on its field. Returns the
   * localized message, or null when the error is not about a field of this
   * product.
   */
  const applyServerError = useCallback(
    (err: unknown): string | null => {
      if (evaluation) {
        const list = readApiPersonalizationErrors(err);
        if (list && list.length > 0) {
          const messages = errorMessages(list, defs, locale, primaryLocale, translate);
          setShowAllErrors(true);
          setServerErrors((prev) => ({ ...prev, ...messages }));
          return messages[errorKey(list[0]!)] ?? null;
        }
      }
      const mapped = fieldErrorFromApi(err, source, locale, primaryLocale, translate, (k) => t.has(k));
      if (!mapped) return null;
      setShowAllErrors(true);
      setServerErrors((prev) => ({ ...prev, [mapped.fieldId]: mapped.message }));
      return mapped.message;
    },
    [evaluation, defs, source, locale, primaryLocale, translate, t],
  );

  const summary = useMemo(
    () => (evaluation ? summaryMessages(evaluation.errors, defs, locale, primaryLocale, translate) : []),
    [evaluation, defs, locale, primaryLocale, translate],
  );

  const advanced = useMemo<PersonalizationAdvanced | null>(
    () =>
      evaluation && ctx
        ? { defs, ctx, values, result: evaluation, errors, summary, setValue: onChange, setChildValue }
        : null,
    [evaluation, ctx, defs, values, errors, summary, onChange, setChildValue],
  );

  return {
    fields,
    values,
    onChange,
    errors,
    showAllErrors,
    fillable,
    onFill,
    validateAll,
    buildPayload,
    applyServerError,
    /** App mode (M4.1); null when the M4.0 form is used. */
    advanced,
  };
}
