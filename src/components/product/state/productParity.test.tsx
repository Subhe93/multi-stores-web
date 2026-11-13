import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import type { ProductData } from '@/components/product/ProductDetailClient';
import type { ProductContext, SectionRenderProps } from '@/themes/types';
import type { StorefrontApps } from '@/lib/storeApps';
import type { StoreTaxConfig } from '@/lib/tax';

// Money / behaviour parity (product template layout, wave 5 E1).
//
// For real namez-se products (src/test/fixtures/products, fetched from the
// public storefront API) the monolith `product-page` (ProductDetailClient)
// and the Classic block composition (breadcrumb, title, price, short
// description, promotions, bundles, variants, personalization, buy, gallery,
// trust, shipping, tabs inside one ProductPageStateProvider) are driven
// through the same clicks: option picks, quantity, bundle offers,
// personalization text and add to cart. Everything the shopper sees about
// money, and the exact cart line, must be identical.
//
// Only the edges are mocked: router, translations (keys), the cart hook
// (captures the line) and next/image. The personalization app, the variant
// selector, the forms and the shared state are the real ones, with the
// store's live app settings and tax config.

const addItem = vi.fn<(...args: unknown[]) => Promise<void>>(() => Promise.resolve());

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/products/x',
  useParams: () => ({ storeSlug: 'namez-se' }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('next-intl', () => {
  const t = Object.assign(
    (k: string, values?: Record<string, unknown>) => (values ? `${k} ${JSON.stringify(values)}` : k),
    {
      rich: (k: string) => k,
      markup: (k: string) => k,
      raw: (k: string) => k,
      has: () => true,
    },
  );
  return { useLocale: () => 'sv', useTranslations: () => t };
});
vi.mock('@/hooks/useCart', () => ({ useCart: () => ({ addItem }) }));
// Plain <img> instead of next/image so image sources can be compared.
vi.mock('@/components/StoreImage', () => ({
  StoreImage: ({ src, alt }: { src: string; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} />
  ),
}));

import { ProductDetailClient } from '@/components/product/ProductDetailClient';
import { ProductPageStateProvider } from '@/components/product/state/ProductPageState';
import { DesignerSessionProvider } from '@/components/designer/DesignerSession';
import { StoreAppsProvider } from '@/hooks/useStoreApps';
import { StoreTaxProvider } from '@/hooks/useStoreTax';
import { ProductBreadcrumbBlock } from '@/themes/minimal/sections/product/blocks/ProductBreadcrumbBlock.client';
import { ProductTitleBlock } from '@/themes/minimal/sections/product/blocks/ProductTitleBlock.client';
import { ProductPriceBlock } from '@/themes/minimal/sections/product/blocks/ProductPriceBlock.client';
import { ProductShortDescriptionBlock } from '@/themes/minimal/sections/product/blocks/ProductShortDescriptionBlock.client';
import { ProductPromotionsBlock } from '@/themes/minimal/sections/product/blocks/ProductPromotionsBlock.client';
import { ProductBundlesBlock } from '@/themes/minimal/sections/product/blocks/ProductBundlesBlock.client';
import { ProductVariantsBlock } from '@/themes/minimal/sections/product/blocks/ProductVariantsBlock.client';
import { ProductPersonalizationBlock } from '@/themes/minimal/sections/product/blocks/ProductPersonalizationBlock.client';
import { ProductBuyBlock } from '@/themes/minimal/sections/product/blocks/ProductBuyBlock.client';
import { ProductGalleryMagic } from '@/themes/minimal/sections/product/ProductGalleryMagic.client';
import { ProductTrustBlock } from '@/themes/minimal/sections/product/blocks/ProductTrustBlock.client';
import { ProductShippingBlock } from '@/themes/minimal/sections/product/blocks/ProductShippingBlock.client';
import { ProductTabsBlock } from '@/themes/minimal/sections/product/blocks/ProductTabsBlock.client';

import storeContext from '@/test/fixtures/products/namez-store-context.json';
import simpleDalahast from '@/test/fixtures/products/simple-dalahast.json';
import colourCompareAt from '@/test/fixtures/products/colour-compare-at-personalization.json';
import imageMapBottle from '@/test/fixtures/products/imagemap-multi-piece-bottle.json';
import multiPieceCards from '@/test/fixtures/products/multi-piece-cards-compare-at.json';
import threeOptions from '@/test/fixtures/products/three-options-conditional-fields.json';
import beforeVariants from '@/test/fixtures/products/before-variants-fields-cards.json';
import variantCompareAt from '@/test/fixtures/products/variant-compare-at.json';
import derivedBundles from '@/test/fixtures/products/derived-bundles-sku.json';

const LOCALE = storeContext.primaryLocale;
const CURRENCY = storeContext.currency;
const APPS = storeContext.apps as unknown as StorefrontApps;
const TAX = storeContext.tax as StoreTaxConfig;
/** Option combinations driven per product (spread over the purchasable variants). */
const COMBO_CAP = 4;

const FIXTURES: Record<string, ProductData> = {
  'simple-dalahast': simpleDalahast as unknown as ProductData,
  'colour-compare-at-personalization': colourCompareAt as unknown as ProductData,
  'imagemap-multi-piece-bottle': imageMapBottle as unknown as ProductData,
  'multi-piece-cards-compare-at': multiPieceCards as unknown as ProductData,
  'three-options-conditional-fields': threeOptions as unknown as ProductData,
  'before-variants-fields-cards': beforeVariants as unknown as ProductData,
  'variant-compare-at': variantCompareAt as unknown as ProductData,
  'derived-bundles-sku': derivedBundles as unknown as ProductData,
};

// ── Renders ──────────────────────────────────────────────

function StoreShell({ children }: { children: ReactNode }) {
  return (
    <StoreAppsProvider value={APPS}>
      <StoreTaxProvider value={TAX}>{children}</StoreTaxProvider>
    </StoreAppsProvider>
  );
}

function renderMonolith(product: ProductData) {
  return render(
    <StoreShell>
      <ProductDetailClient
        product={product}
        locale={LOCALE}
        primaryLocale={LOCALE}
        currency={CURRENCY}
        options={{ trustBadges: [], showShipping: true, showTabs: true }}
      />
    </StoreShell>,
  );
}

/** The Classic preset: Row[ Column(gallery) | Column(summary blocks) ], tabs below. */
function renderClassicBlocks(product: ProductData) {
  const p = (settings: Record<string, unknown> = {}): SectionRenderProps => ({
    settings,
    content: {},
    locale: LOCALE,
    primaryLocale: LOCALE,
    storeSlug: 'namez-se',
    currency: CURRENCY,
    product: product as unknown as ProductContext,
    builderPreview: false,
  });
  return render(
    <StoreShell>
      <DesignerSessionProvider designer={product.designer} productId={product.id} locale={LOCALE}>
        <ProductPageStateProvider product={product} locale={LOCALE} primaryLocale={LOCALE} currency={CURRENCY}>
          <div className="grid grid-cols-1 md:grid-cols-2">
            <div>
              <ProductGalleryMagic {...p({ layout: 'classic' })} />
            </div>
            <div className="flex flex-col gap-5">
              <ProductBreadcrumbBlock {...p()} />
              <ProductTitleBlock {...p()} />
              <ProductPriceBlock {...p()} />
              <ProductShortDescriptionBlock {...p()} />
              <ProductPromotionsBlock {...p()} />
              <ProductBundlesBlock {...p()} />
              <ProductPersonalizationBlock {...p({ placement: 'before_variants' })} />
              <ProductVariantsBlock {...p()} />
              <ProductPersonalizationBlock {...p({ placement: 'after_variants' })} />
              <ProductBuyBlock {...p()} />
              <ProductTrustBlock {...p()} />
              <ProductShippingBlock {...p()} />
            </div>
          </div>
          <ProductTabsBlock {...p()} />
        </ProductPageStateProvider>
      </DesignerSessionProvider>
    </StoreShell>,
  );
}

// ── What the shopper sees ────────────────────────────────

const text = (el: Element | null | undefined) => el?.textContent?.trim() ?? null;

function addButton(root: HTMLElement): HTMLButtonElement | null {
  const labels = ['common.addToCart', 'product.addingToCart', 'cart.itemAdded'];
  return (
    (Array.from(root.querySelectorAll('button')).find(
      (b) => labels.includes(b.textContent?.trim() ?? '') && b.className.includes('rounded-full'),
    ) as HTMLButtonElement | undefined) ?? null
  );
}

interface Snapshot {
  step: string;
  price: string | null;
  compareAt: string | null;
  discountBadge: string | null;
  taxSuffix: string | null;
  unitLine: string | null;
  savings: string | null;
  sku: string | null;
  leadImage: string | null;
  addEnabled: boolean | null;
  selectOptionsHint: boolean;
  fieldError: string | null;
  toastError: string | null;
  bundleChip: string | null;
  bundleOffers: string[];
  addedLines: unknown[];
  /** Option groups (O:key) and text fields (F) in document order: where the fields sit around the picker. */
  formOrder: string[];
}

function formOrder(root: HTMLElement): string[] {
  const out: string[] = [];
  root
    .querySelectorAll<HTMLElement>('p.text-sm.font-semibold.text-gray-900.mb-3, input[type="text"], input:not([type]), textarea')
    .forEach((el) => {
      if (el.tagName === 'P') out.push(`O:${el.firstChild?.textContent ?? ''}`);
      else if (!(el as HTMLInputElement).disabled && !(el as HTMLInputElement).readOnly) out.push('F');
    });
  return out;
}

/** Functions (the guest personalization check's line pricer) as their result for a fixed unit price. */
function normalize(value: unknown): unknown {
  if (typeof value === 'function') return `fn(100)=${JSON.stringify((value as (n: number) => unknown)(100))}`;
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, normalize(v)]));
  }
  return value;
}

