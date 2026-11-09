'use client';

import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { useTranslations } from 'next-intl';
import { Check, Truck } from 'lucide-react';
import { formatPrice } from '@/lib/format';
import { useDisplayPrice } from '@/hooks/useDisplayPrice';
import {
  cardMeta,
  cardOptionSettings,
  cardPrice,
  cardSavings,
  contrastRatio,
  contrastTextColor,
  freeShippingReached,
  unitPrice,
  type CardMeta,
  type CardOptionConfig,
  type CardVariant,
} from './model';

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

// Theme tokens. Text colours are set inline: the store stylesheet colours
// `main :is(p,li,span)` and would otherwise win over utility classes. The
// fallbacks equal today's Tailwind greys, so stores without tokens look the same.
const PRIMARY = 'var(--store-primary, #2563eb)';
const PRIMARY_CONTRAST = 'var(--store-primary-contrast, #fff)';
const TEXT = 'var(--theme-colors-text, #111827)';
const BG = 'var(--theme-colors-background, #fff)';
const MUTED = 'var(--theme-colors-muted, #6b7280)';
// Used when the theme's muted colour is below 4.5:1 on its background.
const MUTED_STRONG = 'color-mix(in srgb, var(--theme-colors-text, #111827) 72%, var(--theme-colors-background, #fff))';
const BORDER = 'var(--theme-colors-border, #d1d5db)';
// Savings chip on the store's sale colour; without one a neutral chip.
const SAVE_STYLE: CSSProperties = {
  backgroundColor:
    'var(--theme-colors-sale, color-mix(in srgb, var(--theme-colors-text, #111827) 10%, var(--theme-colors-background, #fff)))',
  color: 'var(--theme-colors-saleContrast, var(--theme-colors-text, #111827))',
};
// Neutral pill (list free shipping, sold out) and the soft unselected list row.
const PILL_STYLE: CSSProperties = {
  backgroundColor: 'color-mix(in srgb, var(--theme-colors-text, #111827) 8%, var(--theme-colors-background, #fff))',
  color: TEXT,
};
const MUTED_ROW_BG = 'color-mix(in srgb, var(--theme-colors-text, #111827) 5%, var(--theme-colors-background, #fff))';

interface CardView {
  value: string;
  meta: CardMeta;
  available: boolean;
  isSelected: boolean;
  priceText: string | null;
  from: boolean;
  compareText: string | null;
  saveText: string | null;
  eachText: string | null;
  freeShipping: boolean;
}

/**
 * Theme contrast checks (read once from the computed tokens): a light
 * primary (e.g. yellow) is not a visible border on a light background, and a
 * pale muted colour is not readable for secondary text.
 */
function useThemeTone(ref: React.RefObject<HTMLDivElement | null>) {
  const [tone, setTone] = useState({ primaryOk: true, mutedOk: true });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const cs = getComputedStyle(el);
    const read = (name: string, fallback: string) => cs.getPropertyValue(name).trim() || fallback;
    const bg = read('--theme-colors-background', '#ffffff');
    const p = contrastRatio(read('--store-primary', '#2563eb'), bg);
    const m = contrastRatio(read('--theme-colors-muted', '#6b7280'), bg);
    const next = { primaryOk: p === null || p >= 3, mutedOk: m === null || m >= 4.5 };
    setTone((cur) => (cur.primaryOk === next.primaryOk && cur.mutedOk === next.mutedOk ? cur : next));
  }, [ref]);
  return tone;
}

