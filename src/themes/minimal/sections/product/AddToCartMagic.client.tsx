'use client';

// Component implementation. Definition lives in AddToCartMagic.tsx.

import { useMemo, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Check, Loader2, Minus, Plus, ShoppingBag } from 'lucide-react';
import { useApiError } from '@/lib/useApiError';
import { resolveMediaUrl } from '@/lib/api';
import type { LineSource } from '@/lib/cartLine';
import type { ProductContext, SectionRenderProps } from '../../../types';
import { PriceTaxSuffix } from '@/components/product/PriceTaxSuffix';
import { CustomFieldsForm } from '@/components/product/CustomFieldsForm';
import { VariantSelector } from '@/components/product/VariantSelector';
import { useDisplayPrice } from '@/hooks/useDisplayPrice';
import type { PersonalizationProduct } from '@/lib/personalization/form';
import type { POptionConfig } from '@/lib/personalization/types';
import { PersonalizationForm } from '@/components/product/personalization/PersonalizationForm';
import { usePersonalizationApp } from '@/components/product/personalization/usePersonalizationApp';
import { focusPersonalizationField } from '@/components/product/usePersonalizationFields';
import { useAddToCartLine } from '@/components/product/useAddToCartLine';
import { DesignerFormSlot, useDesignerAddonsTotal, useDesignerSession } from '@/components/designer/DesignerSession';
import type { DesignedLine } from '@/components/designer/DesignerInline';
import {
  errorKey,
  readApiPersonalizationErrors,
} from '@/components/product/personalization/model';

/** `variant_option_config` entry as `VariantSelector` reads it. */
type SectionOptionConfig = POptionConfig & {
  style: string;
  values?: string[];
  colorMap?: Record<string, string>;
  dualColorMap?: Record<string, [string, string]>;
  imageMap?: Record<string, string>;
  swatchMap?: Record<string, string>;
  valueMeta?: Record<string, unknown>;
};

interface NormalisedVariant {
  id: string;
  price: number;
  compareAtPrice?: number;
  stock?: number;
  is_active?: boolean | null;
  label: string;
  /** Picks keyed by the original-case option name (as the API and the evaluator use them). */
  options: Record<string, string>;
}

type RawVariant = NonNullable<ProductContext['variants']>[number] & {
  options?: unknown;
  is_active?: boolean | null;
};

/**
 * Variant options: the storefront payload's `options` JSON (name → value),
 * falling back to the legacy `variant_values` rows.
 */
function variantOptions(v: RawVariant): Record<string, string> {
  const out: Record<string, string> = {};
  if (v.options && typeof v.options === 'object' && !Array.isArray(v.options)) {
    for (const [name, value] of Object.entries(v.options as Record<string, unknown>)) {
      if (typeof value === 'string' && name !== '') out[name] = value;
    }
    if (Object.keys(out).length > 0) return out;
  }
  for (const vv of v.variant_values || []) {
    if (vv && typeof vv.option_name === 'string' && typeof vv.option_value === 'string') {
      out[vv.option_name] = vv.option_value;
    }
  }
  return out;
}

function normaliseVariants(product: ProductContext): NormalisedVariant[] {
  return ((product.variants || []) as RawVariant[]).map((v) => {
    const options = variantOptions(v);
    const label = Object.values(options).join(' / ') || v.sku || 'Default';
    return {
      id: v.id,
      price: v.price,
      compareAtPrice: v.compare_at_price,
      stock: v.stock,
      is_active: v.is_active,
      label,
      options,
    };
  });
}

/** Option names the variants carry (the picker's groups). */
function optionNamesOf(variants: NormalisedVariant[]): string[] {
  const names: string[] = [];
  for (const v of variants) for (const name of Object.keys(v.options)) if (!names.includes(name)) names.push(name);
  return names;
}

/** The variant the picks resolve to: every option picked and a matching variant. */
function resolveVariant(
  variants: NormalisedVariant[],
  optionNames: string[],
  picks: Record<string, string>,
): NormalisedVariant | undefined {
  if (!optionNames.every((n) => typeof picks[n] === 'string')) return undefined;
  return variants.find((v) => optionNames.every((n) => v.options[n] === picks[n]));
}