function snapshot(root: HTMLElement, step: string): Snapshot {
  const priceEl = root.querySelector('span.text-3xl.font-extrabold');
  const priceRow = priceEl?.parentElement ?? null;
  const priceBox = priceRow?.parentElement ?? null;
  const priceLines = priceBox ? Array.from(priceBox.querySelectorAll(':scope > p')).map((p) => p.textContent?.trim() ?? '') : [];
  const button = addButton(root);
  const chip = root.querySelector('.border-blue-200.bg-blue-50\\/50 span.truncate');
  return {
    step,
    price: text(priceEl),
    compareAt: text(priceRow?.querySelector('.line-through')),
    discountBadge: text(priceRow?.querySelector('span.rounded-full')),
    taxSuffix: priceRow ? Array.from(priceRow.children).slice(1).map((c) => c.textContent?.trim()).filter(Boolean).join('|') || null : null,
    unitLine: priceLines.find((l) => l.includes(' × ')) ?? null,
    savings: priceLines.find((l) => l.startsWith('product.savingsAmount')) ?? null,
    sku: priceLines.find((l) => l.startsWith('SKU:')) ?? null,
    leadImage: root.querySelector('img')?.getAttribute('src') ?? null,
    addEnabled: button ? !button.disabled : null,
    selectOptionsHint: Array.from(root.querySelectorAll('p.text-amber-600')).some((p) => p.textContent?.includes('product.selectOptions')),
    fieldError: text(root.querySelector('p.text-sm.text-red-600.font-medium')),
    toastError: text(root.querySelector('[role="alert"]')),
    bundleChip: text(chip),
    bundleOffers: bundleOfferButtons(root).map(
      (b) => `${b.getAttribute('aria-pressed')}:${b.textContent?.trim()}`,
    ),
    addedLines: addItem.mock.calls.map((c) => normalize(c)),
    formOrder: formOrder(root),
  };
}

