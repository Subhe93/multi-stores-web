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
 * Safely embed a JSON-LD object inside a <script> tag. Escaping `</` prevents a
 * stray `</script>` inside user-supplied content from breaking out of the tag.
 */
export function ldJsonSafe(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}
