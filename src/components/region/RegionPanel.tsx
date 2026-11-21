'use client';

import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type FormEvent, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { Globe, Search, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { isRtl } from '@/i18n/config';
import { countryFlagUrl, resolveLocaleMeta } from '@/lib/localeMeta';
import { countryName } from '@/lib/marketSwitch';
import { formatLocale } from '@/lib/storeLocales';
import type { RegionOption } from '@/lib/region';
import { Flag } from './Flag';
import { useModalDialog } from './useModalDialog';

/**
 * Draft country of the panel: an ISO2 code, null for "Other countries" (the
 * default market), undefined while nothing is chosen (multi-country market
 * without a stored choice).
 */
export type DraftCountry = string | null | undefined;

export interface RegionPanelProps {
  open: boolean;
  onClose: () => void;
  /** Rendering locale (labels, sorting, dir). */
  locale: string;
  options: readonly RegionOption[];
  initialCountry: DraftCountry;
  initialLocale: string;
  /** THE language resolver for a draft country (regionLocales). */
  localesFor: (country: DraftCountry) => string[];
  onApply: (choice: { country: DraftCountry; locale: string }) => void;
  accent?: string;
  colors?: { bg: string; fg: string; borderColor: string };
  /** Store motion style on: the panel and backdrop carry the creative overlay hooks. */
  motion?: boolean;
  /** Exit animation running: still rendered, but inert and no longer modal. */
  closing?: boolean;
  returnFocusRef?: React.RefObject<HTMLElement | null>;
}

const SEARCH_MIN_OPTIONS = 8;

function fold(s: string): string {
  return s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

/** Language kept when the country changes: current pick, else the current locale, else the default. */
function keepLocale(list: readonly string[], picked: string, current: string): string {
  if (list.includes(picked)) return picked;
  if (list.includes(current)) return current;
  return list[0] ?? picked;
}

/**
 * The country/region + language dialog (bottom sheet below md, centred modal
 * from md). Keeps the draft local; `onApply` gets the final choice.
 */
export function RegionPanel({
  open, onClose, locale, options, initialCountry, initialLocale, localesFor, onApply, accent, colors, motion,
  closing = false, returnFocusRef,
}: RegionPanelProps) {
  const t = useTranslations('region');
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [country, setCountry] = useState<DraftCountry>(initialCountry);
  const [lang, setLang] = useState(initialLocale);
  const [query, setQuery] = useState('');

  // The scroll lock, focus trap and Escape end when the exit animation starts.
  useModalDialog(open && !closing, panelRef, onClose, returnFocusRef);

  const rows = useMemo(() => {
    const intl = formatLocale(locale, 'date') as string;
    const named = options.map((o) => ({
      ...o,
      id: o.country ?? '',
      name: o.country ? countryName(o.country, locale) : t('otherCountries'),
      en: o.country ? countryName(o.country, 'en') : 'Other countries',
    }));
    const countries = named.filter((r) => r.country).sort((a, b) => a.name.localeCompare(b.name, intl));
    return [...countries, ...named.filter((r) => !r.country)];
  }, [options, locale, t]);

  const q = fold(query.trim());
  const visible = q
    ? rows.filter((r) => fold(r.name).includes(q) || fold(r.en).includes(q) || (r.country ?? '').toLowerCase() === q)
    : rows;

  const languages = localesFor(country);
  const activeLang = keepLocale(languages, lang, initialLocale);

  // Bring the selected row into view when the panel opens.
  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector<HTMLElement>('input[type="radio"]:checked');
    el?.closest('label')?.scrollIntoView?.({ block: 'nearest' });
  }, [open]);

  if (!open || typeof document === 'undefined') return null;

  const pickCountry = (c: DraftCountry) => {
    setCountry(c);
    setLang((prev) => keepLocale(localesFor(c), prev, initialLocale));
  };

  const onSearchKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    // Enter never submits from the search field; it picks a single match.
    e.preventDefault();
    if (visible.length === 1) pickCountry(visible[0]!.country);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    onApply({ country, locale: activeLang });
  };

  // The portal sits outside `.store-root`, so the surface tokens are read
  // directly (the theme variables live on :root).
  const panelStyle: CSSProperties = colors
    ? { backgroundColor: colors.bg, color: colors.fg, borderColor: colors.borderColor }
    : {
        backgroundColor: 'var(--theme-colors-surface, #fff)',
        color: 'var(--theme-colors-text, #111827)',
        borderColor: 'var(--theme-colors-border, #e5e7eb)',
      };
  const lineColor = panelStyle.borderColor as string;
  const primary = accent || 'var(--store-primary, #2563eb)';
  const dir = isRtl(locale) ? 'rtl' : 'ltr';

  return createPortal(
    <div
      dir={dir}
      lang={locale}
      className={`fixed inset-0 z-[100] flex items-end justify-center md:items-center${closing ? ' pointer-events-none' : ''}`}
    >
      <div
        className="absolute inset-0 bg-black/40"
        aria-hidden
        onClick={onClose}
        data-testid="region-backdrop"
        {...(motion ? { 'data-cx-backdrop': 'region', ...(closing ? { 'data-cx-closing': '' } : null) } : null)}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        {...(motion ? { 'data-cx-dialog': 'region' } : null)}
        {...(closing ? { 'data-cx-closing': '', 'aria-hidden': true, inert: true } : null)}
        className="relative flex w-full flex-col border shadow-xl max-h-[85dvh] rounded-t-2xl pb-[env(safe-area-inset-bottom)] md:max-h-[80vh] md:w-[calc(100%-2rem)] md:max-w-md md:rounded-2xl md:pb-0"
        style={panelStyle}
      >
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-current opacity-20 md:hidden" aria-hidden />
        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex items-center justify-between gap-3 px-5 pb-2 pt-4">
            <h2 id={titleId} tabIndex={-1} data-autofocus className="text-base font-semibold outline-none">
              {t('title')}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label={t('close')}
              className="inline-flex size-9 items-center justify-center rounded-md hover:bg-black/5"
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4">
            <fieldset className="min-w-0">
              <legend className="mb-2 text-sm font-medium opacity-80">{t('country')}</legend>
              {rows.length > SEARCH_MIN_OPTIONS && (
                <div className="relative mb-2">
                  <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 opacity-50" aria-hidden />
                  <input
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={onSearchKey}
                    placeholder={t('search')}
                    aria-label={t('search')}
                    className="h-10 w-full rounded-lg border bg-transparent pe-3 ps-9 text-sm outline-none focus-visible:ring-2"
                    style={{ borderColor: lineColor }}
                  />
                </div>
              )}
              <div ref={listRef} className="max-h-64 overflow-y-auto rounded-lg border" style={{ borderColor: lineColor }}>
                {visible.map((r) => {
                  const checked = country === r.country;
                  return (
                    <label
                      key={r.id || 'other'}
                      className="flex cursor-pointer items-center gap-3 px-3 py-2.5 text-sm hover:bg-black/5"
                      style={checked ? { color: primary } : undefined}
                    >
                      <input
                        type="radio"
                        name="region-country"
                        value={r.id}
                        checked={checked}
                        onChange={() => pickCountry(r.country)}
                        className="size-4 shrink-0"
                        style={{ accentColor: primary }}
                      />
                      {r.country ? (
                        <Flag url={countryFlagUrl(r.country)} />
                      ) : (
                        <Globe className="size-4 shrink-0 opacity-70" aria-hidden />
                      )}
                      <span className="min-w-0 flex-1 truncate text-start">{r.name}</span>
                      <bdi className="ms-auto shrink-0 text-xs opacity-70">{r.currency}</bdi>
                    </label>
                  );
                })}
                {visible.length === 0 && (
                  <p role="status" className="px-3 py-3 text-sm opacity-70">{t('noResults')}</p>
                )}
              </div>
            </fieldset>

            <fieldset className="mt-4 min-w-0" data-testid="region-languages">
              <legend className="mb-2 text-sm font-medium opacity-80">{t('language')}</legend>
              <div className="rounded-lg border" style={{ borderColor: lineColor }}>
                {languages.map((l) => {
                  const checked = l === activeLang;
                  return (
                    <label
                      key={l}
                      className="flex cursor-pointer items-center gap-3 px-3 py-2.5 text-sm hover:bg-black/5"
                      style={checked ? { color: primary } : undefined}
                    >
                      <input
                        type="radio"
                        name="region-language"
                        value={l}
                        checked={checked}
                        onChange={() => setLang(l)}
                        className="size-4 shrink-0"
                        style={{ accentColor: primary }}
                      />
                      <span lang={l} className="flex-1 text-start">{resolveLocaleMeta(l).label}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          </div>

          <div className="border-t px-5 py-3" style={{ borderColor: lineColor }}>
            <button
              type="submit"
              className="h-11 w-full rounded-lg text-sm font-semibold transition-opacity hover:opacity-90"
              style={{ backgroundColor: primary, color: accent ? '#fff' : 'var(--store-primary-contrast, #fff)' }}
            >
              {t('apply')}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