// ── Driving the page ─────────────────────────────────────

/** Bundle offer buttons (same markup in the monolith and the bundles block). */
const BUNDLE_OFFER = 'button[aria-pressed].w-full.justify-between.rounded-xl.p-3';

function bundleOfferButtons(root: HTMLElement): HTMLButtonElement[] {
  return Array.from(root.querySelectorAll<HTMLButtonElement>(BUNDLE_OFFER));
}

/** Colour palette swatch groups of the personalization form (repeater pieces). */
function paletteGroups(root: HTMLElement): HTMLElement[] {
  const groups = new Set<HTMLElement>();
  root.querySelectorAll<HTMLButtonElement>('button[aria-pressed]').forEach((b) => {
    if (b.matches(BUNDLE_OFFER)) return;
    const group = b.parentElement?.parentElement;
    if (group) groups.add(group);
  });
  return Array.from(groups);
}

type OptionConfig = NonNullable<ProductData['variant_option_config']>[number];

/** The VariantSelector group of one option (its label paragraph's parent). */
function optionGroup(root: HTMLElement, key: string): HTMLElement | null {
  const label = Array.from(root.querySelectorAll('p.text-sm.font-semibold.text-gray-900.mb-3')).find(
    (p) => p.firstChild?.textContent === key,
  );
  return (label?.parentElement as HTMLElement | null) ?? null;
}

