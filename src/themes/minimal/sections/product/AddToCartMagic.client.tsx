'use client';

// Component implementation. Definition lives in AddToCartMagic.tsx.

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Check, Loader2, Minus, Plus, ShoppingBag } from 'lucide-react';
import { useCart } from '@/hooks/useCart';
import { useApiError } from '@/lib/useApiError';
import { resolveMediaUrl } from '@/lib/api';
import type { ProductContext, SectionRenderProps } from '../../../types';
import { PriceTaxSuffix } from '@/components/product/PriceTaxSuffix';
import { CustomFieldsForm } from '@/components/product/CustomFieldsForm';
import { useDisplayPrice } from '@/hooks/useDisplayPrice';
import type { PersonalizationProduct } from '@/lib/personalization/form';
import type { POptionConfig } from '@/lib/personalization';
import { PersonalizationForm } from '@/components/product/personalization/PersonalizationForm';
import { VariantCards } from '@/components/product/personalization/VariantCards';
import { usePersonalizationApp } from '@/components/product/personalization/usePersonalizationApp';
import { useStoreApp } from '@/hooks/useStoreApps';
import { readDesignerPayload } from '@/lib/designer/api';
import { DesignerLauncher } from '@/components/designer/DesignerLauncher';
import type { DesignedLine } from '@/components/designer/DesignerEditor';
import {
  errorKey,
  readApiPersonalizationErrors,
} from '@/components/product/personalization/model';

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

