'use client';

// The bodies of the filter groups (collection, type, colour, size, price,
// availability) and the active-filter chips of the filtered listing. Shared
// by the desktop dropdowns, the desktop rail and the phone sheet: each body
// only reads the facets and calls `onChange` with the next filter state.

import { useId, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Check, X } from 'lucide-react';
import { dualColorBackground, resolveColor } from '@/lib/swatches';
import type { ListingFilterKey } from '@/lib/listingFilters/settings';
import {
  activeFilterCount,
  clearFilters,
  facetKey,
  toggleValue,
  type FilterState,
  type ListFacetKey,
} from '@/lib/listingFilters/query';
import type { FacetValue, ListingFacets } from '@/lib/listingFilters/types';
import { formatLocale } from '@/lib/storeLocales';

export interface GroupContext {
  facets: ListingFacets;
  state: FilterState;
  /** `group`: continuous input (price) that writes one history entry per gesture. */
  onChange: (next: FilterState, opts?: { debounce?: number; group?: string }) => void;
  currency?: string;
  locale: string;
  /** Collection page: only this collection's children are offered. */
  baseCollection?: string;
}

const COLLAPSED_ROWS = 8;

/** The collection values a page offers, flattened in tree order with depth. */
export function collectionOptions(
  facets: ListingFacets,
  baseCollection?: string,
): Array<FacetValue & { depth: number }> {
  const all = facets.collection;
  if (baseCollection) {
    const base = facetKey(baseCollection);
    return all.filter((c) => c.parent === base).map((c) => ({ ...c, depth: 0 }));
  }
  const known = new Set(all.map((c) => c.value));
  const out: Array<FacetValue & { depth: number }> = [];
  const walk = (parent: string | null, depth: number) => {
    for (const c of all) {
      const p = c.parent && known.has(c.parent) ? c.parent : null;
      if (p !== parent) continue;
      out.push({ ...c, depth });
      if (depth < 2) walk(c.value, depth + 1);
    }
  };
  walk(null, 0);
  return out;
}

/** Which groups have something to offer on this page, in the store's order. */
export function availableGroups(
  keys: ListingFilterKey[],
  facets: ListingFacets | null,
  state: FilterState,
  baseCollection?: string,
): ListingFilterKey[] {
  if (!facets) return [];
  return keys.filter((k) => {
    switch (k) {
      case 'collection':
        return collectionOptions(facets, baseCollection).length > 0 || state.collection.length > 0;
      case 'type':
        return facets.type.length > 1 || state.type.length > 0;
      case 'color':
        return facets.color.length > 0 || state.color.length > 0;
      case 'size':
        return facets.size.length > 0 || state.size.length > 0;
      case 'price':
        return (
          (facets.price !== null && facets.price.max > facets.price.min) ||
          state.price_min !== undefined ||
          state.price_max !== undefined
        );
      case 'availability':
        return true;
    }
  });
}

/** Selected count of one group (the badge of its trigger). */
export function groupCount(key: ListingFilterKey, s: FilterState): number {
  if (key === 'price') return s.price_min !== undefined || s.price_max !== undefined ? 1 : 0;
  if (key === 'availability') return s.in_stock ? 1 : 0;
  return s[key].length;
}

export function useGroupTitle() {
  const t = useTranslations('listing');
  return (key: ListingFilterKey) =>
    ({
      collection: t('collection'),
      type: t('type'),
      color: t('color'),
      size: t('size'),
      price: t('price'),
      availability: t('availability'),
    })[key];
}

export function GroupBody({ group, ctx }: { group: ListingFilterKey; ctx: GroupContext }) {
  switch (group) {
    case 'collection':
      return <CheckList ctx={ctx} field="collection" options={collectionOptions(ctx.facets, ctx.baseCollection)} />;
    case 'type':
      return <CheckList ctx={ctx} field="type" options={ctx.facets.type.map((v) => ({ ...v, depth: 0 }))} />;
    case 'color':
      return <ColorList ctx={ctx} />;
    case 'size':
      return <SizeGrid ctx={ctx} />;
    case 'price':
      return <PriceRange ctx={ctx} />;
    case 'availability':
      return <StockSwitch ctx={ctx} />;
  }
}

/**
 * The facet's values in its own order, plus any selected value it no longer
 * lists (so a chosen value never disappears from under the pointer).
 */
