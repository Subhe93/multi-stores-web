// Product structured data of the product page (M161 B4-B6): one builder for
// the three render paths (focused, template, default).
//  - no / one active variant: a Product with one Offer (the previous shape
//    plus url, seller and shippingDetails);
//  - every Offer (single or per variant) also carries the store's own handling
//    time and return policy when the owner configured them (M170 C); nothing
//    is emitted otherwise;
//  - 2..100 active variants: a ProductGroup with one Product per variant
//    (its own price, sku, availability and image, else the gallery's first;
//    its offer url preselects it: `<canonical>?variant=<id>`, M170 B);
//  - more than 100: a Product with an AggregateOffer (bounded payload).
// Pure: no fetching, no React.

import { buildProduct, ldRef } from './jsonld';
import { stripHtmlToText } from './htmlText';
import { labelsForLocale, optionNameLabel, optionValueLabel, type LabelRow } from './variantOptionLabels';
import { productAvailability } from './productAvailability';
import { requestCountry } from './storeOpenGraph';
import type { PathMarket } from './localePaths';
import { variantUrl } from './variantParam';

/**
 * Destination countries of the shipping-rates read (M161 B6): the country of
 * the request's language-country path (`/de-at` → AT), else the market's
 * countries (at most 10), else the store's home country. Empty = no read.
 */
export function shippingRateCountries(
  market: Partial<PathMarket> | null | undefined,
  pathPrefix: string | undefined,
  homeCountry: string | null | undefined,
): string[] {
  const valid = (c: unknown): c is string => typeof c === 'string' && /^[A-Za-z]{2}$/.test(c);
  if (market) {
    if (pathPrefix) {
      const slot = requestCountry(market, pathPrefix);
      if (slot) return [slot];
    }
    const list = Array.from(new Set((market.countries ?? []).filter(valid).map((c) => c.toUpperCase())));
    if (list.length) return list.slice(0, 10);
  }
  return valid(homeCountry) ? [homeCountry.toUpperCase()] : [];
}

/** Above this many active variants the group becomes an AggregateOffer. */
export const MAX_LD_VARIANTS = 100;

export interface ProductShippingRate {
  country: string;
  cost: number;
  min_days: number | null;
  max_days: number | null;
}

/** `GET /storefront/:slug/products/:productSlug/shipping-rates` (M161 B6). */
export interface ProductShippingRates {
  requires_shipping: boolean;
  currency: string;
  rates: ProductShippingRate[];
  /** M170 C: business days before hand-over; only when the store set it. */
  handling_days?: { min: number; max: number } | null;
  /** M170 C: return policies covering the requested countries. */
  return_policies?: ProductReturnPolicy[] | null;
}

/** One store return policy, narrowed to the page's countries (M170 C). */
export interface ProductReturnPolicy {
  countries: string[];
  category: 'finite' | 'unlimited' | 'none';
  days?: number;
  methods?: ('mail' | 'store' | 'kiosk')[];
  fees?: 'free' | 'customer' | 'fixed';
  /** In the response currency. */
  fee_amount?: number;
}

export interface LdVariant {
  id: string;
  sku?: string | null;
  price: number;
  stock?: number | null;
  options?: Record<string, string> | null;
  is_active?: boolean;
  images?: { url: string }[] | null;
}

export interface LdProduct {
  id: string;
  sku?: string | null;
  base_price: number;
  track_inventory?: boolean | null;
  stock_quantity?: number | null;
  variants?: LdVariant[] | null;
  variant_option_config?: { name: string; imageMap?: Record<string, string> }[] | null;
  translations?: readonly LabelRow[] | null;
}

export interface ProductJsonLdInput {
  product: LdProduct;
  name: string;
  /** Rich-text description HTML of the rendered locale. */
  descriptionHtml?: string | null;
  locale: string;
  /** The page canonical (productAlternates): url, offers.url. */
  canonical: string;
  /** Absolute image URLs of the product gallery. */
  images: string[];
  brand?: string;
  /** Organization `@id` (offers.seller). */
  sellerId?: string;
  currency: string;
  shipping?: ProductShippingRates | null;
  videos?: object[];
  /** Makes media URLs absolute (resolveMediaUrl). */
  resolveMedia: (url: string) => string;
}

