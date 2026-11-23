// Product structured data of the product page (M161 B4-B6): one builder for
// the three render paths (focused, template, default).
//  - no / one active variant: a Product with one Offer (the previous shape
//    plus url, seller and shippingDetails);
//  - 2..100 active variants: a ProductGroup with one Product per variant
//    (its own price, sku, availability and image, else the gallery's first);
//  - more than 100: a Product with an AggregateOffer (bounded payload).
// Pure: no fetching, no React.

import { buildProduct, ldRef } from './jsonld';
import { stripHtmlToText } from './htmlText';
import { labelsForLocale, optionNameLabel, optionValueLabel, type LabelRow } from './variantOptionLabels';
import { productAvailability } from './productAvailability';
import { requestCountry } from './storeOpenGraph';
import type { PathMarket } from './localePaths';

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

/** OfferShippingDetails list; empty for a product that does not ship. */
export function shippingDetailsLd(shipping: ProductShippingRates | null | undefined): object[] {
  if (!shipping || shipping.requires_shipping === false || !Array.isArray(shipping.rates)) return [];
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
      // Only a total delivery estimate exists: it goes into transitTime and
      // handlingTime is left out (not invented).
      deliveryTime: {
        '@type': 'ShippingDeliveryTime',
        transitTime: { '@type': 'QuantitativeValue', minValue: min, maxValue: max, unitCode: 'DAY' },
      },
    });
  }
  return out;
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
        url: canonical,
        price: Number(v.price).toFixed(2),
        priceCurrency: input.currency,
        availability: availabilityUrl(v.stock),
        ...(input.sellerId ? { seller: ldRef(input.sellerId) } : {}),
        ...(shippingDetails.length ? { shippingDetails } : {}),
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
