// JSON-LD structured-data builders for the storefront. Each function returns a
// schema.org object that can be serialised into a <script type="application/ld+json">
// tag. Keep them pure — no fetching, no React — so they're cheap to call from
// any server component.

interface OrganizationInput {
  name: string;
  url: string;
  logo?: string;
  description?: string;
  sameAs?: string[];
  email?: string;
  phone?: string;
}

export function buildOrganization(input: OrganizationInput) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: input.name,
    url: input.url,
    ...(input.logo ? { logo: input.logo } : {}),
    ...(input.description ? { description: input.description } : {}),
    ...(input.sameAs?.length ? { sameAs: input.sameAs } : {}),
    ...(input.email || input.phone
      ? {
          contactPoint: {
            '@type': 'ContactPoint',
            ...(input.email ? { email: input.email } : {}),
            ...(input.phone ? { telephone: input.phone } : {}),
            contactType: 'customer service',
          },
        }
      : {}),
  };
}

interface WebSiteInput {
  name: string;
  url: string;
  /** Optional search URL template (e.g. https://shop.example/?q={search_term_string}). */
  searchUrlTemplate?: string;
}

export function buildWebSite(input: WebSiteInput) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: input.name,
    url: input.url,
    ...(input.searchUrlTemplate
      ? {
          potentialAction: {
            '@type': 'SearchAction',
            target: input.searchUrlTemplate,
            'query-input': 'required name=search_term_string',
          },
        }
      : {}),
  };
}

interface ProductInput {
  name: string;
  description?: string;
  url: string;
  images: string[];
  sku?: string;
  brand?: string;
  price: number;
  priceCurrency: string;
  availability?: 'InStock' | 'OutOfStock' | 'PreOrder';
  aggregateRating?: { ratingValue: number; reviewCount: number };
}

export function buildProduct(input: ProductInput) {
  const availability = input.availability || 'InStock';
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: input.name,
    ...(input.description ? { description: input.description } : {}),
    ...(input.images.length ? { image: input.images } : {}),
    ...(input.sku ? { sku: input.sku } : {}),
    ...(input.brand ? { brand: { '@type': 'Brand', name: input.brand } } : {}),
    offers: {
      '@type': 'Offer',
      url: input.url,
      price: input.price.toFixed(2),
      priceCurrency: input.priceCurrency,
      availability: `https://schema.org/${availability}`,
    },
    ...(input.aggregateRating
      ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: input.aggregateRating.ratingValue,
            reviewCount: input.aggregateRating.reviewCount,
          },
        }
      : {}),
  };
}

/**
 * A listing page (a collection, or the catalogue) described as a CollectionPage
 * whose mainEntity is the ordered list of products on it. This tells search
 * engines the page IS a product listing rather than leaving them to infer it
 * from markup, and is what makes listing pages eligible for list-style results.
 *
 * Only the items actually rendered on the page belong here — a list that
 * disagrees with the visible content is a structured-data violation.
 */
export function buildCollectionPage(input: {
  name: string;
  description?: string;
  url: string;
  items: { name: string; url: string; image?: string }[];
}) {
  if (!input.items.length) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: input.name,
    ...(input.description ? { description: input.description } : {}),
    url: input.url,
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: input.items.length,
      itemListElement: input.items.map((item, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: item.name,
        url: item.url,
        ...(item.image ? { image: item.image } : {}),
      })),
    },
  };
}

interface BreadcrumbItem {
  name: string;
  url: string;
}

export function buildBreadcrumb(items: BreadcrumbItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

interface FaqItem {
  question: string;
  answer: string;
}

export function buildFaqPage(items: FaqItem[]) {
  if (!items.length) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((q) => ({
      '@type': 'Question',
      name: q.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: q.answer,
      },
    })),
  };
}

/**
 * Twitter card metadata for a page.
 *
 * The builder's SEO dialog has always collected and saved a `twitter_card`
 * choice, but no Twitter tag was ever emitted anywhere in the storefront — the
 * setting looked applied and did nothing. Falls back to the page's OG title,
 * description and image, which is what a card should mirror anyway.
 */
export function buildTwitterMeta(opts: {
  card?: string;
  title?: string;
  description?: string;
  image?: string;
}): {
  card: 'summary' | 'summary_large_image';
  title?: string;
  description?: string;
  images?: string[];
} | undefined {
  const { card, title, description, image } = opts;
  if (!title && !description && !image) return undefined;
  return {
    // Only the two types the editor offers; anything else (or nothing) gets
    // the large-image card, which is the better default for a shop.
    card: card === 'summary' ? 'summary' : 'summary_large_image',
    title: title || undefined,
    description: description || undefined,
    images: image ? [image] : undefined,
  };
}

/**
 * Safely embed a JSON-LD object inside a <script> tag. Escaping `</` prevents a
 * stray `</script>` inside user-supplied content from breaking out of the tag.
 */
export function ldJsonSafe(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}
