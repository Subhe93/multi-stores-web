'use client';

// One "Country/region and language" picker (M155), the Shopify / IKEA /
// Apple pattern. Shown only for a store with two or more servable markets
// (isRegionMode); every other store keeps its language switcher.
//
// The component never builds a URL or reads a market's locales itself:
//  - language options come from `regionLocales` (lib/region),
//  - the destination comes from `buildRegionUrl` (lib/regionUrl),
// so a later country+language URL scheme changes only those two modules.

import { useCallback, useMemo, useRef, useState } from 'react';
import { ChevronDown, Globe } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import {
  useMarket, useMarketPathByLocale, useMarkets, usePreferredCountry, useSetPreferredCountry, useStoreCustomDomain,
} from '@/hooks/useMarket';
import { useCart } from '@/hooks/useCart';
import { useAuth } from '@/hooks/useAuth';
import { encodeGuestCart } from '@/lib/cartHandoff';
import { countryFlagUrl, resolveLocaleMeta } from '@/lib/localeMeta';
import { countryName } from '@/lib/marketSwitch';
import { isRegionMode, regionLocales, regionOptions, selectedRegionCountry } from '@/lib/region';
import { buildRegionUrl } from '@/lib/regionUrl';
import { MENU_EXIT_MS, useExit, type ChromeMotion } from '@/themes/minimal/sections/chrome/chromeMotion.client';
import { Flag } from './Flag';
import { RegionPanel, type DraftCountry } from './RegionPanel';

export interface RegionPickerProps {
  storeSlug: string;
  /** header: compact trigger; drawer: full-width row (mobile menu); strip: slim row under a published header. */
  variant: 'header' | 'drawer' | 'strip';
  /** HeaderBar accent (Save button and selected rows). */
  accent?: string;
  /** HeaderBar colours, so the panel matches a dark header. */
  panelColors?: { bg: string; fg: string; borderColor: string };
  motion?: ChromeMotion;
}

export function RegionPicker({ storeSlug, variant, accent, panelColors, motion }: RegionPickerProps) {
  const t = useTranslations('region');
  const locale = useLocale();
  const current = useMarket();
  const markets = useMarkets();
  const preferred = usePreferredCountry();
  const setPreferredCountry = useSetPreferredCountry();
  const storeCustomDomain = useStoreCustomDomain();
  const pathByLocale = useMarketPathByLocale();
  const { items } = useCart();
  const { token } = useAuth();
  const [open, setOpen] = useState(false);
  // A fresh panel (and draft) on every open, also while a close animation runs.
  const [openSeq, setOpenSeq] = useState(0);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closing = useExit(open, motion, MENU_EXIT_MS);

  const options = useMemo(() => regionOptions(current, markets), [current, markets]);
  const selected = selectedRegionCountry(preferred, current);

  const localesFor = useCallback(
    (country: DraftCountry) => {
      // Nothing chosen yet: the languages of the market being shown.
      const c = country === undefined ? (current?.countries?.[0] ?? null) : country;
      return regionLocales(c, {
        current,
        markets,
        primaryLocale: current?.default_locale ?? locale,
        secondaryLocales: current?.locales ?? [],
        currentLocale: locale,
      });
    },
    [current, markets, locale],
  );

  const close = useCallback(() => setOpen(false), []);

  if (!current || !isRegionMode(markets)) return null;

  const langLabel = resolveLocaleMeta(locale).label;
  const currency = current.currency;
  const summary = [selected ? countryName(selected, locale) : null, currency, langLabel].filter(Boolean).join(', ');

  const apply = ({ country, locale: chosen }: { country: DraftCountry; locale: string }) => {
    // Undefined = no country picked: route within the market being shown.
    const routeCountry = country === undefined ? (current.countries?.[0] ?? null) : country;
    const handoff = token ? { param: null, dropped: 0 } : encodeGuestCart(items);
    const url = buildRegionUrl(
      { country: routeCountry, locale: chosen },
      {
        storeSlug,
        current,
        markets,
        storeCustomDomain,
        primaryLocale: current.default_locale,
        locales: [current.default_locale, ...current.locales, locale],
        currentLocale: locale,
        pathname: window.location.pathname,
        search: window.location.search,
        pathByLocale,
        cart: handoff,
      },
    );
    if (country !== undefined) setPreferredCountry(country);
    setOpen(false);
    // Hard navigation, so the proxy and the server components run.
    if (url !== null) window.location.assign(url);
  };

  const flag = selected ? <Flag url={countryFlagUrl(selected)} /> : <Globe className="size-4 shrink-0 opacity-70" aria-hidden />;
  const codes = (
    <bdi>{selected ? `${selected} · ${currency}` : currency}</bdi>
  );

  let trigger;
  if (variant === 'drawer') {
    trigger = (
      <span className="flex w-full items-center gap-2.5 text-sm font-medium">
        {flag}
        <span className="min-w-0 flex-1 truncate text-start">
          <bdi>{selected ? `${countryName(selected, locale)} · ${currency}` : currency}</bdi>
          {' — '}
          <bdi lang={locale}>{langLabel}</bdi>
        </span>
        <ChevronDown className="size-4 shrink-0 opacity-60" aria-hidden />
      </span>
    );
  } else {
    // header: flag only below sm, + codes from sm, + language from lg.
    // strip: always the codes and the language (there is room for them).
    const codesCls = variant === 'strip' ? 'inline' : 'hidden sm:inline';
    const langCls = variant === 'strip' ? 'inline' : 'hidden lg:inline';
    trigger = (
      <span className="inline-flex items-center gap-1.5 text-sm font-medium">
        {flag}
        <span className={codesCls}>{codes}</span>
        <span className={langCls}>
          <span className="opacity-40" aria-hidden>|</span> <bdi lang={locale}>{langLabel}</bdi>
        </span>
        <ChevronDown className="size-3.5 opacity-60" aria-hidden />
      </span>
    );
  }

  const triggerCls =
    variant === 'drawer'
      ? 'flex w-full items-center rounded-lg border px-3 py-2.5 hover:bg-black/5 transition'
      : variant === 'strip'
        ? 'inline-flex items-center rounded-md px-2 py-1 text-xs hover:bg-black/5 transition'
        : 'h-9 inline-flex items-center rounded-md px-2 hover:bg-black/5 transition';

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        data-testid="region-trigger"
        onClick={() => {
          setOpenSeq((n) => n + 1);
          setOpen(true);
        }}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={t('trigger', { summary })}
        className={triggerCls}
      >
        {trigger}
      </button>
      {(open || closing) && (
        <RegionPanel
          key={openSeq}
          open={open || closing}
          onClose={close}
          locale={locale}
          options={options}
          initialCountry={selected ?? undefined}
          initialLocale={locale}
          localesFor={localesFor}
          onApply={apply}
          accent={accent}
          colors={panelColors}
          returnFocusRef={triggerRef}
          motion={Boolean(motion)}
          closing={closing}
        />
      )}
    </>
  );
}