function withSelected<T extends FacetValue>(options: T[], selected: string[], make: (v: string) => T): T[] {
  const missing = selected.filter((v) => !options.some((o) => o.value === v));
  return [...options, ...missing.map(make)];
}

function CheckList({
  ctx,
  field,
  options,
}: {
  ctx: GroupContext;
  field: Extract<ListFacetKey, 'collection' | 'type'>;
  options: Array<FacetValue & { depth: number }>;
}) {
  const t = useTranslations('listing');
  const [open, setOpen] = useState(false);
  const selected = ctx.state[field];
  const list = withSelected(options, selected, (v) => ({ value: v, label: v, count: 0, depth: 0 }));
  const visible = open ? list : list.slice(0, COLLAPSED_ROWS);
  return (
    <div className="lx-options">
      {visible.map((o) => {
        const checked = selected.includes(o.value);
        const disabled = !checked && o.count === 0;
        return (
          <label key={o.value} className="lx-option" data-depth={o.depth} data-disabled={disabled || undefined}>
            <input
              type="checkbox"
              checked={checked}
              disabled={disabled}
              onChange={() => ctx.onChange(toggleValue(ctx.state, field, o.value))}
              aria-label={t('optionWithCount', { label: o.label, count: o.count })}
            />
            <span className="lx-box" aria-hidden="true">
              <Check strokeWidth={3} />
            </span>
            <span className="lx-option-label" aria-hidden="true">
              {o.label}
            </span>
            <span className="lx-option-count" aria-hidden="true">
              {o.count}
            </span>
          </label>
        );
      })}
      {list.length > COLLAPSED_ROWS && (
        <button type="button" className="lx-more" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
          {open ? t('showLess') : t('showMore', { count: list.length - COLLAPSED_ROWS })}
        </button>
      )}
    </div>
  );
}

/** CSS background of a colour value: seller colours first, else its name. */
export function swatchBackground(v: { label: string; swatch?: string; swatch2?: string }): string | null {
  if (v.swatch && v.swatch2) return dualColorBackground([v.swatch, v.swatch2]);
  if (v.swatch) return v.swatch;
  return resolveColor(v.label) ?? resolveColor(v.label.split(/[\s/-]/)[0] ?? '');
}

function ColorList({ ctx }: { ctx: GroupContext }) {
  const t = useTranslations('listing');
  const selected = ctx.state.color;
  const list = withSelected(ctx.facets.color, selected, (v) => ({ value: v, label: v, count: 0 }));
  return (
    <div className="lx-swatches">
      {list.map((o) => {
        const checked = selected.includes(o.value);
        const disabled = !checked && o.count === 0;
        const bg = swatchBackground(o);
        return (
          <label key={o.value} className="lx-swatch-opt" data-disabled={disabled || undefined}>
            <input
              type="checkbox"
              checked={checked}
              disabled={disabled}
              onChange={() => ctx.onChange(toggleValue(ctx.state, 'color', o.value))}
              aria-label={t('optionWithCount', { label: o.label, count: o.count })}
            />
            <span
              className={`lx-swatch ${bg ? '' : 'lx-swatch-none'}`}
              style={bg ? { background: bg } : undefined}
              aria-hidden="true"
            />
            <span className="lx-option-label truncate" aria-hidden="true">
              {o.label}
            </span>
            <span className="lx-option-count" aria-hidden="true">
              {o.count}
            </span>
          </label>
        );
      })}
    </div>
  );
}

function SizeGrid({ ctx }: { ctx: GroupContext }) {
  const t = useTranslations('listing');
  const selected = ctx.state.size;
  const list = withSelected(ctx.facets.size, selected, (v) => ({ value: v, label: v.toUpperCase(), count: 0 }));
  return (
    <div className="lx-sizes">
      {list.map((o) => {
        const checked = selected.includes(o.value);
        const disabled = !checked && o.count === 0;
        return (
          <label key={o.value} className="lx-size" data-disabled={disabled || undefined} title={String(o.count)}>
            <input
              type="checkbox"
              checked={checked}
              disabled={disabled}
              onChange={() => ctx.onChange(toggleValue(ctx.state, 'size', o.value))}
              aria-label={t('optionWithCount', { label: o.label, count: o.count })}
            />
            <span aria-hidden="true">{o.label}</span>
          </label>
        );
      })}
    </div>
  );
}

