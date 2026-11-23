'use client';

// Filtered product listing ("explorer") of a store that opted in with
// `theme_customizations.listing` (lib/listingFilters/settings.ts): filters
// with counts, active chips, sort, a column switch and "load more".
//
// The route renders the first page on the server (`init`); every change
// after that is fetched from the browser with the same paged request, so the
// page never reloads. The filters live in the URL (pushState: shareable, the
// back button steps through them; popstate re-reads the URL). Requests are
// debounced and an older answer never overwrites a newer one.
//
// Desktop: a sticky bar of dropdowns (`style: 'bar'`) or a side rail
// (`style: 'rail'`). Phones: a "Filters" button opens a bottom sheet that
// edits a draft; its Apply button shows the count of the draft.

import './explorer.css';
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronDown, Search, SlidersHorizontal } from 'lucide-react';
import { StoreProductCard } from '@/components/product/card/StoreProductCard';
import { ListingLoadMore } from '@/components/listing/ListingLoadMore';
import { ListingPageLinks } from '@/components/listing/ListingPageLinks';
import { buildListingPager, listingTotalPages, parseListingPage } from '@/lib/listingPageParam';
import { useMarket } from '@/hooks/useMarket';
import { resolveMediaUrl, storefront } from '@/lib/api';
import { toListingCard, type StorefrontProductRow } from '@/lib/listing';
import { withCardExtras, type CardSourceRow } from '@/lib/productCard/model';
import { productLinkSlug } from '@/lib/productPaths';
import { EXPLORER_PAGE_SIZE, explorerPageParams, type ExplorerInit } from '@/lib/listingFilters/explorer';
import { localPage } from '@/lib/listingFilters/local';
import {
  EXPLORER_SORTS,
  activeFilterCount,
  clearFilters,
  parseFilterState,
  stateKey,
  toPageQuery,
  type ExplorerSort,
  type FilterState,
} from '@/lib/listingFilters/query';
import type { ListingFilterKey, ListingDensity, ListingMobileDensity } from '@/lib/listingFilters/settings';
import type { ListingFacets } from '@/lib/listingFilters/types';
import type { ListingProduct } from '@/themes/types';
import { stagger, type MotionProp } from '@/themes/creative/recipes';
import { ActiveChips, GroupBody, availableGroups, groupCount, useGroupTitle, type GroupContext } from './FilterControls';
import { FilterDropdown, FilterSheet } from './FilterOverlays';

/**
 * URL keys the explorer owns; every other query key of the page is kept.
 * `page` (M166 A) is owned too: any filter or sort change goes back to page 1.
 */
const OWN_KEYS = ['search', 'collection', 'type', 'color', 'size', 'price_min', 'price_max', 'in_stock', 'sort', 'creator_category', 'page'];

interface Result {
  key: string;
  products: ListingProduct[];
  total: number;
  hasMore: boolean;
  facets: ListingFacets | null;
  /** Last page loaded. */
  page: number;
  /** First page shown (`?page=N` on the server, else 1). */
  first: number;
}

interface Preview {
  key: string;
  total: number;
  facets: ListingFacets | null;
}

// Grid classes per column count (static strings for Tailwind).
const MOBILE_COLS: Record<ListingMobileDensity, string> = { 1: 'grid-cols-1', 2: 'grid-cols-2' };
const DESKTOP_COLS: Record<'bar' | 'rail', Record<ListingDensity, string>> = {
  bar: { 2: 'md:grid-cols-2', 3: 'md:grid-cols-3', 4: 'md:grid-cols-3 lg:grid-cols-4' },
  rail: { 2: 'md:grid-cols-2', 3: 'md:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3', 4: 'md:grid-cols-3 xl:grid-cols-4' },
};
const CARD_SIZES: Record<ListingDensity, string> = {
  2: '(min-width: 768px) 50vw, 50vw',
  3: '(min-width: 768px) 33vw, 50vw',
  4: '(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw',
};

