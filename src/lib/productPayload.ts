// Client projection of the storefront product payload (RSC payload size).
//
// The product page hands the product to client components (ProductDetailClient,
// the product magic sections), so every byte of it is serialised into the
// flight payload. The API sends every locale's translation rows and some
// columns no client code reads. This keeps what the client can render:
//
// - translation rows: the request locale, the primary locale, 'en' and the
//   original first row (order kept), so every client fallback chain
//   (locale → primary → en → first) resolves to the same row as before;
// - row foreign keys / ids and SEO-only columns are dropped;
// - variants lose columns the client never reads;
// - `creator_categories` keeps only its first node (the breadcrumb fallback).
//
// JSON-LD and metadata keep using the full product on the server.

type Row = Record<string, unknown>;

const isObj = (v: unknown): v is Row => !!v && typeof v === 'object' && !Array.isArray(v);

// Top-level product columns no client component reads.
const DROP_PRODUCT_KEYS = [
  'created_at',
  'updated_at',
  'creator_id',
  'provider_id',
  'category_id',
  'shipping_profile_id',
  'tax_class_id',
  'tax_exempt',
  'is_featured',
];

// Variant columns no client component reads (`stock` / `price` are the read ones).
const DROP_VARIANT_KEYS = ['product_id', 'price_adjustment', 'stock_quantity'];

// Collection node columns no client component reads.
const DROP_NODE_KEYS = ['created_at', 'updated_at', 'noindex_when_empty', 'visibility'];

// Translation row columns no client component reads (SEO is server-side).
const DROP_ROW_KEYS = new Set(['id', 'meta_title', 'meta_desc']);

/** Drops `id`, foreign keys (`*_id`) and SEO columns from a translation row. */
function slimRow(row: Row): Row {
  const out: Row = {};
  for (const [k, v] of Object.entries(row)) {
    if (DROP_ROW_KEYS.has(k) || k.endsWith('_id')) continue;
    out[k] = v;
  }
  return out;
}

/**
 * Translation rows the client can pick: request locale, primary locale, 'en'
 * and the first row, in their original order. Non-array input is returned
 * unchanged (some payloads use locale-keyed records).
 */
export function pickTranslationRows<T>(rows: T, locale: string, primaryLocale: string): T {
  if (!Array.isArray(rows)) return rows;
  const keep = new Set([locale, primaryLocale, 'en']);
  return rows
    .filter((r, i) => i === 0 || (isObj(r) && keep.has(r.locale as string)))
    .map((r) => (isObj(r) ? slimRow(r) : r)) as T;
}

function withRows<T>(obj: T, locale: string, primaryLocale: string): T {
  if (!isObj(obj) || !('translations' in obj)) return obj;
  return { ...obj, translations: pickTranslationRows(obj.translations, locale, primaryLocale) } as T;
}

function omit(obj: Row, keys: readonly string[]): Row {
  const out: Row = { ...obj };
  for (const k of keys) delete out[k];
  return out;
}

function mapArr(v: unknown, fn: (x: unknown) => unknown): unknown {
  return Array.isArray(v) ? v.map(fn) : v;
}

function slimNode(node: unknown, locale: string, primaryLocale: string): unknown {
  if (!isObj(node)) return node;
  const out = withRows(omit(node, DROP_NODE_KEYS), locale, primaryLocale);
  if (Array.isArray(out.children)) out.children = out.children.map((c) => slimNode(c, locale, primaryLocale));
  return out;
}

function slimField(field: unknown, locale: string, primaryLocale: string): unknown {
  if (!isObj(field)) return field;
  const out = withRows(field, locale, primaryLocale);
  if (Array.isArray(out.children)) out.children = out.children.map((c) => slimField(c, locale, primaryLocale));
  return out;
}

/**
 * The product as the client renders it for one locale. Pure; the input is
 * not mutated. Unknown keys are kept as they are.
 */
export function projectProductForClient<T extends object>(product: T, locale: string, primaryLocale: string): T {
  if (!isObj(product)) return product;
  const p = omit(product, DROP_PRODUCT_KEYS);
  const rows = <V,>(v: V) => withRows(v, locale, primaryLocale);

  if ('translations' in p) p.translations = pickTranslationRows(p.translations, locale, primaryLocale);
  if ('custom_fields' in p) p.custom_fields = mapArr(p.custom_fields, (f) => slimField(f, locale, primaryLocale));
  if ('faqs' in p) p.faqs = mapArr(p.faqs, rows);
  if ('promotions' in p) p.promotions = mapArr(p.promotions, rows);
  if ('category' in p) p.category = slimNode(p.category, locale, primaryLocale);
  if ('primary_collection_path' in p) {
    p.primary_collection_path = mapArr(p.primary_collection_path, (n) => slimNode(n, locale, primaryLocale));
  }
  // Only `[0]` is read (breadcrumb fallback without a primary collection path).
  if (Array.isArray(p.creator_categories)) {
    p.creator_categories = p.creator_categories.slice(0, 1).map((n) => slimNode(n, locale, primaryLocale));
  }
  if ('bundles' in p) {
    p.bundles = mapArr(p.bundles, (b) => {
      const out = rows(b);
      if (isObj(out) && Array.isArray(out.offers)) out.offers = out.offers.map(rows);
      return out;
    });
  }
  if ('attributes' in p) {
    p.attributes = mapArr(p.attributes, (a) =>
      isObj(a) && isObj(a.template) ? { ...a, template: rows(a.template) } : a,
    );
  }
  if ('variants' in p) p.variants = mapArr(p.variants, (v) => (isObj(v) ? omit(v, DROP_VARIANT_KEYS) : v));
  return p as T;
}