function StockSwitch({ ctx }: { ctx: GroupContext }) {
  const t = useTranslations('listing');
  return (
    <label className="lx-switch">
      <span>
        {t('inStockOnly')} <span className="lx-option-count">({ctx.facets.in_stock.count})</span>
      </span>
      <input
        type="checkbox"
        role="switch"
        checked={ctx.state.in_stock}
        onChange={(e) => ctx.onChange({ ...ctx.state, in_stock: e.target.checked })}
      />
      <span className="lx-switch-track" aria-hidden="true" />
    </label>
  );
}

/** Whole currency units for the price fields (prices are stored with cents). */
function bounds(f: ListingFacets['price']): { lo: number; hi: number } {
  if (!f) return { lo: 0, hi: 0 };
  return { lo: Math.floor(f.min), hi: Math.ceil(f.max) };
}

function PriceRange({ ctx }: { ctx: GroupContext }) {
  const t = useTranslations('listing');
  const id = useId();
  const { lo, hi } = bounds(ctx.facets.price);
  // The slider range never shrinks under an active price filter (the facet
  // range ignores the price filter itself), so the thumbs stay where they are.
  const min = Math.min(lo, ctx.state.price_min ?? lo);
  const max = Math.max(hi, ctx.state.price_max ?? hi);
  const [from, setFrom] = useState<number>(ctx.state.price_min ?? min);
  const [to, setTo] = useState<number>(ctx.state.price_max ?? max);
  const [fromText, setFromText] = useState(String(ctx.state.price_min ?? min));
  const [toText, setToText] = useState(String(ctx.state.price_max ?? max));

  // Follow outside changes (chip removed, clear all, back button): reset the
  // local values while rendering when the filter or the range moved.
  const external = `${ctx.state.price_min ?? ''}|${ctx.state.price_max ?? ''}|${min}|${max}`;
  const [seen, setSeen] = useState(external);
  if (seen !== external) {
    setSeen(external);
    setFrom(ctx.state.price_min ?? min);
    setTo(ctx.state.price_max ?? max);
    setFromText(String(ctx.state.price_min ?? min));
    setToText(String(ctx.state.price_max ?? max));
  }

  const commit = (a: number, b: number, debounce = 450) => {
    const lowV = Math.max(min, Math.min(a, b));
    const highV = Math.min(max, Math.max(a, b));
    const next: FilterState = { ...ctx.state };
    if (lowV > min) next.price_min = lowV;
    else delete next.price_min;
    if (highV < max) next.price_max = highV;
    else delete next.price_max;
    // Own change: mark it seen so the values typed or dragged are kept.
    setSeen(`${next.price_min ?? ''}|${next.price_max ?? ''}|${min}|${max}`);
    ctx.onChange(next, { debounce, group: 'price' });
  };

  const fmt = useMemo(() => {
    try {
      return new Intl.NumberFormat(formatLocale(ctx.locale), {
        style: 'currency',
        currency: ctx.currency || 'EUR',
        maximumFractionDigits: 0,
      });
    } catch {
      return new Intl.NumberFormat(formatLocale(ctx.locale), { maximumFractionDigits: 0 });
    }
  }, [ctx.locale, ctx.currency]);
  const span = Math.max(1, max - min);
  const pct = (v: number) => ((v - min) / span) * 100;
  const step = span > 2000 ? 10 : 1;
  const currencyLabel = ctx.currency ? ` (${ctx.currency})` : '';

  return (
    <div>
      <div className="lx-price-fields">
        <label htmlFor={`${id}-min`}>
          {t('priceFrom')}
          {currencyLabel}
          <input
            id={`${id}-min`}
            inputMode="numeric"
            value={fromText}
            onChange={(e) => {
              const raw = e.target.value.replace(/[^\d]/g, '');
              setFromText(raw);
              const n = Number(raw);
              if (raw && Number.isFinite(n)) {
                setFrom(n);
                commit(n, to, 700);
              }
            }}
            onBlur={() => setFromText(String(from))}
          />
        </label>
        <span className="lx-price-dash" aria-hidden="true">
          –
        </span>
        <label htmlFor={`${id}-max`}>
          {t('priceTo')}
          {currencyLabel}
          <input
            id={`${id}-max`}
            inputMode="numeric"
            value={toText}
            onChange={(e) => {
              const raw = e.target.value.replace(/[^\d]/g, '');
              setToText(raw);
              const n = Number(raw);
              if (raw && Number.isFinite(n)) {
                setTo(n);
                commit(from, n, 700);
              }
            }}
            onBlur={() => setToText(String(to))}
          />
        </label>
      </div>
      <div className="lx-range">
        <div className="lx-range-track" />
        <div
          className="lx-range-fill"
          style={{ insetInlineStart: `${pct(Math.min(from, to))}%`, insetInlineEnd: `${100 - pct(Math.max(from, to))}%` }}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={from}
          aria-label={t('priceMin')}
          aria-valuetext={fmt.format(from)}
          onChange={(e) => {
            const n = Math.min(Number(e.target.value), to);
            setFrom(n);
            setFromText(String(n));
            commit(n, to);
          }}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={to}
          aria-label={t('priceMax')}
          aria-valuetext={fmt.format(to)}
          onChange={(e) => {
            const n = Math.max(Number(e.target.value), from);
            setTo(n);
            setToText(String(n));
            commit(from, n);
          }}
        />
      </div>
      <p className="lx-count mt-1 flex justify-between" aria-hidden="true">
        <span>{fmt.format(min)}</span>
        <span>{fmt.format(max)}</span>
      </p>
    </div>
  );
}

