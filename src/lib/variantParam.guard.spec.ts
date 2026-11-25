import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { productAlternates } from './productPaths';
import { variantFromQuery } from './variantParam';

// Variant URLs (M170 B): wiring rules of the product route that a pure-function
// spec cannot see. The route is a server component with many reads, so these
// are checked on its source:
//  - `?variant=` is read in the page body only, after the M164 redirect;
//  - it never reaches generateMetadata (canonical, hreflang, og:url, title and
//    description stay those of the base page) and never leads to notFound();
//  - only the product route turns the URL sync on.

const SRC = join(__dirname, '..');
const read = (rel: string) => readFileSync(join(SRC, rel), 'utf8').replace(/\r\n/g, '\n');

const page = read('app/store/[storeSlug]/products/[slug]/page.tsx');
const bodyStart = page.indexOf('export default async function StoreProductDetailPage');
const metadata = page.slice(page.indexOf('export async function generateMetadata'), bodyStart);
const body = page.slice(bodyStart);

describe('product route: ?variant= wiring', () => {
  it('the source has both parts', () => {
    expect(bodyStart).toBeGreaterThan(0);
    expect(metadata.length).toBeGreaterThan(0);
  });

  it('generateMetadata never reads the parameter', () => {
    expect(metadata).not.toMatch(/variant/i);
  });

  it('the page reads it once, after the canonical-slug redirect and from the rendered product', () => {
    const reads = body.match(/variantFromQuery\(/g) ?? [];
    expect(reads).toHaveLength(1);
    expect(body).toContain('variantFromQuery(query.variant, product.variants)');
    expect(body.indexOf('variantFromQuery(')).toBeGreaterThan(body.indexOf('permanentRedirect('));
  });

  it('an invalid value cannot 404: the only notFound() is the product read, before the parameter is looked at', () => {
    const calls = [...body.matchAll(/notFound\(\)/g)].map((m) => m.index ?? -1);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toBeLessThan(body.indexOf('variantFromQuery('));
    expect(variantFromQuery('zzz', [{ id: '3f6c1c1e-0b7e-4a57-9a53-2f1a8f1d2c11' }])).toBeUndefined();
  });

  it('the redirect keeps the whole query, and the markup is built from the canonical only', () => {
    expect(body).toContain('canonicalRedirectHref(`/products/${redirectSlug}`, query, pathPrefix)');
    expect(body).toContain('canonical: productCanonical,');
    // The JSON-LD builder gets no selection: the markup is the same for every variant URL.
    const ldCall = body.slice(body.indexOf('buildProductJsonLd({'), body.indexOf('resolveMedia: resolveMediaUrl'));
    expect(ldCall).not.toMatch(/variant/i);
  });

  it('all three render paths get the selection and the URL sync', () => {
    expect(body.match(/\bsyncVariantUrl\b/g) ?? []).toHaveLength(3);
    expect(body.match(/\{\.\.\.variantProps\}/g) ?? []).toHaveLength(3);
  });
});

describe('product canonical: no query on any market', () => {
  const translations = [
    { locale: 'sv', slug: 'dalahast' },
    { locale: 'de', slug: 'dalapferd' },
  ];

  it('default market and locale-path market', () => {
    const plain = productAlternates({
      storeSlug: 'anna',
      store: { custom_domain: 'anna.se', language_config: { primary_locale: 'sv', secondary_locales: ['de'] } },
      translations,
      slug: 'dalapferd',
      locale: 'de',
    });
    expect(plain.canonical).toBe('https://anna.se/de/products/dalapferd');
    for (const url of [plain.canonical, ...Object.values(plain.languages)]) {
      expect(url).not.toMatch(/[?#]/);
    }
  });
});

describe('provider users outside the product route never sync the URL', () => {
  it.each([
    'components/product/card/QuickAddDialog.client.tsx',
    'themes/BuilderPreviewClient.tsx',
    'app/dev/creative-demo/page.tsx',
  ])('%s', (rel) => {
    const src = read(rel);
    expect(src).toContain('ProductPageStateProvider');
    expect(src).not.toMatch(/syncVariantUrl|initialVariantId/);
  });
});