function promotionLabelFor(product: ListingProduct): string | undefined {
  const promo = (
    product.promotions as Array<{ type?: string; value?: unknown; translations?: Array<{ title?: string }> }> | undefined
  )?.[0];
  if (!promo) return undefined;
  if (promo.type === 'PERCENTAGE' || promo.type === 'FLASH_SALE') return `${promo.value}% off`;
  if (promo.type === 'FREE_SHIPPING') return 'Free Shipping';
  return promo.translations?.[0]?.title || 'Offer';
}

function readStored<T extends number>(key: string, allowed: readonly T[]): T | null {
  try {
    const n = Number(window.localStorage.getItem(key));
    return (allowed as readonly number[]).includes(n) ? (n as T) : null;
  } catch {
    return null;
  }
}

function writeStored(key: string, value: number) {
  try {
    window.localStorage.setItem(key, String(value));
  } catch {
    // Private mode / blocked storage: the choice lasts for this page only.
  }
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

export function ListingExplorer({
  init,
  motion,
  aspectClass,
}: {
  init: ExplorerInit;
  /** Store motion style (`storeMotionOf`). Unset = no motion attributes. */
  motion?: MotionProp;
  /** Image aspect of the builder section (built-in routes: the card's own). */
  aspectClass?: string;
}) {
  const t = useTranslations('listing');
  const tp = useTranslations('product');
  const tc = useTranslations('common');
  const groupTitle = useGroupTitle();
  const market = useMarket();
  const marketKey = market?.key;
  const marketPreview = market?.preview === true;
  const { settings, locale, currency } = init;
  const legacyCollection = init.kind === 'catalog';

  const toCard = useCallback(
    (row: StorefrontProductRow) =>
      init.card ? withCardExtras(toListingCard(row), row as unknown as CardSourceRow, locale) : toListingCard(row),
    [init.card, locale],
  );

  const [state, setState] = useState<FilterState>(init.state);
  const [result, setResult] = useState<Result>(() => ({
    key: stateKey(init.state),
    products: init.products,
    total: init.total,
    hasMore: init.hasMore,
    facets: init.facets,
    page: init.page ?? 1,
    first: init.page ?? 1,
  }));
  const [loading, setLoading] = useState<false | 'replace' | 'more'>(false);
  const [skeleton, setSkeleton] = useState(false);
  const [error, setError] = useState(false);
  const [searchText, setSearchText] = useState(init.state.search ?? '');
  const reqId = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  // ── Data ──────────────────────────────────────────────────────────────
  const fetchPage = useCallback(
    async (s: FilterState, page: number, limit: number) => {
      if (init.local) {
        const r = localPage(init.local, s, { locale, page, limit });
        return { items: r.items.map((x) => toCard(x as unknown as StorefrontProductRow)), total: r.total, hasMore: r.has_more, facets: r.facets };
      }
      const marketRef = marketKey ? (marketPreview ? { key: marketKey, preview: true as const } : { key: marketKey }) : undefined;
      const res = await storefront.getProductsPage(
        init.storeSlug,
        explorerPageParams({ locale, baseCollection: init.baseCollection, state: s, card: init.card, page, limit }),
        marketRef,
      );
      return {
        items: (res.items as StorefrontProductRow[]).map(toCard),
        total: res.total,
        hasMore: res.has_more,
        facets: res.facets ?? null,
      };
    },
    [init.local, init.storeSlug, init.baseCollection, init.card, locale, marketKey, marketPreview, toCard],
  );

  const stickyTop = useRef(0);
  const scrollToTop = useCallback(() => {
    const el = rootRef.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top;
    if (top >= 0) return;
    window.scrollTo({ top: window.scrollY + top - stickyTop.current - 8, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  }, []);

  const load = useCallback(
    (s: FilterState, startPage = 1) => {
      const id = ++reqId.current;
      setLoading('replace');
      setError(false);
      const skeletonTimer = setTimeout(() => {
        if (reqId.current === id) setSkeleton(true);
      }, 350);
      fetchPage(s, startPage, EXPLORER_PAGE_SIZE)
        .then((r) => {
          if (reqId.current !== id) return;
          setResult((prev) => ({
            key: stateKey(s),
            products: r.items,
            total: r.total,
            hasMore: r.hasMore,
            facets: r.facets ?? prev.facets,
            page: startPage,
            first: startPage,
          }));
          scrollToTop();
        })
        .catch(() => {
          if (reqId.current === id) setError(true);
        })
        .finally(() => {
          clearTimeout(skeletonTimer);
          if (reqId.current === id) {
            setLoading(false);
            setSkeleton(false);
          }
        });
    },
    [fetchPage, scrollToTop],
  );

  const pageUrl = useCallback((s: FilterState) => {
    const params = new URLSearchParams(window.location.search);
    for (const k of OWN_KEYS) params.delete(k);
    const own = new URLSearchParams(toPageQuery(s));
    for (const [k, v] of own) params.set(k, v);
    // Readable lists in the address bar (`color=black,navy`): a comma is
    // safe in a query value.
    const qs = params.toString().replace(/%2C/gi, ',');
    return `${window.location.pathname}${qs ? `?${qs}` : ''}`;
  }, []);

  // Continuous inputs (price drag, typing) write one history entry per
  // gesture: the first change pushes, the next ones within a moment replace.
  const lastWrite = useRef<{ group: string; at: number } | null>(null);

  /** Apply a new state: URL first, then the (debounced) request. */
  const apply = useCallback(
    (next: FilterState, opts: { debounce?: number; group?: string } = {}) => {
      setState(next);
      const url = pageUrl(next);
      if (url !== `${window.location.pathname}${window.location.search}`) {
        const now = Date.now();
        const prev = lastWrite.current;
        const coalesce = !!opts.group && prev?.group === opts.group && now - prev.at < 1500;
        if (coalesce) window.history.replaceState(null, '', url);
        else window.history.pushState(null, '', url);
        lastWrite.current = opts.group ? { group: opts.group, at: now } : null;
      }
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => load(next), opts.debounce ?? 150);
    },
    [load, pageUrl],
  );

  // Back / forward: the URL is the source of truth.
  useEffect(() => {
    const onPop = () => {
      if (timer.current) clearTimeout(timer.current);
      lastWrite.current = null;
      const params = new URLSearchParams(window.location.search);
      const s = parseFilterState(params, { legacyCollection });
      setState(s);
      setSearchText(s.search ?? '');
      // M166 A: a history entry of `?page=N` shows that page again.
      const pageParam = parseListingPage(params.get('page') ?? undefined);
      load(s, 'page' in pageParam ? pageParam.page : 1);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [load, legacyCollection]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  // Coming back from a product page, the router may restore the page as it
  // was first rendered while the address bar holds later filters: the URL
  // wins once on mount.
  useEffect(() => {
    const s = parseFilterState(new URLSearchParams(window.location.search), { legacyCollection });
    if (stateKey(s) === stateKey(init.state)) return;
    setState(s);
    setSearchText(s.search ?? '');
    load(s);
    // Mount only: later changes come from the shopper or popstate.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadMore = () => {
    if (!result.hasMore || loading) return;
    const id = reqId.current;
    const key = result.key;
    setLoading('more');
    setError(false);
    fetchPage(state, result.page + 1, EXPLORER_PAGE_SIZE)
      .then((r) => {
        if (reqId.current !== id) return;
        setResult((prev) => {
          if (prev.key !== key) return prev;
          const seen = new Set(prev.products.map((p) => p.id));
          return {
            ...prev,
            products: [...prev.products, ...r.items.filter((p) => !seen.has(p.id))],
            total: r.total,
            hasMore: r.hasMore,
            page: prev.page + 1,
          };
        });
      })
      .catch(() => {
        if (reqId.current === id) setError(true);
      })
      .finally(() => {
        if (reqId.current === id) setLoading(false);
      });
  };

  // ── Sticky offset under a sticky store header ────────────────────────
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const header = [...document.querySelectorAll<HTMLElement>('#store-nav-header *')].find((el) => {
      const pos = getComputedStyle(el).position;
      return pos === 'sticky' || pos === 'fixed';
    });
    const update = () => {
      const pos = header ? getComputedStyle(header).position : '';
      const h = header && (pos === 'sticky' || pos === 'fixed') ? header.getBoundingClientRect().height : 0;
      stickyTop.current = h;
      root.style.setProperty('--lx-sticky-top', `${Math.round(h)}px`);
    };
    update();
    if (!header || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(update);
    ro.observe(header);
    window.addEventListener('resize', update);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', update);
    };
  }, []);

  // ── Density (per shopper, remembered per store) ──────────────────────
  const [cols, setCols] = useState<ListingDensity>(settings.density);
  const [mcols, setMcols] = useState<ListingMobileDensity>(settings.mobileDensity);
  const densityKey = `lx.cols.${init.storeSlug}`;
  useEffect(() => {
    if (!settings.densitySwitch) return;
    const d = readStored<ListingDensity>(densityKey, [2, 3, 4]);
    const m = readStored<ListingMobileDensity>(`${densityKey}.m`, [1, 2]);
    if (d) setCols(d);
    if (m) setMcols(m);
  }, [densityKey, settings.densitySwitch]);

  // ── Search ───────────────────────────────────────────────────────────
  const onSearch = (value: string, now = false) => {
    setSearchText(value);
    const q = value.trim();
    if (q.length === 1 && !now) return;
    const next = { ...state };
    if (q) next.search = q.slice(0, 120);
    else delete next.search;
    if ((next.search ?? '') === (state.search ?? '')) return;
    apply(next, { debounce: now ? 0 : 400, group: 'search' });
  };

  // ── Phone sheet (draft) ──────────────────────────────────────────────
  const [sheetOpen, setSheetOpen] = useState(false);
  const [draft, setDraft] = useState<FilterState>(state);
  const [preview, setPreview] = useState<Preview | null>(null);
  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previewId = useRef(0);
  const openSheet = () => {
    setDraft(state);
    setPreview(null);
    setSheetOpen(true);
  };
  const closeSheet = useCallback(() => setSheetOpen(false), []);
  const changeDraft = (next: FilterState, opts: { debounce?: number } = {}) => {
    setDraft(next);
    if (previewTimer.current) clearTimeout(previewTimer.current);
    const key = stateKey(next);
    if (key === result.key) return;
    previewTimer.current = setTimeout(() => {
      const id = ++previewId.current;
      fetchPage(next, 1, 1)
        .then((r) => {
          if (previewId.current === id) setPreview({ key, total: r.total, facets: r.facets ?? null });
        })
        .catch(() => undefined);
    }, opts.debounce ?? 250);
  };
  const draftKey = stateKey(draft);
  const draftTotal = draftKey === result.key ? result.total : preview?.key === draftKey ? preview.total : null;
  const draftFacets = (preview?.key === draftKey ? preview.facets : null) ?? result.facets;

  // ── Desktop dropdowns ────────────────────────────────────────────────
  const [openGroup, setOpenGroup] = useState<ListingFilterKey | null>(null);

  // ── Derived ──────────────────────────────────────────────────────────
  const facets = result.facets;
  const groups = useMemo(
    () => availableGroups(settings.filters, facets, state, init.baseCollection),
    [settings.filters, facets, state, init.baseCollection],
  );
  const sheetGroups = availableGroups(settings.filters, draftFacets, draft, init.baseCollection);
  const filterCount = activeFilterCount(state);
  const ctx: GroupContext | null = facets
    ? {
        facets,
        state,
        onChange: (n, o) => apply(n, { debounce: o?.debounce, group: o?.group }),
        currency,
        locale,
        baseCollection: init.baseCollection,
      }
    : null;
  const products = result.products;
  const busy = loading === 'replace';
  const refined = filterCount > 0 || !!state.search;

  const sortOptions: Array<{ value: '' | ExplorerSort; label: string }> = [
    { value: '', label: tp('sortDefault') },
    ...EXPLORER_SORTS.map((s) => ({
      value: s,
      label:
        s === 'newest'
          ? tp('sortNewest')
          : s === 'price_asc'
            ? tp('sortPriceLow')
            : s === 'price_desc'
              ? tp('sortPriceHigh')
              : t('sortName'),
    })),
  ];

  // ── Pieces ───────────────────────────────────────────────────────────
  const searchField = (extra: string) => (
    <div className={`lx-search ${extra}`}>
      <Search aria-hidden="true" />
      <input
        type="search"
        enterKeyHint="search"
        value={searchText}
        placeholder={tp('searchPlaceholder')}
        aria-label={t('searchLabel')}
        onChange={(e) => onSearch(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            onSearch((e.target as HTMLInputElement).value, true);
          }
        }}
      />
    </div>
  );

  const sortSelect = (
    <label className="lx-sort">
      <span className="lx-sr">{tp('sortBy')}</span>
      <select
        value={state.sort ?? ''}
        onChange={(e) => {
          const v = e.target.value as '' | ExplorerSort;
          const next = { ...state };
          if (v) next.sort = v;
          else delete next.sort;
          apply(next, { debounce: 0 });
        }}
      >
        {sortOptions.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
    </label>
  );

  const densityIcon = (n: number) => (
    <span className="lx-density-icon" style={{ gridTemplateColumns: `repeat(${n}, 1fr)` }} aria-hidden="true">
      {Array.from({ length: n * Math.max(2, n) }, (_, i) => (
        <span key={i} />
      ))}
    </span>
  );
  const densitySwitch = settings.densitySwitch && (
    <>
      <div className="lx-density hidden md:inline-flex" role="group" aria-label={t('density')}>
        {([2, 3, 4] as const).map((n) => (
          <button
            key={n}
            type="button"
            aria-pressed={cols === n}
            aria-label={t('columns', { count: n })}
            onClick={() => {
              setCols(n);
              writeStored(densityKey, n);
            }}
          >
            {densityIcon(n)}
          </button>
        ))}
      </div>
      {/* Phones: one button that switches between one and two columns. */}
      <button
        type="button"
        className="lx-pill lx-pill-icon md:hidden"
        aria-label={t('columns', { count: mcols === 2 ? 1 : 2 })}
        onClick={() => {
          const n = mcols === 2 ? 1 : 2;
          setMcols(n);
          writeStored(`${densityKey}.m`, n);
        }}
      >
        {densityIcon(mcols === 2 ? 1 : 2)}
      </button>
    </>
  );

  const countText = t('results', { count: result.total });
  // M166 A: crawlable links to the other pages (`?page=N`) of this state.
  const pager = buildListingPager(
    { path: `${init.lp}${init.basePath}`, query: toPageQuery(state) },
    result.first,
    result.page,
    listingTotalPages(result.total, EXPLORER_PAGE_SIZE),
  );
  const filtersButton = (extra: string) =>
    facets && groups.length > 0 ? (
      <button type="button" className={`lx-pill ${extra}`} onClick={openSheet} aria-haspopup="dialog" data-active={filterCount > 0 || undefined}>
        <SlidersHorizontal className="w-4 h-4" aria-hidden="true" />
        <span>{t('filters')}</span>
        {filterCount > 0 && <span className="lx-pill-badge">{filterCount}</span>}
      </button>
    ) : null;

  const chips = <ActiveChips state={state} facets={facets} currency={currency} locale={locale} onChange={(n) => apply(n, { debounce: 0 })} />;

  const toolbar = (rail: boolean) => (
    <div className="lx-toolbar">
      <div className="lx-toolbar-row">
        {filtersButton('lg:hidden')}
        {!rail && ctx && (
          <div className="hidden lg:flex items-center gap-2 flex-wrap">
            {groups.map((g) => (
              <FilterDropdown
                key={g}
                label={groupTitle(g)}
                count={groupCount(g, state)}
                open={openGroup === g}
                onOpenChange={(o) => setOpenGroup(o ? g : null)}
                wide={g === 'color' || g === 'price'}
                footer={
                  groupCount(g, state) > 0 ? (
                    <>
                      <span className="lx-count">{countText}</span>
                      <button type="button" className="lx-clear-all" onClick={() => apply(clearGroup(state, g), { debounce: 0 })}>
                        {t('clear')}
                      </button>
                    </>
                  ) : (
                    <span className="lx-count">{countText}</span>
                  )
                }
              >
                <GroupBody group={g} ctx={ctx} />
              </FilterDropdown>
            ))}
          </div>
        )}
        <div className="lx-toolbar-end">
          {sortSelect}
          {densitySwitch}
        </div>
      </div>
      <div className="lx-toolbar-sub">
        <p className="lx-count hidden lg:block" aria-hidden="true">
          {countText}
        </p>
        {chips}
        {!rail && searchField('hidden lg:flex lx-search-compact')}
      </div>
    </div>
  );

  const [railOpen, setRailOpen] = useState<Record<string, boolean>>({});
  const rail = ctx && (
    <aside className="lx-rail hidden lg:block" aria-label={t('filters')}>
      <div className="flex items-center justify-between min-h-14">
        <h2 className="lx-label">{t('filters')}</h2>
        {filterCount > 0 && (
          <button type="button" className="lx-clear-all" onClick={() => apply(clearFilters(state), { debounce: 0 })}>
            {t('clearAll')}
          </button>
        )}
      </div>
      {searchField('mb-2')}
      {groups.map((g, i) => {
        const isOpen = railOpen[g] ?? (i < 4 || groupCount(g, state) > 0);
        const bodyId = `lx-rail-${g}`;
        return (
          <section key={g} className="lx-group">
            <button
              type="button"
              className="lx-group-head"
              aria-expanded={isOpen}
              aria-controls={bodyId}
              onClick={() => setRailOpen((o) => ({ ...o, [g]: !isOpen }))}
            >
              <span className="lx-label">
                {groupTitle(g)}
                {groupCount(g, state) > 0 && <span className="lx-option-count"> ({groupCount(g, state)})</span>}
              </span>
              <ChevronDown className="lx-chevron" aria-hidden="true" />
            </button>
            {isOpen && (
              <div id={bodyId} className="lx-group-body">
                <GroupBody group={g} ctx={ctx} />
              </div>
            )}
          </section>
        );
      })}
    </aside>
  );

  const gridClass = `lx-grid ${MOBILE_COLS[mcols]} ${DESKTOP_COLS[settings.style][cols]}`;
  const grid = skeleton ? (
    <div className={gridClass} aria-hidden="true">
      {Array.from({ length: Math.min(EXPLORER_PAGE_SIZE, Math.max(4, cols * 2)) }, (_, i) => (
        <div key={i} className="lx-skel">
          <div className={`lx-skel-media ${aspectClass ?? 'aspect-[4/5]'}`} />
          <div className="lx-skel-line" style={{ inlineSize: '72%' }} />
          <div className="lx-skel-line" style={{ inlineSize: '38%' }} />
        </div>
      ))}
    </div>
  ) : (
    <div ref={gridRef} className={gridClass} data-busy={busy || undefined} aria-busy={busy || undefined} {...stagger(motion)}>
      {products.map((product, index) => {
        const translation =
          product.translations.find((tr) => tr.locale === locale) ||
          product.translations.find((tr) => tr.locale === 'en') ||
          product.translations[0];
        const linkSlug = productLinkSlug(product.translations, locale, init.fallbackLocale) || product.id;
        return (
          <StoreProductCard
            key={product.id}
            card={product.card}
            productId={product.id}
            productSlug={linkSlug}
            href={`${init.lp}/products/${linkSlug}`}
            title={translation?.title || 'Untitled'}
            price={Number(product.base_price)}
            taxRateBp={product.tax_rate_bp}
            comparePrice={product.compare_at_price ? Number(product.compare_at_price) : undefined}
            imageUrl={product.images[0]?.url ? resolveMediaUrl(product.images[0].url) : undefined}
            currency={currency}
            promotionLabel={promotionLabelFor(product)}
            vendorName={product.vendor?.company_name}
            aspectClass={aspectClass}
            sizes={CARD_SIZES[cols]}
            priority={init.priorityFirst === true && index < 2}
            eager={index < 4}
            motion={motion}
            arriving={motion && index >= EXPLORER_PAGE_SIZE ? (index - EXPLORER_PAGE_SIZE) % cols : undefined}
          />
        );
      })}
    </div>
  );

  const empty = (
    <div className="lx-empty">
      <span className="lx-empty-mark" aria-hidden="true">
        <Search className="w-7 h-7" />
      </span>
      <h2>{refined ? t('emptyTitle') : tc('noProducts')}</h2>
      {refined && <p>{t('emptyText')}</p>}
      <div className="flex flex-wrap justify-center gap-2 mt-2">
        {filterCount > 0 && (
          <button type="button" className="lx-btn lx-btn-primary" onClick={() => apply(clearFilters(state), { debounce: 0 })}>
            {t('resetFilters')}
          </button>
        )}
        {state.search && (
          <button
            type="button"
            className="lx-btn lx-btn-ghost"
            onClick={() => {
              setSearchText('');
              const next = { ...state };
              delete next.search;
              apply(next, { debounce: 0 });
            }}
          >
            {t('clearSearch')}
          </button>
        )}
      </div>
    </div>
  );

  const failed = error && !busy && (
    <div className="lx-empty" role="alert">
      <h2>{t('error')}</h2>
      <button type="button" className="lx-btn lx-btn-ghost" onClick={() => load(state)}>
        {t('retry')}
      </button>
    </div>
  );

  const body = (
    <>
      <p className="lx-count lg:hidden mb-4" aria-hidden="true">
        {countText}
      </p>
      {!skeleton && products.length > 0 && <ListingPageLinks pager={pager} position="top" />}
      {error && products.length === 0 ? failed : products.length === 0 && !skeleton ? (busy ? grid : empty) : grid}
      {!skeleton && products.length > 0 && (result.hasMore || result.total > EXPLORER_PAGE_SIZE) && (
        <>
          <ListingLoadMore
            shown={products.length}
            total={result.total}
            hasMore={result.hasMore}
            loading={loading === 'more'}
            error={error && loading !== 'replace'}
            onLoadMore={loadMore}
            gridRef={gridRef}
            motion={motion}
            nextHref={pager.nextHref}
            offset={(result.first - 1) * EXPLORER_PAGE_SIZE}
          />
          <ListingPageLinks pager={pager} />
        </>
      )}
    </>
  );

  const sheet = (
    <FilterSheet
      open={sheetOpen}
      onClose={closeSheet}
      title={t('filters')}
      onClear={() => changeDraft(clearFilters(draft), { debounce: 0 })}
      clearDisabled={activeFilterCount(draft) === 0}
      onApply={() => {
        setSheetOpen(false);
        if (draftKey !== stateKey(state)) apply(draft, { debounce: 0 });
      }}
      applyLabel={draftTotal === null ? t('updating') : t('showResults', { count: draftTotal })}
      busy={draftTotal === null}
    >
      {draftFacets &&
        sheetGroups.map((g) => (
          <section key={g} className="lx-group" aria-labelledby={`lx-sheet-${g}`}>
            <h3 id={`lx-sheet-${g}`} className="lx-label pt-5 pb-3">
              {groupTitle(g)}
            </h3>
            <div className="lx-group-body">
              <GroupBody
                group={g}
                ctx={{
                  facets: draftFacets,
                  state: draft,
                  onChange: (n, o) => changeDraft(n, o),
                  currency,
                  locale,
                  baseCollection: init.baseCollection,
                }}
              />
            </div>
          </section>
        ))}
      <div className="pt-5 pb-2">{searchField('')}</div>
    </FilterSheet>
  );

  return (
    <div ref={rootRef} className="lx" style={{ '--lx-sticky-top': '0px' } as CSSProperties}>
      {/* One live region for the result count (the visible counts are aria-hidden). */}
      <p className="lx-sr" role="status" aria-live="polite">
        {busy ? t('updating') : countText}
      </p>
      {settings.style === 'rail' ? (
        <div className="lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-10 xl:gap-14">
          {rail}
          <div className="min-w-0">
            {toolbar(true)}
            {body}
          </div>
        </div>
      ) : (
        <>
          {toolbar(false)}
          {body}
        </>
      )}
      {sheet}
    </div>
  );
}

function clearGroup(s: FilterState, g: ListingFilterKey): FilterState {
  const next = { ...s };
  if (g === 'price') {
    delete next.price_min;
    delete next.price_max;
  } else if (g === 'availability') next.in_stock = false;
  else next[g] = [];
  return next;
}
