'use client';

import { useCallback, useEffect, useReducer, useRef } from 'react';
import { api } from '@/lib/api';
import {
  INITIAL_VAT_CHECK,
  normalizeVatCheckResponse,
  precheckVat,
  rememberReverseChargeHint,
  vatCheckKey,
  vatCheckReducer,
  type VatCheckModel,
  type VatCheckResult,
} from '@/lib/vatCheck';

// ── VAT-number check (b2b app, M2.5-DESIGN §5) ───────────────────────────────
// `POST /storefront/:slug/b2b/vat-check {vat_number, country_code?}` for the
// checkout's VAT field: debounced while typing, immediate on blur, re-run
// when the destination changes (the server caches VIES, so it is cheap).
// The previous request is aborted; settled results are memoised per key.
// Display only — the quote / order decide the exemption server-side.

const CHECK_DEBOUNCE_MS = 900;

export interface UseVatCheckOptions {
  storeSlug: string;
  /** False = no requests (person view, reverse charge off). */
  enabled: boolean;
  vatNumber: string;
  /** Shipping destination (ISO2); null/'' = none known yet. */
  countryCode?: string | null;
  /** Called with every settled result (null when the field is cleared). */
  onResult?: (result: VatCheckResult | null) => void;
}

export interface UseVatCheckResult extends VatCheckModel {
  /** Field blur: check now instead of waiting for the debounce. */
  checkNow: () => void;
}

export function useVatCheck({ storeSlug, enabled, vatNumber, countryCode, onResult }: UseVatCheckOptions): UseVatCheckResult {
  const [model, dispatch] = useReducer(vatCheckReducer, INITIAL_VAT_CHECK);
  const country = (countryCode || '').trim().toUpperCase() || null;
  const key = vatCheckKey(vatNumber, country);
  const cache = useRef(new Map<string, VatCheckResult | null>());
  const abortRef = useRef<AbortController | null>(null);
  const inflightKey = useRef<string | null>(null);
  const onResultRef = useRef(onResult);
  useEffect(() => {
    onResultRef.current = onResult;
  }, [onResult]);

  const run = useCallback(() => {
    if (!enabled || !storeSlug) return;
    const pre = precheckVat(vatNumber);
    if (pre.kind !== 'ok') return;
    if (inflightKey.current === key) return;
    const cached = cache.current.get(key);
    if (cached !== undefined) {
      dispatch({ type: 'start', key });
      dispatch({ type: 'result', key, result: cached });
      return;
    }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    inflightKey.current = key;
    dispatch({ type: 'start', key });
    api<unknown>(`/storefront/${encodeURIComponent(storeSlug)}/b2b/vat-check`, {
      method: 'POST',
      signal: controller.signal,
      body: JSON.stringify({ vat_number: pre.vatNumber, ...(country ? { country_code: country } : {}) }),
    })
      .then((raw) => {
        const result = normalizeVatCheckResponse(raw, { vatNumber: pre.vatNumber, countryCode: country });
        // Unavailable answers are not memoised: VIES may be back shortly.
        if (!result || result.state !== 'unavailable') cache.current.set(key, result);
        dispatch({ type: 'result', key, result });
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        dispatch({ type: 'failed', key, vatNumber: pre.vatNumber, countryCode: country });
      })
      .finally(() => {
        if (inflightKey.current === key) inflightKey.current = null;
      });
  }, [enabled, storeSlug, vatNumber, country, key]);

  // Input / destination changed: local format verdict at once, the server
  // check after a pause.
  useEffect(() => {
    if (!enabled) {
      dispatch({ type: 'reset' });
      return;
    }
    const pre = precheckVat(vatNumber);
    abortRef.current?.abort();
    inflightKey.current = null;
    if (pre.kind === 'empty') {
      dispatch({ type: 'reset' });
      return;
    }
    if (pre.kind === 'format_invalid') {
      // Shown by the field only after blur; reported so the page can react.
      dispatch({ type: 'format_invalid', key, vatNumber: pre.vatNumber, countryCode: country });
      return;
    }
    dispatch({ type: 'reset' });
    const timer = setTimeout(run, CHECK_DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // `run` changes with the same inputs; listing them keeps the intent clear.
  }, [enabled, key, vatNumber, country, run]);

  useEffect(() => () => abortRef.current?.abort(), []);

  // Report settled results and keep the cart hint in step.
  const settled = model.state === 'checking' ? undefined : model.result;
  useEffect(() => {
    if (settled === undefined) return;
    onResultRef.current?.(settled);
    // Set only on a confirmed reverse charge; cleared by anything that is
    // not one (cleared field, disabled, invalid, unavailable, VAT applies).
    // A valid number without a destination decided nothing: left as is.
    if (settled && settled.state === 'valid' && settled.reverseCharge === true) {
      rememberReverseChargeHint(storeSlug, true);
    } else if (!(settled && settled.state === 'valid' && settled.reverseCharge === null)) {
      rememberReverseChargeHint(storeSlug, false);
    }
  }, [settled, storeSlug]);

  return { ...model, checkNow: run };
}
