// A lazy-module loader with two import sites, used by the product sections'
// `next/dynamic` wrappers (see ./blocks/productBlocksLoader.ts and
// ./productPageMagicLoader.ts).
//
// The wrappers belong to the store layout's client graph (the theme
// registry is imported there), so an `import()` written in them becomes a
// chunk group whose "already loaded" set is only the layout: Turbopack then
// copies into it product code (state, ProductDetailClient...) that the
// product page already ships in its own sync chunks, so the browser
// downloads it twice. A warm-up component rendered by the product route
// itself imports a re-export of the same module; that import is chunked
// against the page's modules and carries only what is missing. The warm-up
// registers it here and starts it before hydration reaches the sections.
// Wherever no warm-up is rendered (builder preview, other routes) the
// layout-graph import is the fallback.

export interface SplitLoader<T> {
  /** Called once by a warm-up component (client only) with its page-graph import. */
  register(load: () => Promise<T>): void;
  /** The module; one request per page, shared by every wrapper. */
  load(): Promise<T>;
}

export function createSplitLoader<T>(fromLayout: () => Promise<T>): SplitLoader<T> {
  let pageImport: (() => Promise<T>) | null = null;
  let inflight: Promise<T> | null = null;
  return {
    register(load) {
      pageImport = load;
    },
    load() {
      if (!inflight) {
        inflight = (pageImport ? pageImport().catch(fromLayout) : fromLayout()).catch((err: unknown) => {
          // Let a later render retry instead of caching the failure.
          inflight = null;
          throw err;
        });
      }
      return inflight;
    },
  };
}