/** `variant_option_config` entry (only the keys this section reads). */
type SectionOptionConfig = POptionConfig & {
  style?: string;
  values?: string[];
  colorMap?: Record<string, string>;
  valueMeta?: Record<string, unknown> | null;
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

/**
 * Option groups in the seller's order (`variant_option_config`), with values
 * not mentioned there appended (same rule as `VariantSelector`).
 */
function optionGroupsOf(variants: NormalisedVariant[], configs: SectionOptionConfig[]): [string, string[]][] {
  const discovered: Record<string, string[]> = {};
  for (const v of variants) {
    for (const [name, value] of Object.entries(v.options)) {
      const list = (discovered[name] ||= []);
      if (!list.includes(value)) list.push(value);
    }
  }
  const ordered: [string, string[]][] = [];
  const placed = new Set<string>();
  for (const cfg of configs) {
    const values = cfg && typeof cfg.name === 'string' ? discovered[cfg.name] : undefined;
    if (!values || placed.has(cfg.name)) continue;
    placed.add(cfg.name);
    const configured = Array.isArray(cfg.values) ? cfg.values : [];
    ordered.push([
      cfg.name,
      [...configured.filter((v) => values.includes(v)), ...values.filter((v) => !configured.includes(v))],
    ]);
  }
  for (const [name, values] of Object.entries(discovered)) if (!placed.has(name)) ordered.push([name, values]);
  return ordered;
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

export function AddToCartMagic({ settings, content, locale, primaryLocale, product, currency }: SectionRenderProps) {
  const t = useTranslations();
  const { addItem } = useCart();
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
  const optionGroups = useMemo(() => optionGroupsOf(variants, optionConfigs), [variants, optionConfigs]);
  const optionNames = useMemo(() => optionGroups.map(([name]) => name), [optionGroups]);
  const configByName = useMemo(() => {
    const map: Record<string, SectionOptionConfig> = {};
    for (const cfg of optionConfigs) if (cfg && typeof cfg.name === 'string') map[cfg.name] = cfg;
    return map;
  }, [optionConfigs]);

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
  const [justAdded, setJustAdded] = useState(false);
  const [addError, setAddError] = useState('');
  const apiError = useApiError();
  // Designer app (M4.2): the editor replaces the form and the add button.
  const designerApp = useStoreApp('designer');
  const designer = useMemo(
    () => (designerApp && product ? readDesignerPayload(product.designer) : null),
    [designerApp, product],
  );

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
          Add to cart
        </div>
      </div>
    );
  }

  // The shown unit price includes the personalization modifier where it is
  // in the shown currency (display only; the server prices the line).
  const displayPrice = Number(selectedVariant?.price ?? product.base_price ?? 0) + app.priceDelta;
  const compareAt = selectedVariant?.compareAtPrice ?? product.compare_at_price;
  const stock = selectedVariant?.stock;

  const priceLabel = new Intl.NumberFormat(locale === 'ar' ? 'ar' : locale, {
    style: 'currency',
    currency: c,
    maximumFractionDigits: 2,
  }).format(display(Number(displayPrice), taxRateBp, c).amount);
  const compareAtLabel = compareAt
    ? new Intl.NumberFormat(locale === 'ar' ? 'ar' : locale, {
        style: 'currency',
        currency: c,
        maximumFractionDigits: 2,
      }).format(display(Number(compareAt), taxRateBp, c).amount)
    : null;

  const buttonLabel = (content.button_label as string) || (locale === 'ar' ? 'أضف للسلة' : 'Add to cart');
  const tr =
    product.translations.find((t) => t.locale === locale) ||
    product.translations.find((t) => t.locale === 'en') ||
    product.translations[0];
  const title = tr?.title || 'Product';
  const imageUrl = product.images?.[0]?.url ? resolveMediaUrl(product.images[0].url) : undefined;

  /** Moves focus to a personalization input (ids from CustomFieldsForm). */
  function focusField(fieldId: string) {
    document.getElementById(`field-${fieldId}`)?.focus();
  }

  async function handleAdd() {
    if (!product || busy || needsVariant) return;
    setAddError('');
    // Same rules as the API; a missing required field blocks the add.
    const check = personalization.validateAll();
    if (!check.ok) {
      // A field error already shows inline under its field: focus it instead
      // of repeating the message below the button.
      if (check.fieldId) focusField(check.fieldId);
      else setAddError(check.firstError || '');
      return;
    }
    // No custom fields → `{}` and no display lines, exactly as before M4.0 (G0).
    const { fields, display } = personalization.buildPayload();
    setBusy(true);
    try {
      await addItem(
        product.id,
        selectedVariantId,
        qty,
        fields ?? {},
        {
          title,
          price: displayPrice,
          ...(selectedVariant && Object.keys(selectedVariant.options).length > 0
            ? { variant: Object.entries(selectedVariant.options).map(([k, v]) => `${k}: ${v}`).join(' / ') }
            : {}),
          imageUrl,
          currency: c,
          taxRateBp: taxRateBp ?? undefined,
          ...(display ? { customFieldDisplay: display } : {}),
          // Personalization app (D14): guests validate on the server first.
          ...(advanced && storeSlug
            ? { personalizationCheck: { storeSlug, locale, market: market?.key ?? null } }
            : {}),
        },
      );
      setJustAdded(true);
      setTimeout(() => setJustAdded(false), 1800);
    } catch (err) {
      // Field rule errors (K2) show inline on their field only; others
      // (e.g. CART_ITEM_NOT_AVAILABLE_IN_MARKET) are translated via errors.*
      const appErrors = advanced ? readApiPersonalizationErrors(err) : null;
      const fieldId = appErrors?.[0] ? errorKey(appErrors[0]) : (err as { field_id?: unknown } | null)?.field_id;
      if (personalization.applyServerError(err)) {
        if (typeof fieldId === 'string') focusField(fieldId);
      } else setAddError(apiError(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleDesignerAdd(line: DesignedLine) {
    if (!product) return;
    await addItem(product.id, selectedVariantId, qty, undefined, {
      title,
      price: displayPrice,
      ...(selectedVariant && Object.keys(selectedVariant.options).length > 0
        ? { variant: Object.entries(selectedVariant.options).map(([k, v]) => `${k}: ${v}`).join(' / ') }
        : {}),
      imageUrl,
      currency: c,
      taxRateBp: taxRateBp ?? undefined,
      customFieldDisplay: line.display,
      design: { id: line.designId, token: line.token, proofUrl: line.proofUrl },
    });
  }

  function handleDesignerDone(kind: 'added' | 'saved') {
    if (kind !== 'added') return;
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1800);
  }

  function pickOption(name: string, value: string) {
    const next = { ...optionSelection, [name]: value };
    setOptionSelection(next);
    // Keeping the old variant when nothing matches would add a combination
    // the buyer is no longer looking at.
    setSelectedVariantId(resolveVariant(variants, optionNames, next)?.id ?? null);
  }

  /** A value is pickable when an active, in-stock variant carries it with the other picks. */
  function isOptionAvailable(name: string, value: string): boolean {
    const hypothetical = { ...optionSelection, [name]: value };
    return variants.some(
      (v) =>
        v.is_active !== false &&
        (typeof v.stock !== 'number' || v.stock > 0) &&
        optionNames.every((k) => hypothetical[k] === undefined || v.options[k] === hypothetical[k]),
    );
  }

  const oos = typeof stock === 'number' && stock <= 0;
  // A product with variants needs one resolved before it can be added.
  const needsVariant = variants.length > 0 && !selectedVariant;

  // Option picker of the variants (page form; also the designer review step).
  const optionPicker = () =>
    optionGroups.map(([name, values]) => {
      const config = configByName[name];
      // Variation cards only with the app on (D9/D10); 'card' is text otherwise.
      const isCard = config?.style === 'card' && cardsConfig !== undefined;
      const isColor = config?.style === 'color' || COLOR_OPTION_NAMES.has(name.toLowerCase());
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
          {isCard && cardsConfig ? (
            <VariantCards
              option={name}
              values={values}
              config={config}
              selectedValue={optionSelection[name]}
              selections={optionSelection}
              optionNames={optionNames}
              variants={variants}
              isAvailable={(value) => isOptionAvailable(name, value)}
              onSelect={(value) => pickOption(name, value)}
              settings={cardsConfig}
            />
          ) : (
            <div className="flex flex-wrap gap-2">
              {values.map((value) => {
                const isActive = optionSelection[name] === value;
                if (isColor) {
                  const hex = config?.colorMap?.[value] || hexFor(value) || '#888';
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
          )}
        </div>
      );
    });

  const designerCta = designer ? (
    justAdded ? (
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
    ) : (
      <DesignerLauncher
        payload={designer}
        productId={product.id}
        locale={locale}
        productTitle={title}
        priceLabel={priceLabel}
        blockedReason={oos ? t('product.outOfStock') : needsVariant ? t('product.selectOptions') : null}
        variantPicker={!oos && needsVariant ? <div className="space-y-3">{optionPicker()}</div> : undefined}
        onAddToCart={handleDesignerAdd}
        onDone={handleDesignerDone}
        className={`inline-flex items-center justify-center gap-2 px-6 py-3 transition-all hover:opacity-90 ${fullWidth ? 'w-full' : ''}`}
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
      />
    )
  ) : null;

  const cta = designerCta ?? (
    <button
      type="button"
      onClick={handleAdd}
      disabled={busy || oos || needsVariant}
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
            <span className="text-xs ml-auto" style={{ color: stock > 0 ? 'var(--theme-colors-muted)' : '#dc2626' }}>
              {stock > 0
                ? `${stock} ${locale === 'ar' ? 'متوفر' : 'in stock'}`
                : locale === 'ar' ? 'نفدت الكمية' : 'Out of stock'}
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
        {addError && (
          <p role="alert" className="text-sm text-red-600">{addError}</p>
        )}
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