// The option picker is the page's `VariantSelector` (M5 D19), which reads the
// store primary colour; map the theme token onto it for this section.
const SCOPE_STYLE = { ['--store-primary' as string]: 'var(--theme-colors-primary)' } as CSSProperties;

export function AddToCartMagic({ settings, content, locale, primaryLocale, product, currency }: SectionRenderProps) {
  const t = useTranslations();
  // Shared add-to-cart (M5 D31): same line metadata as the product page,
  // "added" confirmation with its timer cleared on unmount (D28).
  const { addLine, addDesignLine, justAdded, markAdded } = useAddToCartLine();
  // b2b app: company view shows net amounts.
  const display = useDisplayPrice();
  const variants = useMemo(() => (product ? normaliseVariants(product) : []), [product]);
  const optionConfigs = useMemo(
    () =>
      Array.isArray(product?.variant_option_config)
        ? (product.variant_option_config as SectionOptionConfig[])
        : [],
    [product],
  );
  const optionNames = useMemo(() => optionNamesOf(variants), [variants]);

  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(variants[0]?.id ?? null);
  const [optionSelection, setOptionSelection] = useState<Record<string, string>>(() => ({
    ...(variants[0]?.options ?? {}),
  }));

  // No fallback to the first variant: when the picked options match no
  // variant, nothing is selected and the button is disabled.
  const selectedVariant = useMemo(
    () => variants.find((v) => v.id === selectedVariantId),
    [variants, selectedVariantId],
  );

  const c = currency || 'EUR';
  const taxRateBp = product?.tax_rate_bp ?? null;

  // Personalization app (M4.1), shared with the product page: gate, form,
  // variation cards, URL prefill and price delta. Off = the M4.0 section;
  // the storefront product carries `custom_fields` (+ creator `field_values`)
  // through ProductContext's catch-all, with the same form and rules.
  const app = usePersonalizationApp({
    product: product as PersonalizationProduct | undefined,
    personalization: product?.personalization,
    optionConfig: optionConfigs,
    variants,
    variantOptions: selectedVariant?.options,
    optionSelections: optionSelection,
    locale,
    primaryLocale: primaryLocale || locale,
    currency: c,
    taxRateBp,
    onPrefillOptions: (picks) => {
      const next = { ...optionSelection, ...picks };
      setOptionSelection(next);
      setSelectedVariantId(resolveVariant(variants, optionNames, next)?.id ?? null);
    },
  });
  const { appSettings, market, storeSlug, advanced, cardsConfig } = app;
  const personalization = app.fields;
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState(false);
  const [addError, setAddError] = useState('');
  const apiError = useApiError();
  // Designer app (M4.2 / M5.5): the inline form replaces the fields and the
  // add button; the canvas renders in the gallery section (shared session).
  const designer = useDesignerSession();
  const designerAddons = useDesignerAddonsTotal();

  const buttonStyle = (settings.button_style as 'solid' | 'outline') || 'solid';
  const fullWidth = settings.full_width !== false;
  const showStock = settings.show_stock === true;
  const showSticky = settings.sticky_on_mobile === true;
  const showQuantity = settings.show_quantity !== false;

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
          {t('common.addToCart')}
        </div>
      </div>
    );
  }

  // The shown unit price includes the personalization modifier where it is
  // in the shown currency (display only; the server prices the line).
  const displayPrice = Number(selectedVariant?.price ?? product.base_price ?? 0) + app.priceDelta;
  const compareAt = selectedVariant?.compareAtPrice ?? product.compare_at_price;
  const stock = selectedVariant?.stock;

  const money = (amount: number) =>
    new Intl.NumberFormat(locale === 'ar' ? 'ar' : locale, {
      style: 'currency',
      currency: c,
      maximumFractionDigits: 2,
    }).format(display(amount, taxRateBp, c).amount);
  const priceLabel = money(Number(displayPrice));
  const compareAtLabel = compareAt
    ? new Intl.NumberFormat(locale === 'ar' ? 'ar' : locale, {
        style: 'currency',
        currency: c,
        maximumFractionDigits: 2,
      }).format(display(Number(compareAt), taxRateBp, c).amount)
    : null;

  const buttonLabel = (content.button_label as string) || t('common.addToCart');
  const tr =
    product.translations.find((t) => t.locale === locale) ||
    product.translations.find((t) => t.locale === 'en') ||
    product.translations[0];
  const title = tr?.title || 'Product';
  const imageUrl = product.images?.[0]?.url ? resolveMediaUrl(product.images[0].url) : undefined;
  // Secondary locales get a path prefix; the primary stays canonical.
  const langPrefix = locale && locale !== primaryLocale ? `/${locale}` : '';

  // What both add paths (fields / design) know about the line (M5 D31).
  const lineSource: LineSource = {
    title,
    unitPrice: displayPrice,
    imageUrl,
    variantOptions: selectedVariant?.options ?? null,
    currency: c,
    taxRateBp,
  };

  async function handleAdd() {
    if (!product || busy || needsVariant) return;
    setAddError('');
    // Same rules as the API; a missing required field blocks the add.
    const check = personalization.validateAll();
    if (!check.ok) {
      // A field error already shows inline under its field: focus and scroll
      // to it (D20) instead of repeating the message below the button.
      if (check.fieldId) focusPersonalizationField(check.fieldId);
      else setAddError(check.firstError || '');
      return;
    }
    // No custom fields → `{}` and no display lines, exactly as before M4.0 (G0).
    const { fields, display } = personalization.buildPayload();
    setBusy(true);
    try {
      await addLine({ productId: product.id, variantId: selectedVariantId, quantity: qty, source: lineSource }, fields ?? {}, {
        ...(display ? { customFieldDisplay: display } : {}),
        // Personalization app (D14): guests validate on the server first.
        ...(advanced && storeSlug
          ? { personalizationCheck: { storeSlug, locale, market: market?.key ?? null } }
          : {}),
      });
    } catch (err) {
      // Field rule errors (K2) show inline on their field only; others
      // (e.g. CART_ITEM_NOT_AVAILABLE_IN_MARKET) are translated via errors.*
      const appErrors = advanced ? readApiPersonalizationErrors(err) : null;
      const fieldId = appErrors?.[0] ? errorKey(appErrors[0]) : (err as { field_id?: unknown } | null)?.field_id;
      if (personalization.applyServerError(err)) {
        if (typeof fieldId === 'string') focusPersonalizationField(fieldId);
      } else setAddError(apiError(err));
    } finally {
      setBusy(false);
    }
  }

  function handleDesignerAdd(line: DesignedLine) {
    if (!product) return Promise.resolve();
    return addDesignLine({ productId: product.id, variantId: selectedVariantId, quantity: qty, source: lineSource }, line);
  }

  function handleDesignerDone(kind: 'added' | 'saved') {
    if (kind === 'added') markAdded();
  }

  const oos = typeof stock === 'number' && stock <= 0;
  // A product with variants needs one resolved before it can be added.
  const needsVariant = variants.length > 0 && !selectedVariant;

  // Option picker of the variants (page form; also the designer review
  // step): the page's selector, controlled by this section's picks (D19).
  const optionPicker = () =>
    variants.length > 0 ? (
      <VariantSelector
        variants={variants}
        selections={optionSelection}
        selectedVariantId={selectedVariantId ?? undefined}
        onSelect={(id) => setSelectedVariantId(id ?? null)}
        onSelectionsChange={setOptionSelection}
        optionConfigs={optionConfigs}
        personalization={cardsConfig}
        inStockText={t('product.inStock')}
        outOfStockText={t('product.outOfStock')}
      />
    ) : null;

  // "Added" confirmation with a way to the cart (M5 D5).
  const addedState = (
    <div className={`flex flex-col gap-2 ${fullWidth ? 'w-full' : ''}`}>
      <span
        role="status"
        className={`inline-flex items-center justify-center gap-2 px-6 py-3 ${fullWidth ? 'w-full' : ''}`}
        style={{
          backgroundColor: 'var(--theme-colors-primary)',
          color: 'var(--theme-colors-primaryContrast, #fff)',
          borderRadius: 'var(--theme-radius-md)',
          fontWeight: 'var(--theme-weight-bold)',
        }}
      >
        <Check className="w-4 h-4" />
        {t('cart.itemAdded')}
      </span>
      <Link
        href={`${langPrefix}/cart`}
        className="min-h-11 inline-flex items-center justify-center text-sm underline underline-offset-4"
        style={{ color: 'var(--theme-colors-primary)' }}
      >
        {t('cart.viewCart')}
      </Link>
    </div>
  );

  const quantityPicker = showQuantity ? (
    <div className="flex items-center gap-3">
      <span className="text-xs font-medium" style={{ color: 'var(--theme-colors-text)' }}>
        {t('product.quantity')}
      </span>
      {/* 44px touch targets (M5 D18) */}
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
          aria-label={t('common.decreaseQuantity')}
          className="size-11 inline-flex items-center justify-center"
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
          aria-label={t('common.increaseQuantity')}
          className="size-11 inline-flex items-center justify-center"
          style={{ color: 'var(--theme-colors-text)' }}
        >
          <Plus className="size-3.5" />
        </button>
      </div>
    </div>
  ) : null;

  // Inline designer form (M5.5): photos → texts → CTA with the live total,
  // the section's quantity picker next to it (NPP has none).
  const designerForm = designer ? (
    <DesignerFormSlot
      totalLabel={money((Number(displayPrice) + designerAddons) * qty)}
      quantitySelector={quantityPicker}
      blockedReason={oos ? t('product.outOfStock') : needsVariant ? t('product.selectOptions') : null}
      addedContent={justAdded ? addedState : undefined}
      onAddToCart={handleDesignerAdd}
      onDone={handleDesignerDone}
      buttonClassName={`inline-flex min-h-11 flex-1 items-center justify-center gap-2 px-6 py-3 transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none ${fullWidth ? 'w-full' : ''}`}
      buttonStyle={
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
    />
  ) : null;

  const cta = justAdded ? addedState : (
    <button
      type="button"
      onClick={handleAdd}
      disabled={busy || oos || needsVariant}
      className={`inline-flex items-center justify-center gap-2 px-6 py-3 min-h-11 transition-all hover:opacity-90 hover:translate-y-[-1px] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 ${
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
          {t('product.addingToCart')}
        </>
      ) : oos ? (
        t('product.outOfStock')
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
      <section className="space-y-5" style={SCOPE_STYLE}>
        {advanced && !designer && (
          <PersonalizationForm
            model={advanced}
            placement="before_variants"
            showAllErrors={personalization.showAllErrors}
            locale={locale}
            primaryLocale={primaryLocale || locale}
            anchor
          />
        )}
        {optionPicker()}

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
          <PriceTaxSuffix className="text-xs" style={{ color: 'var(--theme-colors-muted)' }} taxRateBp={taxRateBp} />
          {/* Personalization app: the modifier is priced in the cart outside the default market. */}
          {app.deltaInCart && (
            <span className="text-xs" style={{ color: 'var(--theme-colors-muted)' }}>
              {t('personalization.priceInCart')}
            </span>
          )}
          {showStock && typeof stock === 'number' && (
            <span className="text-xs ms-auto" style={{ color: stock > 0 ? 'var(--theme-colors-muted)' : '#dc2626' }}>
              {stock > 0 ? t('product.stockCount', { count: stock }) : t('product.outOfStock')}
            </span>
          )}
        </div>

        {advanced && !designer && (
          <PersonalizationForm
            model={advanced}
            placement="after_variants"
            showAllErrors={personalization.showAllErrors}
            locale={locale}
            primaryLocale={primaryLocale || locale}
            showSummary={appSettings.validation_summary}
          />
        )}
        {!advanced && !designer && personalization.fields.length > 0 && (
          <CustomFieldsForm
            fields={personalization.fields}
            values={personalization.values}
            onChange={personalization.onChange}
            errors={personalization.errors}
            showAllErrors={personalization.showAllErrors}
            fillable={personalization.fillable}
            onFill={personalization.onFill}
          />
        )}

        {designerForm ?? (
          <>
            {quantityPicker}
            {cta}
          </>
        )}
        {addError && (
          <p role="alert" className="text-sm text-red-600">{addError}</p>
        )}
      </section>

      {/* The inline designer's CTA is at the end of its form (NPP); no sticky copy. */}
      {showSticky && !designer && (
        <div
          className="fixed bottom-0 inset-x-0 z-30 p-3 md:hidden"
          style={{
            backgroundColor: 'var(--theme-colors-background)',
            borderTop: '1px solid var(--theme-colors-border)',
            boxShadow: 'var(--theme-shadow-lg)',
            ...SCOPE_STYLE,
          }}
        >
          {cta}
        </div>
      )}
    </>
  );
}
