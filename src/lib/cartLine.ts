/**
 * Cart line metadata shared by the product page (`ProductDetailClient`) and
 * the theme's `AddToCartMagic` section (M5 D31): both build the same
 * `CartItemMetadata` from the same inputs, so a guest line looks identical
 * whichever surface added it. Pure, unit-tested.
 */
import type { CartCustomFieldDisplay, CartItemMetadata } from '@/hooks/useCart';
import type { GuestPersonalizationCheck } from '@/components/product/personalization/validateApi';

/** The bundle offer chosen on the product page (display texts already resolved). */
export interface LineBundle {
  offerId: string;
  /** Unit price before the bundle discount. */
  originalUnitPrice: number;
  title?: string | null;
  label?: string | null;
  stickerText?: string | null;
  /** Quantity the offer puts in the cart. */
  cartQuantity?: number | null;
}

/** What a product surface knows about the line it is about to add. */
export interface LineSource {
  title: string;
  /** Shown unit price (bundle-discounted when a bundle is chosen). */
  unitPrice: number;
  imageUrl?: string;
  /** Options of the resolved variant (`{Color: 'Red', Size: 'M'}`); empty = no variant label. */
  variantOptions?: Record<string, string> | null;
  currency?: string;
  /** b2b stores: the product's estimated rate, kept on guest lines (L8). */
  taxRateBp?: number | null;
  /** Custom products add themselves by `custom_product_id`. */
  customProductId?: string;
  bundle?: LineBundle | null;
  /** Legacy "customer upload" block: the uploaded file's preview URL. */
  customerFile?: string;
}

/** `"Color: Red / Size: M"` label of a variant's options ('' without options). */
export function variantLabel(options?: Record<string, string> | null): string {
  if (!options) return '';
  return Object.entries(options)
    .map(([k, v]) => `${k}: ${v}`)
    .join(' / ');
}

/**
 * The `CartItemMetadata` of a line. Optional keys are omitted (never set to
 * `undefined`) so the stored guest line keeps the exact shape it had before.
 */
export function buildLineMetadata(
  src: LineSource,
  extra?: {
    customFieldDisplay?: CartCustomFieldDisplay[];
    /** Personalization app (D14): guests validate on the server first. */
    personalizationCheck?: GuestPersonalizationCheck;
    /** Designer app (M4.2): the design replaces the field values. */
    design?: CartItemMetadata['design'];
  },
): CartItemMetadata {
  const variant = variantLabel(src.variantOptions);
  const bundle = src.bundle ?? null;
  return {
    title: src.title,
    price: src.unitPrice,
    ...(src.imageUrl ? { imageUrl: src.imageUrl } : {}),
    ...(variant ? { variant } : {}),
    ...(src.currency ? { currency: src.currency } : {}),
    ...(src.taxRateBp !== null && src.taxRateBp !== undefined ? { taxRateBp: src.taxRateBp } : {}),
    ...(src.customProductId ? { customProductId: src.customProductId } : {}),
    ...(src.customerFile ? { customerFile: src.customerFile } : {}),
    ...(bundle
      ? {
          bundleOfferId: bundle.offerId,
          bundleOriginalUnitPrice: bundle.originalUnitPrice,
          ...(bundle.title ? { bundleTitle: bundle.title } : {}),
          ...(bundle.label ? { bundleLabel: bundle.label } : {}),
          ...(bundle.stickerText ? { bundleStickerText: bundle.stickerText } : {}),
          ...(typeof bundle.cartQuantity === 'number' ? { bundleCartQuantity: bundle.cartQuantity } : {}),
        }
      : {}),
    ...(extra?.customFieldDisplay ? { customFieldDisplay: extra.customFieldDisplay } : {}),
    ...(extra?.personalizationCheck ? { personalizationCheck: extra.personalizationCheck } : {}),
    ...(extra?.design ? { design: extra.design } : {}),
  };
}