// ── Chips ────────────────────────────────────────────────────────────────

interface Chip {
  id: string;
  label: string;
  dot?: string | null;
  remove: () => FilterState;
}

export function useChips(state: FilterState, facets: ListingFacets | null, currency: string | undefined, locale: string): Chip[] {
  const t = useTranslations('listing');
  const fmt = (n: number) => {
    try {
      return new Intl.NumberFormat(formatLocale(locale), { style: 'currency', currency: currency || 'EUR', maximumFractionDigits: 0 }).format(n);
    } catch {
      return String(n);
    }
  };
  const chips: Chip[] = [];
  const find = (key: ListFacetKey, v: string) =>
    (facets?.[key] as Array<FacetValue & { swatch?: string; swatch2?: string }> | undefined)?.find((o) => o.value === v);
  for (const key of ['collection', 'type', 'color', 'size'] as const) {
    for (const v of state[key]) {
      const hit = find(key, v);
      chips.push({
        id: `${key}:${v}`,
        label: hit?.label ?? (key === 'size' ? v.toUpperCase() : v),
        dot: key === 'color' ? swatchBackground(hit ?? { label: v }) : undefined,
        remove: () => toggleValue(state, key, v),
      });
    }
  }
  if (state.price_min !== undefined || state.price_max !== undefined) {
    const label =
      state.price_min !== undefined && state.price_max !== undefined
        ? `${fmt(state.price_min)} – ${fmt(state.price_max)}`
        : state.price_min !== undefined
          ? t('priceAtLeast', { price: fmt(state.price_min) })
          : t('priceAtMost', { price: fmt(state.price_max!) });
    chips.push({
      id: 'price',
      label,
      remove: () => {
        const next = { ...state };
        delete next.price_min;
        delete next.price_max;
        return next;
      },
    });
  }
  if (state.in_stock) chips.push({ id: 'in_stock', label: t('inStockOnly'), remove: () => ({ ...state, in_stock: false }) });
  return chips;
}

export function ActiveChips({
  state,
  facets,
  currency,
  locale,
  onChange,
}: {
  state: FilterState;
  facets: ListingFacets | null;
  currency?: string;
  locale: string;
  onChange: (next: FilterState) => void;
}) {
  const t = useTranslations('listing');
  const chips = useChips(state, facets, currency, locale);
  if (!chips.length) return null;
  return (
    <div className="lx-chips" role="group" aria-label={t('activeFilters')}>
      {chips.map((c) => (
        <button
          key={c.id}
          type="button"
          className="lx-chip"
          onClick={() => onChange(c.remove())}
          aria-label={t('removeFilter', { label: c.label })}
        >
          {c.dot !== undefined && (
            <span
              className={`lx-chip-dot ${c.dot ? '' : 'lx-swatch-none'}`}
              style={c.dot ? { background: c.dot } : undefined}
              aria-hidden="true"
            />
          )}
          <span>{c.label}</span>
          <X aria-hidden="true" />
        </button>
      ))}
      {activeFilterCount(state) > 1 && (
        <button type="button" className="lx-clear-all" onClick={() => onChange(clearFilters(state))}>
          {t('clearAll')}
        </button>
      )}
    </div>
  );
}