// Option name synonyms (keys and localized names, lower-cased) of the
// schema.org properties Google reads for variants.
const PROPERTY_SYNONYMS: Record<'color' | 'size' | 'material' | 'pattern', string[]> = {
  color: ['color', 'colour', 'färg', 'farbe', 'couleur', 'renk', 'لون'],
  size: ['size', 'storlek', 'größe', 'grösse', 'taille', 'beden', 'مقاس', 'حجم'],
  material: ['material', 'matériau', 'malzeme', 'خامة'],
  pattern: ['pattern', 'mönster', 'muster', 'motif', 'desen'],
};

type MappedProperty = keyof typeof PROPERTY_SYNONYMS;

/** The schema.org property an option maps to, or null (additionalProperty). */
export function optionProperty(key: string, localizedName?: string | null): MappedProperty | null {
  const candidates = [key, localizedName ?? ''].map((s) => s.trim().toLowerCase()).filter(Boolean);
  for (const [prop, words] of Object.entries(PROPERTY_SYNONYMS) as [MappedProperty, string[]][]) {
    if (candidates.some((c) => words.includes(c))) return prop;
  }
  return null;
}

/**
 * The store's handling time as a QuantitativeValue (M170 C), or undefined
 * when it is not configured or not a valid range (never repaired).
 */
function handlingTimeLd(shipping: ProductShippingRates): object | undefined {
  const h = shipping.handling_days;
  if (!h || typeof h !== 'object') return undefined;
  const { min, max } = h;
  if (!Number.isInteger(min) || !Number.isInteger(max) || min < 0 || max < min) return undefined;
  return { '@type': 'QuantitativeValue', minValue: min, maxValue: max, unitCode: 'DAY' };
}

/** OfferShippingDetails list; empty for a product that does not ship. */
export function shippingDetailsLd(shipping: ProductShippingRates | null | undefined): object[] {
  if (!shipping || shipping.requires_shipping === false || !Array.isArray(shipping.rates)) return [];
  const handlingTime = handlingTimeLd(shipping);
  const out: object[] = [];
  for (const r of shipping.rates) {
    if (!r || typeof r.country !== 'string' || !Number.isFinite(Number(r.cost))) continue;
    const min = r.min_days ?? r.max_days;
    const max = r.max_days ?? r.min_days;
    // Google requires deliveryTime for eligible shipping details; a rate
    // without a delivery estimate (no shipping profile) is left out rather
    // than given invented days.
    if (min == null || max == null) continue;
    out.push({
      '@type': 'OfferShippingDetails',
      shippingRate: { '@type': 'MonetaryAmount', value: Number(r.cost), currency: shipping.currency },
      shippingDestination: { '@type': 'DefinedRegion', addressCountry: r.country },
      // The shipping method's delivery estimate goes into transitTime.
      // handlingTime is the store's own setting (M170 C) and is left out
      // when the owner has not configured it (never invented).
      deliveryTime: {
        '@type': 'ShippingDeliveryTime',
        ...(handlingTime ? { handlingTime } : {}),
        transitTime: { '@type': 'QuantitativeValue', minValue: min, maxValue: max, unitCode: 'DAY' },
      },
    });
  }
  return out;
}

const RETURN_CATEGORY: Record<ProductReturnPolicy['category'], string> = {
  finite: 'MerchantReturnFiniteReturnWindow',
  unlimited: 'MerchantReturnUnlimitedWindow',
  none: 'MerchantReturnNotPermitted',
};
const RETURN_METHOD: Record<NonNullable<ProductReturnPolicy['methods']>[number], string> = {
  mail: 'ReturnByMail',
  store: 'ReturnInStore',
  kiosk: 'ReturnAtKiosk',
};
const RETURN_FEES: Record<NonNullable<ProductReturnPolicy['fees']>, string> = {
  free: 'FreeReturn',
  customer: 'ReturnFeesCustomerResponsibility',
  fixed: 'ReturnShippingFees',
};
const schemaUrl = (name: string) => `https://schema.org/${name}`;
const own = (map: object, key: unknown): key is string => typeof key === 'string' && Object.hasOwn(map, key);
/** A one-item list is emitted as its single value. */
const oneOrMany = <T,>(list: T[]): T | T[] => (list.length === 1 ? list[0] : list);

