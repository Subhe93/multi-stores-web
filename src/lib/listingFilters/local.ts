// In-browser listing of the dev demo route: the same filters, facets, order
// and pages as the API, computed over the demo fixture rows. Never used by a
// live store (they always filter on the API).

import {
  normalizeFacetQuery,
  runFacets,
  toFacetRow,
  type FacetCollection,
  type FacetRow,
} from './facetEngine';
import { labelsForLocale, type LabelRow } from '@/lib/variantOptionLabels';
import { toApiFilters, type FilterState } from './query';
import type { ListingFacets } from './types';

/** A demo product row (list payload) plus the demo's collection links. */
export interface LocalRow {
  id: string;
  base_price: number | string;
  created_at?: string;
  track_inventory?: boolean | null;
  stock_quantity?: number | null;
  variant_option_config?: unknown;
  variants?: Array<{ options?: unknown; stock?: number | null; stock_quantity?: number | null; is_active?: boolean | null }>;
  translations?: Array<{ locale: string; title?: string }>;
  /** Collection slugs (demo fixture only). */
  _collections?: string[];
  [extra: string]: unknown;
}

export interface LocalCollection {
  slug: string;
  label: string;
  parent?: string | null;
}

export interface LocalSource {
  rows: LocalRow[];
  collections: LocalCollection[];
}

export interface LocalPage {
  items: LocalRow[];
  total: number;
  has_more: boolean;
  facets: ListingFacets;
}

function titleOf(row: LocalRow, locale: string): string {
  const trs = row.translations ?? [];
  return (trs.find((t) => t.locale === locale) ?? trs[0])?.title ?? '';
}

export function localPage(
  source: LocalSource,
  state: FilterState,
  opts: { locale: string; page: number; limit: number },
): LocalPage {
  const search = state.search?.toLowerCase();
  const base = source.rows.filter(
    (r) => !search || (r.translations ?? []).some((t) => (t.title ?? '').toLowerCase().includes(search)),
  );
  const rows: FacetRow[] = base.map((r, i) =>
    toFacetRow({
      kind: 'p',
      id: r.id,
      // Fixture order = newest first when the rows carry no date.
      created_at: new Date(r.created_at ?? Date.UTC(2026, 0, 1) - i * 60_000),
      price: Number(r.base_price),
      title: titleOf(r, opts.locale),
      category_id: null,
      links: r._collections ?? [],
      track_inventory: r.track_inventory === true,
      stock_quantity: r.stock_quantity,
      variants: (r.variants ?? []).map((v) => ({
        options: v.options,
        stock_quantity: typeof v.stock === 'number' ? v.stock : v.stock_quantity,
        is_active: v.is_active,
      })),
      variant_option_config: r.variant_option_config,
      optionLabels:
        labelsForLocale(r.translations as LabelRow[] | undefined, opts.locale) ??
        labelsForLocale(
          (r.product as { translations?: LabelRow[] } | null | undefined)?.translations,
          opts.locale,
        ),
    }),
  );
  const collections: FacetCollection[] = source.collections.map((c, i) => ({
    id: c.slug,
    slug: c.slug,
    parent_id: c.parent ?? null,
    sort_order: i,
    match_rule: 'MANUAL',
    match_tags: [],
    label: c.label,
  }));
  const { filters } = normalizeFacetQuery({ ...toApiFilters(state) });
  const { matched, facets } = runFacets({ rows, filters, collections, categories: [] }, true);

  const order = [...matched];
  if (state.sort === 'price_asc') order.sort((a, b) => a.price - b.price);
  else if (state.sort === 'price_desc') order.sort((a, b) => b.price - a.price);
  else if (state.sort === 'name') {
    const coll = new Intl.Collator(opts.locale, { sensitivity: 'base', numeric: true });
    order.sort((a, b) => coll.compare(a.title ?? '', b.title ?? ''));
  }
  const byId = new Map(base.map((r) => [r.id, r]));
  const start = (opts.page - 1) * opts.limit;
  const window = order.slice(start, start + opts.limit);
  return {
    items: window.map((r) => byId.get(r.id)!),
    total: order.length,
    has_more: start + opts.limit < order.length,
    facets: facets as ListingFacets,
  };
}
