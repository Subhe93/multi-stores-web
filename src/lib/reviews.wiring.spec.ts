import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { proxy } from '../proxy';
import { __resetRedirectCaches } from './redirects';
import { focusRedirectTarget, focusRouteKind, focusedProductSections } from './focusedStorefront';
import { normalizeCheckoutSettings } from './checkoutSettings';
import { rendersProductPageSection } from '@/themes/minimal/sections/product/blocks/productBlockKeys';

// M171 wiring that a pure-function spec cannot see: where the reviews block
// is rendered on a template page, that the write page is reachable (proxy,
// focused storefront), and the rules the product route must keep (checked on
// its source, like the M170 variant guard: the route is a server component
// with many reads).

const SRC = join(__dirname, '..');
const read = (rel: string) => readFileSync(join(SRC, rel), 'utf8').replace(/\r\n/g, '\n');

describe('rendersProductPageSection: the block is on a template page exactly once', () => {
  it('monolith template: inline (inside ProductDetailClient)', () => {
    expect(rendersProductPageSection([{ section_key: 'product-page' }])).toBe(true);
    expect(rendersProductPageSection([{ section_key: 'rich-text' }, { section_key: 'product-page' }])).toBe(true);
  });

  it('block template: appended by the route', () => {
    expect(
      rendersProductPageSection([
        { section_key: 'product-gallery' },
        { section_key: 'product-title' },
        { section_key: 'product-buy' },
      ]),
    ).toBe(false);
    expect(rendersProductPageSection([])).toBe(false);
  });

  it('a hidden monolith does not count', () => {
    expect(rendersProductPageSection([{ section_key: 'product-page', is_hidden: true }])).toBe(false);
  });

  it('nested: reached through visible containers only', () => {
    const tree = (rowHidden: boolean) => [
      { id: 'row', section_key: 'layout-row', is_hidden: rowHidden },
      { id: 'col', section_key: 'layout-column', parent_id: 'row' },
      { id: 'pp', section_key: 'product-page', parent_id: 'col' },
    ];
    expect(rendersProductPageSection(tree(false))).toBe(true);
    expect(rendersProductPageSection(tree(true))).toBe(false);
  });

  it('missing parent, non-container parent or a cycle: not rendered, so appended', () => {
    expect(rendersProductPageSection([{ id: 'pp', section_key: 'product-page', parent_id: 'gone' }])).toBe(false);
    expect(
      rendersProductPageSection([
        { id: 't', section_key: 'rich-text' },
        { id: 'pp', section_key: 'product-page', parent_id: 't' },
      ]),
    ).toBe(false);
    expect(
      rendersProductPageSection([
        { id: 'a', section_key: 'layout-row', parent_id: 'c' },
        { id: 'c', section_key: 'layout-column', parent_id: 'a' },
        { id: 'pp', section_key: 'product-page', parent_id: 'c' },
      ]),
    ).toBe(false);
  });

  it('a focused storefront keeps the monolith in its filtered sections', () => {
    const sections = [{ section_key: 'product-page' }, { section_key: 'product-slider' }];
    expect(rendersProductPageSection(focusedProductSections(sections))).toBe(true);
  });
});

describe('/reviews/write is reachable', () => {
  const focused = normalizeCheckoutSettings({ external_site_url: 'https://mollstrands.example/', external_focus: true });

  it('focused storefront: never redirected to the external site', () => {
    for (const path of ['/reviews/write', '/reviews/write?product=abc', '/reviews/write/']) {
      expect(focusRouteKind(path), path).toBe('keep');
      expect(focusRedirectTarget({ settings: focused, path, requestHost: 'shop.example', gate: 'live' }), path).toBeNull();
    }
    // Sanity: the same store does redirect its browsing pages.
    expect(focusRedirectTarget({ settings: focused, path: '/', requestHost: 'shop.example', gate: 'live' })).toBe(
      'https://mollstrands.example/',
    );
  });

  describe('proxy', () => {
    const json = (data: unknown) =>
      new Response(JSON.stringify({ success: true, data }), { status: 200, headers: { 'content-type': 'application/json' } });
    let fetchMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      __resetRedirectCaches();
      fetchMock = vi.fn(async () => json({ enabled: false }));
      vi.stubGlobal('fetch', fetchMock);
    });
    afterEach(() => vi.unstubAllGlobals());

    it('rewrites the store host path to the store route, query kept, no redirect', async () => {
      const host = 'reviews-a.localhost:3000';
      const res = await proxy(new NextRequest(`http://${host}/reviews/write?product=p1`, { headers: { host } }));
      const rewrite = res.headers.get('x-middleware-rewrite') ?? '';
      expect(rewrite).toContain('/store/reviews-a/reviews/write');
      expect(rewrite).toContain('product=p1');
      expect(res.headers.get('location')).toBeNull();
    });
  });
});

