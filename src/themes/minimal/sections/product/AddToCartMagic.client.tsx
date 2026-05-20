'use client';

// Component implementation. Definition lives in AddToCartMagic.tsx.

import { useMemo, useState } from 'react';
import { Check, Loader2, Minus, Plus, ShoppingBag } from 'lucide-react';
import { useCart } from '@/hooks/useCart';
import { resolveMediaUrl } from '@/lib/api';
import type { ProductContext, SectionRenderProps } from '../../../types';

const COLOR_OPTION_NAMES = new Set(['color', 'colour', 'لون']);
const NAMED_COLOR_MAP: Record<string, string> = {
  black: '#000000', white: '#ffffff', red: '#ef4444', blue: '#3b82f6', green: '#22c55e',
  yellow: '#eab308', orange: '#f97316', purple: '#a855f7', pink: '#ec4899', gray: '#6b7280',
  grey: '#6b7280', brown: '#92400e', navy: '#1e3a8a', beige: '#d4b896', gold: '#eab308',
  silver: '#cbd5e1', cream: '#fdf6e3',
};

function hexFor(name: string): string | null {
  const v = name.trim().toLowerCase();
  if (/^#?[0-9a-f]{6}$/i.test(v)) return v.startsWith('#') ? v : `#${v}`;
  if (/^#?[0-9a-f]{3}$/i.test(v)) return v.startsWith('#') ? v : `#${v}`;
  return NAMED_COLOR_MAP[v] || null;
}

interface NormalisedVariant {
  id: string;
  price: number;
  compareAtPrice?: number;
  stock?: number;
  label: string;
  options: Record<string, string>;
}

function normaliseVariants(product: ProductContext): NormalisedVariant[] {
  return (product.variants || []).map((v) => {
    const options: Record<string, string> = {};
    for (const vv of v.variant_values || []) {
      options[vv.option_name.toLowerCase()] = vv.option_value;
    }
    const label = (v.variant_values || []).map((vv) => vv.option_value).join(' / ') || v.sku || 'Default';
    return {
      id: v.id,
      price: v.price,
      compareAtPrice: v.compare_at_price,
      stock: v.stock,
      label,
      options,
    };
  });
}

export function AddToCartMagic({ settings, content, locale, product, currency }: SectionRenderProps) {
  const { addItem } = useCart();
  const variants = useMemo(() => (product ? normaliseVariants(product) : []), [product]);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(variants[0]?.id ?? null);
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState(false);
  const [justAdded, setJustAdded] = useState(false);

  const buttonStyle = (settings.button_style as 'solid' | 'outline') || 'solid';
  const fullWidth = settings.full_width !== false;
  const showStock = settings.show_stock === true;
  const showSticky = settings.sticky_on_mobile === true;
  const showQuantity = settings.show_quantity !== false;

  const selectedVariant = useMemo(
    () => variants.find((v) => v.id === selectedVariantId) || variants[0],
    [variants, selectedVariantId],
  );

  const initialOptionSelection: Record<string, string> = {};
  if (selectedVariant) {
    for (const [name, value] of Object.entries(selectedVariant.options)) {
      initialOptionSelection[name] = value;
    }
  }
  const [optionSelection, setOptionSelection] = useState<Record<string, string>>(initialOptionSelection);

  if (!product) {
    return (
      <div
        className="text-center py-12 px-4"
        style={{
          backgroundColor: 'var(--theme-colors-surface)',
          border: '1px dashed var(--theme-colors-border)',
          borderRadius: 'var(--theme-radius-md)',
        }}
      >
        <div className="text-xs uppercase tracking-wide text-[var(--theme-colors-muted)]">
          Add to cart
        </div>
      </div>
    );
  }

  const displayPrice = selectedVariant?.price ?? product.base_price ?? 0;
  const compareAt = selectedVariant?.compareAtPrice ?? product.compare_at_price;
  const stock = selectedVariant?.stock;

  const c = currency || 'EUR';
  const priceLabel = new Intl.NumberFormat(locale === 'ar' ? 'ar' : locale, {
    style: 'currency',
    currency: c,
    maximumFractionDigits: 2,
  }).format(Number(displayPrice));
  const compareAtLabel = compareAt
    ? new Intl.NumberFormat(locale === 'ar' ? 'ar' : locale, {
        style: 'currency',
        currency: c,
        maximumFractionDigits: 2,
      }).format(Number(compareAt))
    : null;

  const buttonLabel = (content.button_label as string) || (locale === 'ar' ? 'أضف للسلة' : 'Add to cart');
  const tr =
    product.translations.find((t) => t.locale === locale) ||
    product.translations.find((t) => t.locale === 'en') ||
    product.translations[0];
  const title = tr?.title || 'Product';
  const imageUrl = product.images?.[0]?.url ? resolveMediaUrl(product.images[0].url) : undefined;

  async function handleAdd() {
    if (!product || busy) return;
    setBusy(true);
    try {
      await addItem(
        product.id,
        selectedVariantId,
        qty,
        {},
        { title, price: Number(displayPrice), imageUrl, currency: c },
      );
      setJustAdded(true);
      setTimeout(() => setJustAdded(false), 1800);
    } finally {
      setBusy(false);
    }
  }

  const optionGroups: Record<string, Set<string>> = {};
  for (const v of variants) {
    for (const [name, value] of Object.entries(v.options)) {
      (optionGroups[name] ||= new Set()).add(value);
    }
  }
  const optionNames = Object.keys(optionGroups);

  function pickOption(name: string, value: string) {
    const next = { ...optionSelection, [name]: value };
    setOptionSelection(next);
    const match = variants.find((v) =>
      Object.entries(next).every(([n, val]) => v.options[n] === val),
    );
    if (match) setSelectedVariantId(match.id);
  }

  const oos = typeof stock === 'number' && stock <= 0;

  const cta = (
    <button
      type="button"
      onClick={handleAdd}
      disabled={busy || oos}
      className={`inline-flex items-center justify-center gap-2 px-6 py-3 transition-all hover:opacity-90 hover:translate-y-[-1px] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 ${
        fullWidth ? 'w-full' : ''
      }`}
      style={
        buttonStyle === 'outline'
          ? {
              backgroundColor: 'transparent',
              color: 'var(--theme-colors-primary)',
              border: '2px solid var(--theme-colors-primary)',
              borderRadius: 'var(--theme-radius-md)',
              fontWeight: 'var(--theme-weight-bold)',
            }
          : {
              backgroundColor: 'var(--theme-colors-primary)',
              color: 'var(--theme-colors-primaryContrast, #fff)',
              borderRadius: 'var(--theme-radius-md)',
              fontWeight: 'var(--theme-weight-bold)',
              boxShadow: 'var(--theme-shadow-md)',
            }
      }
    >
      {busy ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          {locale === 'ar' ? 'جارٍ الإضافة…' : 'Adding…'}
        </>
      ) : justAdded ? (
        <>
          <Check className="w-4 h-4" />
          {locale === 'ar' ? 'أُضيف' : 'Added'}
        </>
      ) : oos ? (
        locale === 'ar' ? 'نفدت الكمية' : 'Out of stock'
      ) : (
        <>
          <ShoppingBag className="w-4 h-4" />
          {buttonLabel}
        </>
      )}
    </button>
  );

  return (
    <>
      <section className="space-y-5">
        {optionNames.map((name) => {
          const values = Array.from(optionGroups[name]);
          const isColor = COLOR_OPTION_NAMES.has(name);
          return (
            <div key={name} className="space-y-2">
              <div className="flex items-baseline justify-between">
                <span
                  className="text-xs font-medium uppercase tracking-wide"
                  style={{ color: 'var(--theme-colors-text)' }}
                >
                  {name}
                </span>
                {optionSelection[name] && (
                  <span className="text-xs" style={{ color: 'var(--theme-colors-muted)' }}>
                    {optionSelection[name]}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {values.map((value) => {
                  const isActive = optionSelection[name] === value;
                  if (isColor) {
                    const hex = hexFor(value) || '#888';
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => pickOption(name, value)}
                        title={value}
                        aria-label={value}
                        className="size-9 rounded-full transition-all"
                        style={{
                          backgroundColor: hex,
                          outline: isActive
                            ? '2px solid var(--theme-colors-primary)'
                            : '1px solid var(--theme-colors-border)',
                          outlineOffset: isActive ? '2px' : '0',
                        }}
                      />
                    );
                  }
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => pickOption(name, value)}
                      className="min-w-[44px] px-3 py-1.5 text-xs transition"
                      style={{
                        border: isActive
                          ? '2px solid var(--theme-colors-primary)'
                          : '1px solid var(--theme-colors-border)',
                        borderRadius: 'var(--theme-radius-sm)',
                        color: 'var(--theme-colors-text)',
                        backgroundColor: 'var(--theme-colors-background)',
                        fontWeight: isActive ? 'var(--theme-weight-bold)' : undefined,
                      }}
                    >
                      {value}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}

        <div className="flex items-baseline gap-3">
          <span
            style={{
              fontSize: 'var(--theme-scale-h3)',
              fontWeight: 'var(--theme-weight-bold)',
              color: 'var(--theme-colors-primary)',
            }}
          >
            {priceLabel}
          </span>
          {compareAtLabel && compareAt && compareAt > displayPrice && (
            <span
              className="line-through text-sm"
              style={{ color: 'var(--theme-colors-muted)' }}
            >
              {compareAtLabel}
            </span>
          )}
          {showStock && typeof stock === 'number' && (
            <span className="text-xs ml-auto" style={{ color: stock > 0 ? 'var(--theme-colors-muted)' : '#dc2626' }}>
              {stock > 0
                ? `${stock} ${locale === 'ar' ? 'متوفر' : 'in stock'}`
                : locale === 'ar' ? 'نفدت الكمية' : 'Out of stock'}
            </span>
          )}
        </div>

        {showQuantity && (
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium" style={{ color: 'var(--theme-colors-text)' }}>
              {locale === 'ar' ? 'الكمية' : 'Qty'}
            </span>
            <div
              className="inline-flex items-center"
              style={{
                border: '1px solid var(--theme-colors-border)',
                borderRadius: 'var(--theme-radius-sm)',
              }}
            >
              <button
                type="button"
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                className="px-2.5 py-1.5"
                style={{ color: 'var(--theme-colors-text)' }}
              >
                <Minus className="size-3.5" />
              </button>
              <span
                className="px-3 py-1.5 text-sm tabular-nums"
                style={{ minWidth: 40, textAlign: 'center', color: 'var(--theme-colors-text)' }}
              >
                {qty}
              </span>
              <button
                type="button"
                onClick={() => setQty((q) => q + 1)}
                className="px-2.5 py-1.5"
                style={{ color: 'var(--theme-colors-text)' }}
              >
                <Plus className="size-3.5" />
              </button>
            </div>
          </div>
        )}

        {cta}
      </section>

      {showSticky && (
        <div
          className="fixed bottom-0 inset-x-0 z-30 p-3 md:hidden"
          style={{
            backgroundColor: 'var(--theme-colors-background)',
            borderTop: '1px solid var(--theme-colors-border)',
            boxShadow: 'var(--theme-shadow-lg)',
          }}
        >
          {cta}
        </div>
      )}
    </>
  );
}
