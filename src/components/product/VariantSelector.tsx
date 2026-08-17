'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { X, Check } from 'lucide-react';
import { resolveMediaUrl } from '@/lib/api';

// ── Color utilities ────────────────────────────────────

const COLOR_MAP: Record<string, string> = {
  black: '#000000', white: '#ffffff', red: '#ef4444', blue: '#3b82f6',
  green: '#22c55e', yellow: '#eab308', orange: '#f97316', purple: '#a855f7',
  pink: '#ec4899', gray: '#9ca3af', grey: '#9ca3af', brown: '#92400e',
  navy: '#1e3a5f', beige: '#f5f5dc', gold: '#d97706', silver: '#c0c0c0',
  teal: '#14b8a6', cyan: '#06b6d4', coral: '#f97171', cream: '#fffdd0',
  ivory: '#fffff0', khaki: '#c3b091', lavender: '#c4b5fd', maroon: '#7f1d1d',
  olive: '#65a30d', turquoise: '#2dd4bf', wine: '#722f37', charcoal: '#374151',
  mint: '#6ee7b7', peach: '#fdba74', rose: '#fb7185', salmon: '#fa8072', tan: '#d2b48c',
  'أسود': '#000000', 'أبيض': '#ffffff', 'أحمر': '#ef4444', 'أزرق': '#3b82f6',
  'أخضر': '#22c55e', 'أصفر': '#eab308', 'برتقالي': '#f97316', 'بنفسجي': '#a855f7',
  'وردي': '#ec4899', 'رمادي': '#9ca3af', 'بني': '#92400e',
};

const COLOR_KEYWORDS = ['color', 'colour', 'لون', 'farbe', 'couleur', 'renk'];

function isColorOptionKey(key: string): boolean {
  return COLOR_KEYWORDS.some((kw) => key.toLowerCase().includes(kw));
}

