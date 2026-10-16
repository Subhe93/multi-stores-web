'use client';

import { useEffect, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useStoreApp } from '@/hooks/useStoreApps';
import { useMarket } from '@/hooks/useMarket';
import { usePersonalizationFields } from '@/components/product/usePersonalizationFields';
import type { PersonalizationProduct } from '@/lib/personalization/form';
import { readPrefill } from '@/lib/personalization/prefill';
import { splitFieldTree, type PFieldDef, type POptionConfig } from '@/lib/personalization';
import type { VariantCardsConfig } from './VariantCards';
import {
  activeOptionValues,
  readPersonalizationSettings,
  readProductPersonalization,
  type ContextVariant,
} from './model';

export interface PersonalizationAppVariant extends ContextVariant {
  id: string;
}

export interface PersonalizationAppInput {
  /** Storefront product (custom fields + creator values) or undefined (builder placeholder). */
  product: PersonalizationProduct | null | undefined;
  /** `product.personalization` of the storefront payload. */
  personalization: unknown;
  optionConfig: POptionConfig[] | null | undefined;
  /** Variants with their options keyed by the original-case option name. */
  variants: readonly PersonalizationAppVariant[];
  /** Options of the resolved variant (auto-selected single variants included). */
  variantOptions: Record<string, string> | null | undefined;
  /** Partial option picks, original-case option names. */
  optionSelections: Record<string, string>;
  locale: string;
  primaryLocale: string;
  currency: string;
  taxRateBp: number | null;
  /**
   * URL prefill of option picks, once on mount: the picks and the variant
   * they resolve to (undefined when incomplete or no such combination).
   */
  onPrefillOptions?: (picks: Record<string, string>, variantId: string | undefined) => void;
}

/**
 * Personalization app state of one product form (M4.1 §5), shared by the
 * product page (`ProductDetailClient`) and the theme's `AddToCartMagic`:
 * the app gate, the evaluator-backed form, the variation cards config, the
 * URL prefill and the shown price delta. With the app off it is the M4.0
 * form (`usePersonalizationFields` without app input), unchanged.
 */
export function usePersonalizationApp(input: PersonalizationAppInput) {
  const {
    product,
    personalization: rawPersonalization,
    optionConfig,
    variants,
    variantOptions,
    optionSelections,
    locale,
    primaryLocale,
    currency,
    taxRateBp,
    onPrefillOptions,
  } = input;

  const app = useStoreApp('personalization');
  const productPersonalization = readProductPersonalization(rawPersonalization);
  const appOn = Boolean(app) && productPersonalization !== null;
  const appSettings = useMemo(() => readPersonalizationSettings(app?.settings), [app]);
  const market = useMarket();
  const params = useParams<{ storeSlug?: string }>();
  const storeSlug = typeof params?.storeSlug === 'string' ? params.storeSlug : '';

  const activeValues = useMemo(() => (appOn ? activeOptionValues(variants) : undefined), [appOn, variants]);

  // The evaluator reads the resolved variant's options (a single variant is
  // auto-selected without any pick), overlaid by the current partial picks.
  const selections = useMemo(
    () => ({ ...(variantOptions ?? {}), ...optionSelections }),
    [variantOptions, optionSelections],
  );

  const fields = usePersonalizationFields(
    product,
    locale,
    primaryLocale,
    appOn
      ? { enabled: true, selections, optionConfig: optionConfig ?? null, activeOptionValues: activeValues }
      : undefined,
  );
  const advanced = fields.advanced;

  // URL prefill (namez `?name1=&name2=&color=`): option picks and field
  // values, once on mount. The form still validates them.
  useEffect(() => {
    if (!appOn || typeof window === 'undefined' || !window.location.search) return;
    const top = splitFieldTree((product?.custom_fields ?? []) as unknown as PFieldDef[]).top;
    const optionValues = activeOptionValues(variants);
    const prefill = readPrefill(
      window.location.search,
      appSettings.url_prefill,
      top.map((d) => ({ id: d.id, name: d.name, type: String(d.type), priced: d.pricing !== null && typeof d.pricing === 'object' })),
      Object.entries(optionValues).map(([name, values]) => ({ name, values })),
    );
    if (advanced) for (const [id, v] of Object.entries(prefill.fields)) fields.onChange(id, v);
    const picks = prefill.options;
    if (Object.keys(picks).length > 0 && onPrefillOptions) {
      const names = Object.keys(optionValues);
      const match = names.every((n) => n in picks)
        ? variants.find((v) => v.is_active !== false && names.every((n) => v.options?.[n] === picks[n]))
        : undefined;
      onPrefillOptions(picks, match?.id);
    }
    // Mount only: the URL is read once, like namez.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Variation cards: undefined keeps the M4.0 selector.
  const freeShippingThreshold = productPersonalization?.free_shipping_threshold ?? null;
  const cardsConfig = useMemo<VariantCardsConfig | undefined>(
    () =>
      appOn
        ? {
            freeShippingThreshold: appSettings.free_shipping_badge ? freeShippingThreshold : null,
            cardPriceMode: appSettings.card_price_mode,
            currency,
            locale,
            primaryLocale,
            taxRateBp,
          }
        : undefined,
    [appOn, appSettings, freeShippingThreshold, currency, locale, primaryLocale, taxRateBp],
  );

  // The per-unit modifier is in the base currency: it is added to the shown
  // price only where that is the shown currency (no market, or the default
  // market). Elsewhere a note says the cart has the final price. Display
  // only; the server prices the line (D4).
  const rawDelta = advanced && advanced.result.priceDeltaMinor > 0 ? advanced.result.priceDeltaMinor / 100 : 0;
  const baseCurrencyShown = !market || market.is_default;
  const priceDelta = baseCurrencyShown ? rawDelta : 0;
  const deltaInCart = !baseCurrencyShown && rawDelta > 0;

  return {
    appOn,
    appSettings,
    market,
    storeSlug,
    /** Form state (`usePersonalizationFields`). */
    fields,
    /** App-mode form model; null in M4.0 mode. */
    advanced,
    cardsConfig,
    /** Delta added to the shown unit price (0 when not shown). */
    priceDelta,
    /** A delta exists but is priced in the cart (non-default market). */
    deltaInCart,
  };
}