describe('product route: reviews wiring', () => {
  const page = read('app/store/[storeSlug]/products/[slug]/page.tsx');
  const bodyStart = page.indexOf('export default async function StoreProductDetailPage');
  const metadata = page.slice(page.indexOf('export async function generateMetadata'), bodyStart);
  const body = page.slice(bodyStart);

  it('the source has both parts', () => {
    expect(bodyStart).toBeGreaterThan(0);
    expect(metadata.length).toBeGreaterThan(0);
  });

  it('metadata never reads reviews: canonical, hreflang and titles are those of the base page', () => {
    expect(metadata).not.toMatch(/reviews_page|getProductReviews|loadProductReviews|isAppEnabled/);
  });

  it('one read, only behind the app switch, on the cached list options', () => {
    expect(body.match(/getProductReviews\(/g) ?? []).toHaveLength(1);
    expect(body).toContain("const reviewsOn = isAppEnabled(storeData, 'reviews');");
    expect(body).toMatch(/reviewsOn\s*\?\s*loadProductReviews\(/);
    expect(body).toContain('reviewsPageFromQuery(query.reviews_page)');
    // The reviews read carries no market and no locale: shared by all markets.
    const call = body.slice(body.indexOf('storefront.getProductReviews('), body.indexOf('reviewsPageFromQuery('));
    expect(call).not.toMatch(/marketKey|locale/);
    const api = read('lib/api.ts');
    const fn = api.slice(api.indexOf('getProductReviews:'), api.indexOf('getCategories:'));
    expect(fn).toContain('await storefrontOpts(slug)');
    expect(fn).not.toContain('productReadOpts');
    expect(fn).not.toContain('marketQuery');
  });

  it('the redirect runs before any review markup, and reviews can never 404 the page', () => {
    expect(body.indexOf('permanentRedirect(')).toBeLessThan(body.indexOf('const withProductReviews'));
    const calls = [...body.matchAll(/notFound\(\)/g)];
    expect(calls).toHaveLength(1);
  });

  it('markup and block hang on one value: JSON-LD, the three paths and the appended block', () => {
    // JSON-LD: spread only when there are reviews (no key otherwise).
    expect(body).toContain('...(reviews ? { reviews } : null),');
    expect(body.match(/buildProductJsonLd\(/g) ?? []).toHaveLength(1);
    // Every client product goes through the same helper.
    expect(body.match(/withProductReviews\(projectProductForClient\(/g) ?? []).toHaveLength(3);
    expect(body.match(/projectProductForClient\(/g) ?? []).toHaveLength(3);
    expect(body).toContain("rendersProductPageSection(templateSections) ? 'inline' : 'append'");
    expect(body.match(/<ProductReviews /g) ?? []).toHaveLength(1);
    expect(body).toContain('{appendedReviews && (');
  });

  it('M170 wiring is untouched', () => {
    expect(body.match(/\bsyncVariantUrl\b/g) ?? []).toHaveLength(3);
    expect(body.match(/\{\.\.\.variantProps\}/g) ?? []).toHaveLength(3);
    expect(body).toContain('canonicalRedirectHref(`/products/${redirectSlug}`, query, pathPrefix)');
  });
});

describe('write page', () => {
  const page = read('app/store/[storeSlug]/reviews/write/page.tsx');

  it('is never indexable, sends no Referer, and does not exist while the app is off', () => {
    expect(page).toContain('robots: { index: false, follow: false }');
    expect(page).toContain("referrer: 'no-referrer'");
    expect(page).toContain("if (!isAppEnabled(store, 'reviews')) notFound();");
  });

  it('the token never touches storage, a cookie or a URL', () => {
    const client = read('components/product/reviews/ReviewWriteClient.tsx');
    const api = read('lib/reviewsApi.ts');
    expect(client).not.toMatch(/localStorage|sessionStorage|document\.cookie/);
    expect(api).not.toMatch(/localStorage|sessionStorage|document\.cookie/);
    // Only in JSON bodies.
    expect(api).toContain("body: JSON.stringify({ token: linkToken })");
    expect(api).not.toMatch(/\?token=|\/\$\{linkToken\}|\$\{fields\.token\}/);
  });
});

describe('store layouts: review texts only for stores with the app on', () => {
  it('both client providers go through reviewsClientMessages', () => {
    const layout = read('app/store/[storeSlug]/layout.tsx');
    expect(layout).toContain('reviewsClientMessages(clientMessages(messages), Boolean(storeApps.reviews))');
    expect(layout).toContain('reviewsClientMessages(clientMessages(await getMessages()), false)');
    expect(layout.match(/messages=\{/g) ?? []).toHaveLength(2);
    const checkout = read('app/store/[storeSlug]/(checkout)/layout.tsx');
    expect(checkout).toContain('reviewsClientMessages(clientMessages(messages), false)');
    expect(checkout.match(/messages=\{/g) ?? []).toHaveLength(1);
  });

  it('platform pages (landing, legal, auth) never ship the review texts', () => {
    const layout = read('app/[locale]/layout.tsx');
    expect(layout).toContain('messages={reviewsClientMessages(messages, false)}');
    expect(layout.match(/messages=\{/g) ?? []).toHaveLength(1);
  });
});
