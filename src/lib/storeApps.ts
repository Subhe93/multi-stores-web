// ── Store Apps (plans/namez-store-apps/M0-DESIGN.md) ─────────────────────────
// Per-store optional modules ("apps") that an admin makes available and a
// creator switches on. The storefront only needs to know which apps are
// enabled (and, later, the settings the API chooses to expose) so it can
// toggle UI. Availability / dependency rules live server-side.
//
// The keys below MIRROR `multi-stores-shared/src/constants/store-apps.ts`
// (source of truth). Keep both lists in sync when adding an app — the repos
// deploy separately and this package does not consume the shared one (D1).

export const STORE_APP_KEYS = ['markets', 'b2b', 'invoices', 'importer', 'personalization', 'production', 'designer'] as const;

export type StoreAppKey = (typeof STORE_APP_KEYS)[number];

/** One enabled app as emitted by `storefront.getStore(...).apps[key]`. */
export interface StorefrontAppEntry {
  enabled: true;
  /** Only present when the registry marks the app `exposeSettingsToStorefront`. */
  settings?: Record<string, unknown>;
}

/** `apps` block of `storefront.getStore` — only enabled apps appear as keys. */
export type StorefrontApps = Partial<Record<StoreAppKey, StorefrontAppEntry>>;

export function isStoreAppKey(value: unknown): value is StoreAppKey {
  return typeof value === 'string' && (STORE_APP_KEYS as readonly string[]).includes(value);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Coerce the `apps` block of `storefront.getStore`. Unknown keys, disabled
 * entries and malformed values are dropped; anything that is not an object
 * (missing, null, a string, an array) yields `{}`.
 */
export function normalizeStoreApps(raw: unknown): StorefrontApps {
  if (!isPlainObject(raw)) return {};
  const apps: StorefrontApps = {};
  for (const key of STORE_APP_KEYS) {
    const entry = raw[key];
    if (!isPlainObject(entry) || entry.enabled !== true) continue;
    const normalized: StorefrontAppEntry = { enabled: true };
    if (isPlainObject(entry.settings)) normalized.settings = entry.settings;
    apps[key] = normalized;
  }
  return apps;
}

/** The enabled entry for `key`, or null when the app is off / unknown. */
export function getStoreApp(
  store: { apps?: StorefrontApps | null } | null | undefined,
  key: StoreAppKey,
): StorefrontAppEntry | null {
  const entry = store?.apps?.[key];
  return entry && entry.enabled === true ? entry : null;
}

export function isAppEnabled(
  store: { apps?: StorefrontApps | null } | null | undefined,
  key: StoreAppKey,
): boolean {
  return getStoreApp(store, key) !== null;
}
