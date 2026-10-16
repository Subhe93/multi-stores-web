'use client';

import { useTranslations } from 'next-intl';
import { Check, Truck } from 'lucide-react';
import { formatPrice } from '@/lib/format';
import { useDisplayPrice } from '@/hooks/useDisplayPrice';
import { cardMeta, cardPrice, freeShippingReached, type CardOptionConfig, type CardVariant } from './model';

/** Card settings passed by `VariantSelector` when the personalization app is on. */
export interface VariantCardsConfig {
  /** Free-shipping threshold in the shown currency; null = no badge. */
  freeShippingThreshold: number | null;
  cardPriceMode: 'selection' | 'from';
  currency: string;
  locale: string;
  primaryLocale: string;
  taxRateBp?: number | null;
}

interface VariantCardsProps {
  option: string;
  values: string[];
  config: CardOptionConfig | null | undefined;
  selectedValue?: string;
  selections: Record<string, string>;
  optionNames: string[];
  variants: CardVariant[];
  isAvailable: (value: string) => boolean;
  onSelect: (value: string) => void;
  settings: VariantCardsConfig;
}

/**
 * Variation cards (namez `custom-variation-cards`, D9): label, sublabel,
 * badge (default `#fbde31`), "free shipping" line from the shipping
 * threshold and the price computed from the variants. Prices are display
 * only and go through `useDisplayPrice` (b2b net view).
 */
export function VariantCards({
  option,
  values,
  config,
  selectedValue,
  selections,
  optionNames,
  variants,
  isAvailable,
  onSelect,
  settings,
}: VariantCardsProps) {
  const t = useTranslations('personalization');
  const display = useDisplayPrice();
  const { currency, locale } = settings;

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {values.map((value) => {
        const meta = cardMeta(config, value, locale, settings.primaryLocale);
        const priced = cardPrice(variants, option, value, selections, optionNames, settings.cardPriceMode);
        const available = isAvailable(value);
        const isSelected = selectedValue === value;
        const amount = priced ? display(priced.price, settings.taxRateBp, currency).amount : null;
        const priceText = amount !== null ? formatPrice(amount, currency, locale) : null;
        const freeShipping = priced !== null && freeShippingReached(priced.price, settings.freeShippingThreshold);
        return (
          <button
            key={value}
            type="button"
            aria-pressed={isSelected}
            disabled={!available}
            onClick={() => onSelect(value)}
            className={`relative flex items-start justify-between gap-3 rounded-xl border-2 p-3 text-start transition-all ${
              isSelected ? 'shadow-sm' : 'border-gray-200 bg-white hover:border-gray-400'
            } ${available ? 'cursor-pointer' : 'cursor-not-allowed opacity-40'}`}
            style={isSelected ? { borderColor: 'var(--store-primary, #2563eb)' } : undefined}
          >
            {meta.badge && (
              <span
                className="absolute -top-2.5 end-3 rounded-full px-2 py-0.5 text-[10px] font-bold text-gray-900 shadow-sm"
                style={{ backgroundColor: meta.badgeColor }}
              >
                {meta.badge}
              </span>
            )}
            <span className="flex min-w-0 items-start gap-2.5">
              <span
                className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${
                  isSelected ? 'border-transparent' : 'border-gray-300'
                }`}
                style={isSelected ? { backgroundColor: 'var(--store-primary, #2563eb)' } : undefined}
              >
                {isSelected && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-gray-900">{meta.label}</span>
                {meta.sublabel && <span className="block text-xs text-gray-500">{meta.sublabel}</span>}
                {freeShipping && (
                  <span className="mt-0.5 inline-flex items-center gap-1 text-xs font-medium text-green-600">
                    <Truck className="h-3 w-3" />
                    {t('freeShipping')}
                  </span>
                )}
              </span>
            </span>
            {priceText && (
              <span className="shrink-0 text-sm font-semibold tabular-nums text-gray-900">
                {priced!.from ? t('fromPrice', { price: priceText }) : priceText}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