function resolveColor(value: string): string | null {
  const mapped = COLOR_MAP[value.toLowerCase()];
  if (mapped) return mapped;
  if (/^#([0-9a-f]{3,8})$/i.test(value)) return value;
  if (/^(rgb|hsl)/i.test(value)) return value;
  return null;
}

function isLightColor(hex: string): boolean {
  const c = hex.replace('#', '');
  if (c.length < 6) return true;
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 200;
}

// ── Types ──────────────────────────────────────────────

interface OptionConfig {
  name: string;
  style: string;
  // Values in the order the seller arranged them in the dashboard.
  values?: string[];
  colorMap?: Record<string, string>;
  dualColorMap?: Record<string, [string, string]>;
  // Value-level image (one per option value, e.g. per color) — set in the
  // dashboard and shared by every variant carrying that value.
  imageMap?: Record<string, string>;
}

interface Variant {
  id: string;
  sku?: string;
  price: number;
  stock: number;
  options: Record<string, string>;
  images?: { url: string }[];
}

interface VariantSelectorProps {
  variants: Variant[];
  selectedVariantId?: string;
  onSelect: (variantId: string) => void;
  inStockText?: string;
  outOfStockText?: string;
  optionConfigs?: OptionConfig[];
  // Fires on every option click with the partial selection (e.g. color chosen,
  // size not yet) — lets the gallery react before a full variant is resolved.
  onSelectionsChange?: (selections: Record<string, string>) => void;
}

// ── Component ──────────────────────────────────────────

export function VariantSelector({
  variants,
  selectedVariantId,
  onSelect,
  inStockText = 'In Stock',
  outOfStockText = 'Out of Stock',
  optionConfigs,
  onSelectionsChange,
}: VariantSelectorProps) {
  const t = useTranslations('common');

  // What the variants actually offer, then arranged the way the seller set it
  // up. Neither source of order in the raw data is usable on its own: the
  // variant `options` column is jsonb, which does not preserve key order, and
  // values would otherwise appear in variant-creation order. optionConfigs is
  // the ordered array the dashboard saves, so it drives both levels. Anything
  // it doesn't mention (products saved before the config existed, or a value
  // added straight to a variant) is appended rather than dropped.
  const optionGroups = useMemo<[string, string[]][]>(() => {
    const discovered: Record<string, string[]> = {};
    for (const variant of variants) {
      // Guard: some payloads (e.g. the builder's sample product before it was
      // completed) can carry variants without an options object.
      for (const [key, value] of Object.entries(variant.options || {})) {
        if (!discovered[key]) discovered[key] = [];
        if (!discovered[key].includes(value)) discovered[key].push(value);
      }
    }

    const ordered: [string, string[]][] = [];
    const placed = new Set<string>();

    for (const cfg of optionConfigs ?? []) {
      const values = discovered[cfg.name];
      if (!values || placed.has(cfg.name)) continue;
      placed.add(cfg.name);
      const configured = cfg.values ?? [];
      ordered.push([
        cfg.name,
        [
          ...configured.filter((v) => values.includes(v)),
          ...values.filter((v) => !configured.includes(v)),
        ],
      ]);
    }

    for (const [key, values] of Object.entries(discovered)) {
      if (!placed.has(key)) ordered.push([key, values]);
    }

    return ordered;
  }, [variants, optionConfigs]);

  const optionKeys = useMemo(() => optionGroups.map(([key]) => key), [optionGroups]);

  const configByName = useMemo(() => {
    const map: Record<string, OptionConfig> = {};
    optionConfigs?.forEach((c) => { if (c.name) map[c.name] = c; });
    return map;
  }, [optionConfigs]);

  const initialSelections = useMemo(() => {
    if (selectedVariantId) {
      const variant = variants.find((v) => v.id === selectedVariantId);
      if (variant) return { ...variant.options };
    }
    return {} as Record<string, string>;
  }, [selectedVariantId, variants]);

  const [selections, setSelections] = useState<Record<string, string>>(initialSelections);

  const matchingVariant = useMemo(() => {
    if (Object.keys(selections).length < optionKeys.length) return null;
    return variants.find((v) => optionKeys.every((k) => v.options?.[k] === selections[k])) ?? null;
  }, [selections, variants, optionKeys]);

  const isOptionAvailable = (key: string, value: string): boolean => {
    const hypothetical = { ...selections, [key]: value };
    return variants.some(
      (v) =>
        v.stock > 0 &&
        Object.keys(hypothetical).every((k) => v.options?.[k] === hypothetical[k]),
    );
  };

  const handleSelect = (key: string, value: string) => {
    const next = { ...selections, [key]: value };
    setSelections(next);
    onSelectionsChange?.(next);
    if (optionKeys.every((k) => k in next)) {
      const matched = variants.find((v) => optionKeys.every((k) => v.options?.[k] === next[k]));
      if (matched) onSelect(matched.id);
    }
  };

  const handleClear = () => {
    setSelections({});
    onSelectionsChange?.({});
  };
  const hasSelections = Object.keys(selections).length > 0;

  const getStyle = (key: string): 'color' | 'image' | 'text' => {
    const cfg = configByName[key];
    if (cfg?.style === 'color') return 'color';
    if (cfg?.style === 'image') return 'image';
    if (isColorOptionKey(key)) return 'color';
    return 'text';
  };

  const findVariantImage = (key: string, value: string): string | undefined => {
    // Value-level image from the option config wins; fall back to the first
    // variant that carries this value and has its own image.
    const configured = configByName[key]?.imageMap?.[value];
    if (configured) return configured;
    const v = variants.find((v) => v.options?.[key] === value && v.images?.length);
    return v?.images?.[0]?.url;
  };

  return (
    <div className="flex flex-col gap-6">
      {optionGroups.map(([key, values]) => {
        const style = getStyle(key);
        const config = configByName[key];
        const selectedValue = selections[key];

        return (
          <div key={key}>
            {/* Label */}
            <p className="text-sm font-semibold text-gray-900 mb-3">
              {key}
              {selectedValue && (
                <span className="font-normal text-gray-400 ml-1">— {selectedValue}</span>
              )}
            </p>

            {/* ── Color swatches ── */}
            {style === 'color' && (
              <div className="flex flex-wrap gap-3">
                {values.map((value) => {
                  const isSelected = selectedValue === value;
                  const available = isOptionAvailable(key, value);
                  const dualHex = config?.dualColorMap?.[value];
                  const cssColor = config?.colorMap?.[value] || resolveColor(value);
                  const hasSwatch = !!(cssColor || dualHex);

                  if (hasSwatch) {
                    const light = dualHex ? isLightColor(dualHex[0]) : isLightColor(cssColor!);
                    return (
                      <div key={value} className="flex flex-col items-center gap-1.5">
                        <button
                          type="button"
                          disabled={!available}
                          onClick={() => handleSelect(key, value)}
                          title={value}
                          className={`relative w-10 h-10 rounded-full transition-all duration-200 ${
                            !available ? 'opacity-25 cursor-not-allowed' : 'cursor-pointer hover:scale-110'
                          } ${isSelected ? 'ring-2 ring-offset-3' : 'hover:ring-1 hover:ring-offset-2 hover:ring-gray-300'}`}
                          style={{
                            ...(dualHex
                              ? { background: `linear-gradient(135deg, ${dualHex[0]} 50%, ${dualHex[1]} 50%)` }
                              : { backgroundColor: cssColor! }),
                            border: light ? '2px solid #e5e7eb' : '2px solid transparent',
                            boxShadow: isSelected ? undefined : '0 1px 3px rgba(0,0,0,0.08)',
                            ...(isSelected
                              ? { '--tw-ring-color': 'var(--store-primary, #2563eb)' } as React.CSSProperties
                              : {}),
                          }}
                        >
                          {isSelected && (
                            <span className="absolute inset-0 flex items-center justify-center">
                              <Check className="w-4 h-4" style={{ color: light ? '#000' : '#fff' }} strokeWidth={3} />
                            </span>
                          )}
                          {!available && (
                            <span className="absolute inset-0 flex items-center justify-center">
                              <span className="block w-11 h-0.5 rotate-45 bg-gray-400/60" />
                            </span>
                          )}
                        </button>
                        {/* Color name label */}
                        <span className={`text-[10px] leading-tight text-center max-w-12 truncate ${
                          isSelected ? 'text-gray-900 font-medium' : 'text-gray-400'
                        }`}>
                          {value}
                        </span>
                      </div>
                    );
                  }

                  // Fallback: text pill for unresolved colors
                  return (
                    <button
                      key={value}
                      type="button"
                      disabled={!available}
                      onClick={() => handleSelect(key, value)}
                      className={`px-4 py-2 text-sm rounded-lg border-2 font-medium transition-all duration-200 ${
                        isSelected
                          ? 'text-white border-transparent'
                          : available
                            ? 'border-gray-200 bg-white text-gray-700 hover:border-gray-400'
                            : 'border-gray-100 bg-gray-50 text-gray-300 cursor-not-allowed line-through opacity-40'
                      }`}
                      style={isSelected ? { backgroundColor: 'var(--store-primary, #2563eb)' } : undefined}
                    >
                      {value}
                    </button>
                  );
                })}
              </div>
            )}

            {/* ── Image thumbnails ── */}
            {style === 'image' && (
              <div className="flex flex-wrap gap-3">
                {values.map((value) => {
                  const isSelected = selectedValue === value;
                  const available = isOptionAvailable(key, value);
                  const imgUrl = findVariantImage(key, value);

                  return (
                    <div key={value} className="flex flex-col items-center gap-1.5">
                      <button
                        type="button"
                        disabled={!available}
                        onClick={() => handleSelect(key, value)}
                        title={value}
                        className={`relative w-20 h-20 rounded-xl overflow-hidden transition-all duration-200 ${
                          !available ? 'opacity-25 cursor-not-allowed' : 'cursor-pointer'
                        } ${
                          isSelected
                            ? 'ring-2 ring-offset-2 shadow-md'
                            : 'border-2 border-gray-200 hover:border-gray-300 hover:shadow-sm'
                        }`}
                        style={
                          isSelected
                            ? { '--tw-ring-color': 'var(--store-primary, #2563eb)' } as React.CSSProperties
                            : undefined
                        }
                      >
                        {imgUrl ? (
                          <img
                            src={resolveMediaUrl(imgUrl)}
                            alt={value}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-gray-50 flex items-center justify-center text-xs text-gray-400 font-medium p-1 text-center">
                            {value}
                          </div>
                        )}
                        {isSelected && (
                          <div
                            className="absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center shadow-sm"
                            style={{ backgroundColor: 'var(--store-primary, #2563eb)' }}
                          >
                            <Check className="w-3 h-3 text-white" strokeWidth={3} />
                          </div>
                        )}
                        {!available && (
                          <div className="absolute inset-0 bg-white/60 flex items-center justify-center">
                            <span className="block w-full h-0.5 rotate-45 bg-gray-400/60" />
                          </div>
                        )}
                      </button>
                      {/* Image option label */}
                      <span className={`text-xs leading-tight text-center max-w-20 truncate ${
                        isSelected ? 'text-gray-900 font-medium' : 'text-gray-500'
                      }`}>
                        {value}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── Text pills ── */}
            {style === 'text' && (
              <div className="flex flex-wrap gap-2">
                {values.map((value) => {
                  const isSelected = selectedValue === value;
                  const available = isOptionAvailable(key, value);

                  return (
                    <button
                      key={value}
                      type="button"
                      disabled={!available}
                      onClick={() => handleSelect(key, value)}
                      className={`min-w-12 px-4 py-2.5 text-sm rounded-lg border-2 font-medium text-center transition-all duration-200 ${
                        isSelected
                          ? 'text-white border-transparent'
                          : available
                            ? 'border-gray-200 bg-white text-gray-700 hover:border-gray-400 hover:shadow-sm'
                            : 'border-gray-100 bg-gray-50 text-gray-300 cursor-not-allowed line-through opacity-40'
                      }`}
                      style={isSelected ? { backgroundColor: 'var(--store-primary, #2563eb)' } : undefined}
                    >
                      {value}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {/* Clear selection */}
      {hasSelections && (
        <button
          type="button"
          onClick={handleClear}
          className="inline-flex items-center gap-1 text-xs font-medium text-gray-400 hover:text-gray-600 transition-colors w-fit"
        >
          <X className="w-3 h-3" />
          {t('clear')}
        </button>
      )}

      {/* Stock status */}
      {matchingVariant && (
        <span
          className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full w-fit ${
            matchingVariant.stock > 0
              ? 'bg-green-50 text-green-700'
              : 'bg-red-50 text-red-600'
          }`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${
            matchingVariant.stock > 0 ? 'bg-green-500' : 'bg-red-500'
          }`} />
          {matchingVariant.stock > 0
            ? `${inStockText}${matchingVariant.stock <= 10 ? ` (${matchingVariant.stock})` : ''}`
            : outOfStockText}
        </span>
      )}
    </div>
  );
}