/** One MerchantReturnPolicy, or null for an entry that is not well-formed. */
function returnPolicyEntryLd(p: ProductReturnPolicy, currency: string): object | null {
  if (!p || typeof p !== 'object' || !own(RETURN_CATEGORY, p.category)) return null;
  if (!Array.isArray(p.countries)) return null;
  const countries = p.countries.filter((c) => typeof c === 'string' && /^[A-Z]{2}$/.test(c));
  // Google reads at most 50 countries; a broken or oversized list is skipped.
  if (countries.length === 0 || countries.length !== p.countries.length || countries.length > 50) return null;

  const finite = p.category === 'finite';
  if (finite ? !(Number.isInteger(p.days) && (p.days as number) > 0) : p.days != null) return null;

  const out: Record<string, unknown> = {
    '@type': 'MerchantReturnPolicy',
    applicableCountry: oneOrMany(countries),
    returnPolicyCategory: schemaUrl(RETURN_CATEGORY[p.category]),
    ...(finite ? { merchantReturnDays: p.days } : {}),
  };
  // "No returns" states neither a method nor fees.
  if (p.category === 'none') return p.methods?.length || p.fees != null || p.fee_amount != null ? null : out;

  if (p.methods != null) {
    if (!Array.isArray(p.methods) || !p.methods.every((m) => own(RETURN_METHOD, m))) return null;
    if (p.methods.length) out.returnMethod = oneOrMany(p.methods.map((m) => schemaUrl(RETURN_METHOD[m])));
  }
  if (p.fees != null) {
    if (!own(RETURN_FEES, p.fees)) return null;
    out.returnFees = schemaUrl(RETURN_FEES[p.fees]);
  }
  if (p.fees === 'fixed') {
    // Google wants the amount only with ReturnShippingFees and non-zero.
    const amount = p.fee_amount;
    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0 || !currency) return null;
    out.returnShippingFeesAmount = { '@type': 'MonetaryAmount', value: amount, currency };
  } else if (p.fee_amount != null) {
    return null;
  }
  return out;
}

/**
 * `hasMerchantReturnPolicy` of an Offer (M170 C): one MerchantReturnPolicy
 * per store policy that covers the page's countries (an object for one, a
 * list for several). Undefined when the store configured none, none covers
 * the page, or the product does not ship. A malformed entry is skipped, never
 * repaired: no policy value is ever invented here.
 */
export function returnPolicyLd(shipping: ProductShippingRates | null | undefined): object | object[] | undefined {
  if (!shipping || shipping.requires_shipping === false || !Array.isArray(shipping.return_policies)) return undefined;
  const out: object[] = [];
  for (const p of shipping.return_policies) {
    const entry = returnPolicyEntryLd(p, shipping.currency);
    if (entry) out.push(entry);
  }
  return out.length ? oneOrMany(out) : undefined;
}

const availabilityUrl = (stock: number | null | undefined) =>
  `https://schema.org/${(stock ?? 1) > 0 ? 'InStock' : 'OutOfStock'}`;

function activeVariants(product: LdProduct): LdVariant[] {
  return (product.variants ?? []).filter((v) => v && v.is_active !== false && Number.isFinite(Number(v.price)));
}

