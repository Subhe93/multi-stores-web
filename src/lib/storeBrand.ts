// Brand name and Organization id of a store for structured data (M161 B3).
// `Store.name` often carries a tagline ("Namez – Personliga presenter …"),
// which is not a brand. There is no clean brand field in the storefront
// payload yet, so the name is cut at a spaced separator.

export interface StoreBrandInput {
  name?: string | null;
  theme?: { seo?: { brandName?: unknown } | null } | null;
}

// Spaced separators only: a plain hyphen ("Anna-Design") is never cut.
const SEPARATORS = [' – ', ' — ', ' | '];

/**
 * 1. `theme.seo.brandName` when set (optional key, no dashboard field yet);
 * 2. else `Store.name` cut at the first spaced " – ", " — " or " | " when
 *    both sides are non-empty;
 * 3. else `Store.name` (trimmed). Empty string when the store has no name.
 */
export function storeBrandName(store: StoreBrandInput | null | undefined): string {
  const explicit = store?.theme?.seo?.brandName;
  if (typeof explicit === 'string' && explicit.trim()) return explicit.trim();
  const name = (store?.name ?? '').trim();
  let first = -1;
  let sepLength = 0;
  for (const sep of SEPARATORS) {
    const i = name.indexOf(sep);
    if (i >= 0 && (first < 0 || i < first)) {
      first = i;
      sepLength = sep.length;
    }
  }
  if (first > 0) {
    const head = name.slice(0, first).trim();
    const tail = name.slice(first + sepLength).trim();
    if (head && tail) return head;
  }
  return name;
}

/** Stable `@id` of the store's Organization node on one origin (per site). */
export function organizationId(storeOrigin: string): string {
  return `${storeOrigin.replace(/\/+$/, '')}/#organization`;
}
