import { existsSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import * as group from './productBlocks.client';
import { PRODUCT_BLOCK_KEYS, usesProductBlocks, usesProductPageMagic } from './productBlockKeys';

// The product blocks load from ONE grouped module (one async chunk group per
// page instead of one chunk per block), and the product route warms that
// chunk up only for templates that use it.

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (f: string) => readFileSync(path.join(here, f), 'utf8');

describe('grouped product-block chunk', () => {
  it('every lazy wrapper resolves through the shared loader, and the group exports what they read', () => {
    const sources = [read('lazyB1.tsx'), read('lazyB2.tsx'), read('lazyB3.tsx'), read('../lazy.tsx')].join('\n');
    const wrappers = Array.from(sources.matchAll(/export const (\w+) = dynamic\(\(\) =>\s*([^\r\n]+)/g));
    expect(wrappers.length).toBe(21);
    for (const [, name, body] of wrappers) {
      if (name === 'ProductPageMagic') {
        // The monolith keeps its own chunk, so its pages never fetch the blocks.
        expect(body).toBe('loadProductPageMagic().then((m) => m.ProductPageMagic));');
        continue;
      }
      expect(body, name).toBe(`loadProductBlocks().then((m) => m.${name}));`);
      expect(typeof (group as Record<string, unknown>)[name], name).toBe('function');
    }
    expect('ProductPageMagic' in group).toBe(false);
  });

  it('loader: one shared request, through the page import once the warm-up registered it', async () => {
    vi.resetModules();
    const loader = await import('./productBlocksLoader');
    const pageImport = vi.fn(() => Promise.resolve(group));
    loader.registerPageProductBlocksImport(pageImport);
    const [a, b] = await Promise.all([loader.loadProductBlocks(), loader.loadProductBlocks()]);
    expect(a).toBe(group);
    expect(b).toBe(group);
    expect(pageImport).toHaveBeenCalledTimes(1);
  });

  it('loader: falls back to its own import when the page import fails', async () => {
    vi.resetModules();
    const loader = await import('./productBlocksLoader');
    loader.registerPageProductBlocksImport(() => Promise.reject(new Error('chunk load failed')));
    const mod = await loader.loadProductBlocks();
    expect(typeof mod.ProductBuyBlock).toBe('function');
  });

  it('usesProductBlocks: block templates yes, the monolith product-page no, hidden sections ignored', () => {
    const namez = [
      'product-breadcrumb', 'layout-row', 'layout-column', 'product-gallery', 'product-title', 'product-price',
      'product-short-description', 'product-promotions', 'product-bundles', 'product-personalization',
      'product-variants', 'spacer', 'product-buy', 'product-trust', 'product-shipping', 'rich-text',
      'embed-code', 'product-tabs', 'product-slider',
    ].map((section_key) => ({ section_key }));
    expect(usesProductBlocks(namez)).toBe(true);
    expect(usesProductBlocks([{ section_key: 'product-page' }, { section_key: 'product-slider' }])).toBe(false);
    expect(usesProductBlocks([{ section_key: 'product-buy', is_hidden: true }])).toBe(false);
    expect(PRODUCT_BLOCK_KEYS.has('product-page')).toBe(false);
    expect(usesProductPageMagic([{ section_key: 'product-page' }])).toBe(true);
    expect(usesProductPageMagic(namez)).toBe(false);
    expect(usesProductPageMagic([{ section_key: 'product-page', is_hidden: true }])).toBe(false);
  });

  it('usesProductBlocks / usesProductPageMagic: a block under a hidden or unreachable container does not count', () => {
    const tree = (rowHidden: boolean, colHidden = false) => [
      { id: 'row', section_key: 'layout-row', is_hidden: rowHidden },
      { id: 'col', section_key: 'layout-column', parent_id: 'row', is_hidden: colHidden },
      { id: 'buy', section_key: 'product-buy', parent_id: 'col' },
      { id: 'slider', section_key: 'product-slider' },
    ];
    expect(usesProductBlocks(tree(false))).toBe(true);
    expect(usesProductBlocks(tree(true))).toBe(false);
    expect(usesProductBlocks(tree(false, true))).toBe(false);
    // Missing parent, non-container parent, a parent_id cycle: not rendered.
    expect(usesProductBlocks([{ id: 'b', section_key: 'product-buy', parent_id: 'gone' }])).toBe(false);
    expect(
      usesProductBlocks([
        { id: 't', section_key: 'rich-text' },
        { id: 'b', section_key: 'product-buy', parent_id: 't' },
      ]),
    ).toBe(false);
    expect(
      usesProductBlocks([
        { id: 'a', section_key: 'layout-row', parent_id: 'c' },
        { id: 'c', section_key: 'layout-column', parent_id: 'a' },
        { id: 'b', section_key: 'product-buy', parent_id: 'c' },
      ]),
    ).toBe(false);
    // A visible block elsewhere still counts.
    expect(usesProductBlocks([...tree(true), { id: 'bc', section_key: 'product-breadcrumb' }])).toBe(true);
    expect(
      usesProductPageMagic([
        { id: 'row', section_key: 'layout-row', is_hidden: true },
        { id: 'pp', section_key: 'product-page', parent_id: 'row' },
      ]),
    ).toBe(false);
  });
});

// The block wrappers resolve through a shared loader (no literal import()),
// so Next adds no loadableGenerated to them and would not render a
// <link rel=stylesheet> for CSS inside the chunk during SSR. The grouped
// block module and everything it pulls in must therefore stay CSS-free:
// style with Tailwind classes or inline styles instead.
describe('grouped product-block chunk stays CSS-free', () => {
  const srcRoot = path.resolve(here, '../../../../..');
  const CSS_IMPORT = /(?:import\s+(?:[^'"]*?\s+from\s+)?|import\(\s*|require\(\s*)['"][^'"]+\.(?:css|scss|sass|less)['"]/;

  function resolveLocal(from: string, spec: string): string | null {
    let base: string;
    if (spec.startsWith('@/')) base = path.join(srcRoot, spec.slice(2));
    else if (spec.startsWith('.')) base = path.resolve(path.dirname(from), spec);
    else return null;
    for (const cand of [base, `${base}.ts`, `${base}.tsx`, path.join(base, 'index.ts'), path.join(base, 'index.tsx')]) {
      if (/\.tsx?$/.test(cand) && existsSync(cand) && statSync(cand).isFile()) return cand;
    }
    // Packages and stylesheets are not walked (CSS_IMPORT flags the latter).
    return null;
  }

  it('no module reachable from productBlocks.client imports a stylesheet', () => {
    const IMPORT_SPEC = /(?:from\s+|import\s*\(\s*|import\s+)['"]([^'"]+)['"]/g;
    const seen = new Set<string>();
    const queue = [path.join(here, 'productBlocks.client.tsx')];
    const offenders: string[] = [];
    while (queue.length) {
      const file = queue.pop()!;
      if (seen.has(file)) continue;
      seen.add(file);
      const text = readFileSync(file, 'utf8');
      if (CSS_IMPORT.test(text)) offenders.push(path.relative(srcRoot, file));
      for (const [, spec] of text.matchAll(IMPORT_SPEC)) {
        const next = resolveLocal(file, spec);
        if (next && !seen.has(next)) queue.push(next);
      }
    }
    // Sanity: the walk really covered the block graph.
    expect(seen.size).toBeGreaterThan(20);
    expect(offenders).toEqual([]);
  });
});