export function buildProductJsonLd(input: ProductJsonLdInput): Record<string, unknown> {
  const { product, canonical } = input;
  const description = stripHtmlToText(input.descriptionHtml) || undefined;
  const sku = product.sku?.trim() || undefined;
  const shippingDetails = shippingDetailsLd(input.shipping);
  const returnPolicy = returnPolicyLd(input.shipping);
  const variants = activeVariants(product);

  // Simple product, or a single variant: one Offer as before.
  if (variants.length < 2) {
    return buildProduct({
      name: input.name,
      description,
      url: canonical,
      sku,
      brand: input.brand || undefined,
      images: input.images,
      price: Number(product.base_price),
      priceCurrency: input.currency,
      availability: productAvailability(product),
      videos: input.videos,
      sellerId: input.sellerId,
      shippingDetails,
      returnPolicy,
    });
  }

  // Too many variants for a group: one AggregateOffer.
  if (variants.length > MAX_LD_VARIANTS) {
    const prices = variants.map((v) => Number(v.price));
    return buildProduct({
      name: input.name,
      description,
      url: canonical,
      sku,
      brand: input.brand || undefined,
      images: input.images,
      price: Number(product.base_price),
      priceCurrency: input.currency,
      videos: input.videos,
      offers: {
        '@type': 'AggregateOffer',
        lowPrice: Math.min(...prices).toFixed(2),
        highPrice: Math.max(...prices).toFixed(2),
        offerCount: variants.length,
        priceCurrency: input.currency,
        availability: `https://schema.org/${productAvailability({ variants })}`,
      },
    });
  }

  const labels = labelsForLocale(product.translations ?? null, input.locale);
  const config = product.variant_option_config ?? [];
  const variesBy = new Set<MappedProperty>();

  const hasVariant = variants.map((v) => {
    const options = v.options && typeof v.options === 'object' ? v.options : {};
    const mapped: Partial<Record<MappedProperty, string>> = {};
    const extra: { '@type': 'PropertyValue'; name: string; value: string }[] = [];
    const valueLabels: string[] = [];
    for (const [key, value] of Object.entries(options)) {
      if (typeof value !== 'string' || !value) continue;
      const nameLabel = optionNameLabel(labels, key);
      const valueLabel = optionValueLabel(labels, key, value);
      valueLabels.push(valueLabel);
      const prop = optionProperty(key, nameLabel);
      if (prop && mapped[prop] === undefined) {
        mapped[prop] = valueLabel;
        variesBy.add(prop);
      } else {
        extra.push({ '@type': 'PropertyValue', name: nameLabel, value: valueLabel });
      }
    }
    // Variant image: its own, else the image of the first option value with one.
    let image: string | undefined = v.images?.[0]?.url || undefined;
    if (!image) {
      for (const [key, value] of Object.entries(options)) {
        const url = config.find((c) => c.name === key)?.imageMap?.[value];
        if (url) {
          image = url;
          break;
        }
      }
    }
    // Merchant listings require an image on every variant: without its own,
    // the product's first gallery image (already absolute).
    const variantImage = image ? input.resolveMedia(image) : input.images[0];
    const variantSku = v.sku?.trim() || undefined;
    return {
      '@type': 'Product',
      name: valueLabels.length ? `${input.name} – ${valueLabels.join(' / ')}` : input.name,
      ...(variantSku ? { sku: variantSku } : {}),
      ...(variantImage ? { image: variantImage } : {}),
      ...mapped,
      ...(extra.length ? { additionalProperty: extra } : {}),
      offers: {
        '@type': 'Offer',
        // M170 B: one distinct URL per variant (Google's single-page variant
        // model); the group's `url` stays the canonical.
        url: variantUrl(canonical, v.id),
        price: Number(v.price).toFixed(2),
        priceCurrency: input.currency,
        availability: availabilityUrl(v.stock),
        ...(input.sellerId ? { seller: ldRef(input.sellerId) } : {}),
        ...(shippingDetails.length ? { shippingDetails } : {}),
        ...(returnPolicy ? { hasMerchantReturnPolicy: returnPolicy } : {}),
      },
    };
  });

  return {
    '@context': 'https://schema.org',
    '@type': 'ProductGroup',
    '@id': `${canonical}#product`,
    name: input.name,
    ...(description ? { description } : {}),
    ...(input.images.length ? { image: input.images } : {}),
    url: canonical,
    ...(input.brand ? { brand: { '@type': 'Brand', name: input.brand } } : {}),
    productGroupID: sku || product.id,
    ...(variesBy.size ? { variesBy: [...variesBy].map((p) => `https://schema.org/${p}`) } : {}),
    hasVariant,
    ...(input.videos?.length ? { subjectOf: input.videos } : {}),
  };
}
