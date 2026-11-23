import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

// M165: product references are resolved by `productLinkRewriter` before
// sections reach the renderer. Every storefront file that renders
// `<SectionRenderer` must therefore call it (the client safety net only maps
// a missed reference to the product list).

const ROOTS = [join(__dirname, '..', 'app', 'store'), join(__dirname, '..', 'components', 'store')];

function files(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) files(p, out);
    else if (/\.tsx$/.test(name) && !/\.(test|spec)\.tsx$/.test(name)) out.push(p);
  }
  return out;
}

describe('section routes call the product link rewriter', () => {
  const renderers = ROOTS.flatMap((r) => files(r)).filter((f) => readFileSync(f, 'utf8').includes('<SectionRenderer'));

  it('finds the storefront renderers', () => {
    expect(renderers.length).toBeGreaterThanOrEqual(6);
  });

  for (const f of renderers) {
    it(relative(join(__dirname, '..'), f).split('\\').join('/'), () => {
      expect(readFileSync(f, 'utf8')).toContain('productLinkRewriter(');
    });
  }
});