function pickOption(root: HTMLElement, key: string, value: string, cfg: OptionConfig | undefined): boolean {
  const group = optionGroup(root, key);
  if (!group) return false;
  const label = group.querySelector('p.mb-3');
  // Already picked (the label shows "— value"): a second click would take it off.
  if (label?.textContent === `${key}— ${value}`) return true;
  const meta = (cfg?.valueMeta?.[value] ?? {}) as { label?: string };
  const cardLabel = meta.label ?? value;
  const buttons = Array.from(group.querySelectorAll('button'));
  const target =
    buttons.find((b) => b.getAttribute('role') === 'radio' && Array.from(b.querySelectorAll('span')).some((s) => s.textContent === cardLabel)) ??
    buttons.find((b) => b.getAttribute('title') === value) ??
    buttons.find((b) => b.textContent?.trim() === value);
  if (!target || target.disabled) return false;
  act(() => {
    fireEvent.click(target);
  });
  return true;
}

function combosFor(product: ProductData): Record<string, string>[] {
  const buyable = (product.variants ?? []).filter((v) => v.is_active !== false && v.stock > 0);
  if (buyable.length === 0) return [{}];
  const n = buyable.length;
  const idx = Array.from(new Set([0, Math.floor(n / 3), Math.floor((2 * n) / 3), n - 1])).slice(0, COMBO_CAP);
  return idx.map((i) => buyable[i].options);
}

async function settle() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

/** Text inputs of the personalization forms (in DOM order). */
function textInputs(root: HTMLElement): (HTMLInputElement | HTMLTextAreaElement)[] {
  return Array.from(root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input[type="text"], input:not([type]), textarea')).filter(
    (el) => !el.disabled && !el.readOnly,
  );
}

async function drive(root: HTMLElement, product: ProductData, combo: Record<string, string>): Promise<Snapshot[]> {
  const steps: Snapshot[] = [snapshot(root, 'initial')];
  const configs = product.variant_option_config ?? [];
  const keys = [
    ...configs.map((c) => c.name).filter((k) => k in combo),
    ...Object.keys(combo).filter((k) => !configs.some((c) => c.name === k)),
  ];
  for (const key of keys) {
    const ok = pickOption(root, key, combo[key], configs.find((c) => c.name === key));
    steps.push(snapshot(root, `pick ${key}=${combo[key]} (${ok ? 'clicked' : 'missing'})`));
  }

  // Quantity +1.
  const plus = root.querySelector<HTMLButtonElement>('button[aria-label="increaseQuantity"]');
  if (plus && !plus.disabled) {
    act(() => {
      fireEvent.click(plus);
    });
  }
  steps.push(snapshot(root, 'quantity +1'));

  // Every bundle offer in turn, then the first one stays picked.
  const offers = () => bundleOfferButtons(root);
  const offerCount = offers().length;
  for (let i = 0; i < offerCount; i++) {
    act(() => {
      fireEvent.click(offers()[i]);
    });
    steps.push(snapshot(root, `bundle offer ${i}`));
    if (i === offerCount - 1 && offerCount > 1) {
      act(() => {
        fireEvent.click(offers()[0]);
      });
      steps.push(snapshot(root, 'bundle offer 0 again'));
    }
  }

  // Add before filling anything: the same validation result (or line).
  const button = addButton(root);
  if (button && !button.disabled) {
    act(() => {
      fireEvent.click(button);
    });
    await settle();
  }
  steps.push(snapshot(root, 'add before filling fields'));

  // Fill every personalization text field, then add again.
  const inputs = textInputs(root);
  inputs.forEach((el, i) => {
    act(() => {
      fireEvent.change(el, { target: { value: `Alva${i + 1}` } });
    });
  });
  steps.push(snapshot(root, `filled ${inputs.length} text fields`));
  // Pick a colour in every palette (piece 2..N of a multi-piece product), a different one per piece.
  const palettes = paletteGroups(root);
  palettes.forEach((group, i) => {
    const swatches = Array.from(group.querySelectorAll<HTMLButtonElement>('button[aria-pressed]'));
    const swatch = swatches[(i + 1) % swatches.length];
    if (swatch && swatch.getAttribute('aria-pressed') !== 'true') {
      act(() => {
        fireEvent.click(swatch);
      });
    }
  });
  steps.push(snapshot(root, `picked ${palettes.length} palette colours`));
  // The "added" confirmation may still show; the button stays clickable.
  const again = addButton(root);
  if (again && !again.disabled) {
    act(() => {
      fireEvent.click(again);
    });
    await settle();
  }
  steps.push(snapshot(root, 'add after filling fields'));
  return steps;
}