/**
 * Variation cards (namez `custom-variation-cards`, D9; cards v2): label,
 * sublabel, badge (default `#fbde31`), "free shipping" from the shipping
 * threshold and the price computed from the variants, plus (v2) a ribbon tab,
 * opt-in savings (struck compare-at of the same variant + savings chip) and a
 * per-unit line, in a grid (default) or a full-width list. Prices are display
 * only and go through `useDisplayPrice` (b2b net view). Radio-group
 * semantics: one tab stop, arrow keys move and select.
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
  const groupRef = useRef<HTMLDivElement | null>(null);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const tone = useThemeTone(groupRef);
  const { currency, locale } = settings;
  const { layout, showSavings } = cardOptionSettings(config);
  const list = layout === 'list';
  const fmt = (n: number) => formatPrice(n, currency, locale);
  const muted = tone.mutedOk ? MUTED : MUTED_STRONG;

  const cards: CardView[] = values.map((value) => {
    const meta = cardMeta(config, value, locale, settings.primaryLocale);
    const priced = cardPrice(variants, option, value, selections, optionNames, settings.cardPriceMode);
    const amount = priced ? display(priced.price, settings.taxRateBp, currency).amount : null;
    // Savings are opt-in (`card_show_savings: true`): struck price and chip together.
    const compareAmount =
      priced && showSavings && priced.compareAt !== undefined
        ? display(priced.compareAt, settings.taxRateBp, currency).amount
        : null;
    const savings = amount !== null ? cardSavings(amount, compareAmount) : null;
    const each = amount !== null ? unitPrice(amount, meta.units) : null;
    return {
      value,
      meta,
      available: isAvailable(value),
      isSelected: selectedValue === value,
      priceText: amount !== null ? fmt(amount) : null,
      from: !!priced?.from,
      compareText: savings && compareAmount !== null ? fmt(compareAmount) : null,
      saveText: savings
        ? savings.percent >= 1
          ? t('save', { percent: savings.percent, amount: fmt(savings.amount) })
          : t('saveAmount', { amount: fmt(savings.amount) })
        : null,
      eachText: each !== null ? t('each', { price: fmt(each) }) : null,
      freeShipping: priced !== null && freeShippingReached(priced.price, settings.freeShippingThreshold),
    };
  });

  // Roving tab stop: the selected card, else the first available one.
  const selectedIdx = cards.findIndex((c) => c.isSelected && c.available);
  const tabIdx = selectedIdx >= 0 ? selectedIdx : cards.findIndex((c) => c.available);

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const rtl = getComputedStyle(e.currentTarget).direction === 'rtl';
    let step = 0;
    if (e.key === 'ArrowDown') step = 1;
    else if (e.key === 'ArrowUp') step = -1;
    else if (e.key === 'ArrowRight') step = rtl ? -1 : 1;
    else if (e.key === 'ArrowLeft') step = rtl ? 1 : -1;
    else if (e.key !== 'Home' && e.key !== 'End') return;
    e.preventDefault();
    const n = cards.length;
    let next = -1;
    if (step === 0) {
      const order = [...cards.keys()];
      if (e.key === 'End') order.reverse();
      next = order.find((i) => cards[i].available) ?? -1;
    } else {
      for (let k = 1; k <= n; k++) {
        const i = (((index + step * k) % n) + n) % n;
        if (cards[i].available) {
          next = i;
          break;
        }
      }
    }
    if (next < 0 || next === index) return;
    refs.current[next]?.focus();
    onSelect(cards[next].value);
  };

  const hasRibbon = cards.some((c) => c.meta.ribbon);
  // Selected accent: the list uses the text colour (reference look); the grid
  // keeps the primary unless it is too light to see on the background.
  const accent = list || !tone.primaryOk ? TEXT : PRIMARY;
  const accentContrast = list || !tone.primaryOk ? BG : PRIMARY_CONTRAST;

  const dot = (isSelected: boolean) => (
    <span
      className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2"
      style={isSelected ? { backgroundColor: accent, borderColor: 'transparent' } : { borderColor: BORDER }}
      aria-hidden="true"
    >
      {isSelected && <Check className="h-3 w-3" strokeWidth={3} style={{ color: accentContrast }} />}
    </span>
  );

  const ribbon = (c: CardView, pos: string) =>
    c.meta.ribbon ? (
      <span
        className={`absolute ${pos} truncate rounded-md px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide shadow-sm sm:text-xs`}
        style={{ backgroundColor: c.meta.ribbonColor, color: c.meta.ribbonTextColor }}
      >
        {c.meta.ribbon}
      </span>
    ) : null;

  const pill = (content: React.ReactNode, style: CSSProperties, bold = false) => (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] ${
        bold ? 'font-bold' : 'font-medium'
      }`}
      style={style}
    >
      {content}
    </span>
  );

  const priceBlock = (c: CardView) =>
    c.priceText ? (
      <span className="flex max-w-[45%] shrink-0 flex-col items-end text-end">
        <span
          className={`tabular-nums font-bold ${list ? 'text-lg sm:text-xl' : 'text-base'}`}
          style={{ color: TEXT }}
        >
          {c.from ? t('fromPrice', { price: c.priceText }) : c.priceText}
        </span>
        {c.compareText && (
          <span className="text-xs tabular-nums" style={{ color: muted }}>
            <s aria-hidden="true">{c.compareText}</s>
            <span className="sr-only">{t('wasPrice', { price: c.compareText })}</span>
          </span>
        )}
        {c.eachText && (
          <span className="break-words text-xs tabular-nums" style={{ color: muted }}>
            {c.eachText}
          </span>
        )}
      </span>
    ) : null;

  const radioProps = (c: CardView, i: number) => ({
    ref: (el: HTMLButtonElement | null) => {
      refs.current[i] = el;
    },
    type: 'button' as const,
    role: 'radio',
    'aria-checked': c.isSelected,
    tabIndex: i === tabIdx ? 0 : -1,
    disabled: !c.available,
    onClick: () => onSelect(c.value),
    onKeyDown: (e: KeyboardEvent<HTMLButtonElement>) => onKeyDown(e, i),
  });

  if (list) {
    return (
      <div
        ref={groupRef}
        role="radiogroup"
        aria-label={option}
        className={`flex flex-col ${hasRibbon ? 'gap-4 pt-2' : 'gap-2'}`}
      >
        {cards.map((c, i) => (
          <button
            key={c.value}
            {...radioProps(c, i)}
            className={`relative flex w-full min-w-0 items-center gap-3 rounded-xl border-2 px-3 pb-3 text-start transition-all sm:px-4 ${
              c.meta.ribbon ? 'pt-4' : 'pt-3'
            } ${c.isSelected ? 'shadow-sm' : 'border-transparent hover:border-gray-300'} ${
              c.available ? 'cursor-pointer' : 'cursor-not-allowed opacity-40'
            }`}
            style={
              c.isSelected
                ? { backgroundColor: BG, borderColor: accent, boxShadow: `0 0 0 1px ${accent}` }
                : { backgroundColor: MUTED_ROW_BG }
            }
          >
            {ribbon(c, '-top-3 end-4 max-w-[calc(100%-2rem)]')}
            {dot(c.isSelected)}
            <span className="min-w-0 flex-1">
              <span className="block break-words text-base font-bold" style={{ color: TEXT }}>
                {c.meta.label}
              </span>
              {c.meta.sublabel && (
                <span className="block break-words text-xs" style={{ color: muted }}>
                  {c.meta.sublabel}
                </span>
              )}
              {(c.meta.badge || c.freeShipping || c.saveText || !c.available) && (
                <span className="mt-1 flex flex-wrap gap-1">
                  {c.meta.badge &&
                    pill(c.meta.badge, { backgroundColor: c.meta.badgeColor, color: contrastTextColor(c.meta.badgeColor) }, true)}
                  {c.freeShipping &&
                    pill(
                      <>
                        <Truck className="h-3 w-3" aria-hidden="true" />
                        {t('freeShipping')}
                      </>,
                      PILL_STYLE,
                    )}
                  {c.saveText && pill(c.saveText, SAVE_STYLE, true)}
                  {!c.available && pill(t('soldOut'), PILL_STYLE)}
                </span>
              )}
            </span>
            {priceBlock(c)}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div
      ref={groupRef}
      role="radiogroup"
      aria-label={option}
      className={`grid grid-cols-1 sm:grid-cols-2 ${hasRibbon ? 'gap-x-2 gap-y-4 pt-2' : 'gap-2'}`}
    >
      {cards.map((c, i) => (
        <button
          key={c.value}
          {...radioProps(c, i)}
          className={`relative flex min-w-0 items-start justify-between gap-3 rounded-xl border-2 p-3 text-start transition-all ${
            c.isSelected ? 'shadow-sm' : 'border-[color:var(--theme-colors-border,#e5e7eb)] hover:border-gray-400'
          } ${c.available ? 'cursor-pointer' : 'cursor-not-allowed opacity-40'}`}
          style={c.isSelected ? { backgroundColor: BG, borderColor: accent } : { backgroundColor: BG }}
        >
          {c.meta.badge && (
            <span
              className="absolute -top-2.5 end-3 rounded-full px-2 py-0.5 text-[10px] font-bold shadow-sm"
              style={{ backgroundColor: c.meta.badgeColor, color: contrastTextColor(c.meta.badgeColor) }}
            >
              {c.meta.badge}
            </span>
          )}
          {ribbon(c, c.meta.badge ? '-top-3 start-3 max-w-[calc(50%-1rem)]' : '-top-3 start-3 max-w-[calc(100%-1.5rem)]')}
          <span className="flex min-w-0 items-start gap-2.5">
            {dot(c.isSelected)}
            <span className="min-w-0">
              <span className="block break-words text-sm font-semibold" style={{ color: TEXT }}>
                {c.meta.label}
              </span>
              {c.meta.sublabel && (
                <span className="block break-words text-xs" style={{ color: muted }}>
                  {c.meta.sublabel}
                </span>
              )}
              {c.freeShipping && (
                <span className="mt-0.5 inline-flex items-center gap-1 text-xs font-medium text-green-600">
                  <Truck className="h-3 w-3" />
                  {t('freeShipping')}
                </span>
              )}
              {c.saveText && <span className="mt-1 flex flex-wrap gap-1">{pill(c.saveText, SAVE_STYLE, true)}</span>}
            </span>
          </span>
          {priceBlock(c)}
        </button>
      ))}
    </div>
  );
}
