'use client';

import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import {
  applyCartDisplay,
  buildCartDisplayBody,
  CART_DISPLAY_MAX_LINES,
  displayKey,
  normalizeCartDisplay,
  readCachedDisplay,
  staleLines,
  writeCachedDisplay,
  type CartDisplayEntry,
} from '@/lib/cartDisplay';
import type { CartItem } from '@/hooks/useCart';

// Requests in flight per `${slug}|${locale}|${key}`, shared by every
// provider instance so a re-render never posts the same lines twice.
const inFlight = new Map<string, Promise<void>>();

interface Options {
  items: CartItem[];
  /** Guest cart loaded (signed-in carts come localized from GET /cart). */
  enabled: boolean;
  storeSlug?: string;
  locale?: string;
  /** Owner preview viewer headers (a non-LIVE store answers nulls otherwise). */
  headers?: () => Record<string, string>;
}

/**
 * M160: guest cart lines with the title / variant label of the current page
 * locale laid over the stored text (display only). Falls back to the stored
 * text while loading, on any error and for products the API does not know.
 */
export function useGuestCartDisplay({ items, enabled, storeSlug, locale, headers }: Options): CartItem[] {
  const [version, setVersion] = useState(0);
  const active = Boolean(enabled && storeSlug && locale);

  const stale = useMemo(() => (active && locale ? staleLines(items, locale) : []), [active, items, locale]);
  const staleKey = useMemo(() => stale.map(displayKey).sort().join(','), [stale]);

  useEffect(() => {
    if (!active || !storeSlug || !locale || stale.length === 0) return;
    let cancelled = false;
    const prefix = `${storeSlug}|${locale}|`;
    const waits: Promise<void>[] = [];
    const missing = stale.filter((line) => {
      const key = displayKey(line);
      const pending = inFlight.get(prefix + key);
      if (pending) {
        waits.push(pending);
        return false;
      }
      return readCachedDisplay(storeSlug, locale, key) === undefined;
    });
    for (let i = 0; i < missing.length; i += CART_DISPLAY_MAX_LINES) {
      const chunk = missing.slice(i, i + CART_DISPLAY_MAX_LINES);
      const run = api<unknown>(`/storefront/${encodeURIComponent(storeSlug)}/cart-display`, {
        method: 'POST',
        headers: headers?.(),
        body: JSON.stringify(buildCartDisplayBody(chunk, locale)),
      })
        .then((raw) => {
          const entries = normalizeCartDisplay(raw, chunk.length);
          const byKey: Record<string, CartDisplayEntry | null> = {};
          chunk.forEach((line, idx) => {
            byKey[displayKey(line)] = entries[idx] ?? null;
          });
          writeCachedDisplay(storeSlug, locale, byKey);
        })
        // Failure (older API without the route, network, throttled): nothing
        // is cached, the stored text stays; a later item / locale change retries.
        .catch(() => undefined)
        .finally(() => {
          for (const line of chunk) inFlight.delete(prefix + displayKey(line));
        });
      for (const line of chunk) inFlight.set(prefix + displayKey(line), run);
      waits.push(run);
    }
    if (waits.length === 0) return;
    void Promise.all(waits).then(() => {
      if (!cancelled) setVersion((v) => v + 1);
    });
    return () => {
      cancelled = true;
    };
    // `stale` is represented by `staleKey` (same lines => same key).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, storeSlug, locale, staleKey]);

  return useMemo(() => {
    if (!active || !storeSlug || !locale) return items;
    return applyCartDisplay(items, (key) => readCachedDisplay(storeSlug, locale, key));
    // `version` re-reads the cache after an answer arrived.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, items, storeSlug, locale, version]);
}