async function run(renderer: (p: ProductData) => ReturnType<typeof render>, product: ProductData, combo: Record<string, string>) {
  addItem.mockClear();
  const { container } = renderer(product);
  await settle();
  const steps = await drive(container, product, combo);
  cleanup();
  return steps;
}

// ── Tests ────────────────────────────────────────────────

beforeEach(() => {
  addItem.mockClear();
  // jsdom has no scrollIntoView (the gallery scrolls its active thumbnail).
  Element.prototype.scrollIntoView = () => undefined;
});

describe('product page parity: monolith vs Classic block composition', () => {
  for (const [name, product] of Object.entries(FIXTURES)) {
    describe(name, () => {
      const combos = combosFor(product);
      combos.forEach((combo, i) => {
        const label = Object.entries(combo).map(([k, v]) => `${k}=${v}`).join(', ') || 'no options';
        it(`combo ${i + 1}: ${label}`, async () => {
          const monolith = await run(renderMonolith, product, combo);
          const blocks = await run(renderClassicBlocks, product, combo);
          // Sanity: the monolith really showed a price and an add button,
          // every option value was found and clicked, and the filled form
          // added a cart line (the parity below is not vacuous).
          expect(monolith[0].price).toBeTruthy();
          expect(monolith[0].addEnabled).not.toBeNull();
          expect(monolith.filter((s) => s.step.includes('(missing)')).map((s) => s.step)).toEqual([]);
          expect(monolith[monolith.length - 1].addedLines.length).toBeGreaterThan(0);
          expect(blocks).toEqual(monolith);
        });
      });
    });
  }

  it('drives real picks and real cart lines (the parity above is not vacuous)', async () => {
    // Bottle: picking an animal surfaces its imageMap / variant image as the lead
    // and a filled name adds a line with the variant, unit price and fields.
    const bottle = FIXTURES['imagemap-multi-piece-bottle'];
    const [combo] = combosFor(bottle);
    const steps = await run(renderClassicBlocks, bottle, combo);
    const byStep = (s: string) => steps.find((x) => x.step.startsWith(s))!;
    expect(steps.every((s) => !s.step.includes('(missing)'))).toBe(true);
    expect(byStep('initial').leadImage).not.toBe(byStep('pick Djur').leadImage);
    expect(byStep('initial').addEnabled).toBe(false);
    expect(byStep('initial').selectOptionsHint).toBe(true);
    const last = steps[steps.length - 1];
    expect(last.addedLines.length).toBeGreaterThan(0);
    const [productId, variantId, qty, , meta] = last.addedLines[last.addedLines.length - 1] as [string, string, number, unknown, Record<string, unknown>];
    expect(productId).toBe(bottle.id);
    expect(variantId).toBe(bottle.variants!.find((v) => v.options.Djur === combo.Djur && v.options.Antal === combo.Antal)!.id);
    expect(qty).toBe(2);
    expect(meta.price).toBe(bottle.variants!.find((v) => v.id === variantId)!.price);

    // Before-variants fields sit above the option picker in both renders
    // (the Classic split: personalization 'before_variants' | variants |
    // personalization 'after_variants').
    const before = FIXTURES['before-variants-fields-cards'];
    const order = (await run(renderClassicBlocks, before, combosFor(before)[0]))[0].formOrder;
    expect(order[0]).toBe('F');
    expect(order.some((t) => t.startsWith('O:'))).toBe(true);

    // Bundles: offer 0 (2 × −10 %) forces quantity 2 and shows a bundle chip.
    const bundled = FIXTURES['derived-bundles-sku'];
    const bSteps = await run(renderMonolith, bundled, combosFor(bundled)[0]);
    const offer0 = bSteps.find((s) => s.step === 'bundle offer 0')!;
    expect(offer0.bundleChip).toBe('Köp 2');
    expect(offer0.compareAt).not.toBeNull();
    expect(offer0.sku).toMatch(/^SKU: NAMN-3D-/);
  });
});
