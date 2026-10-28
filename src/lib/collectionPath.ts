// Collection hierarchy helpers shared by the product page, the collection
// page and the themed magic sections (M6 §2/§3). Pure functions only — this
// module is imported by client components, so it must never import `next/*`.

export interface CollectionPathNode {
  id: string;
  slug: string;
  /** M6.7: slugs root → self, served by the API on every public node. */
  path?: string[] | null;
  translations?: { locale: string; name: string }[];
}

/** Deepest collection level served under `/collections/` (root / child / grandchild). */
export const COLLECTION_PATH_MAX_DEPTH = 3;

/**
 * Hierarchical collection URL (M6.7): `/collections/<root>/<child>/<self>`,
 * without a locale prefix. Falls back to the flat slug only for payloads
 * that carry no `path` (older API builds).
 */
export function collectionHref(node: { path?: string[] | null; slug: string }): string {
  const segments = node.path?.length ? node.path : [node.slug];
  return `/collections/${segments.join('/')}`;
}

/**
 * Root → self slugs of a node inside a collection tree, for callers that
 * hold the tree but not the node's own `path`. `[]` for an unknown id.
 */
export function collectionPathFromTree<T extends { id: string; slug: string; children?: T[] }>(
  tree: T[],
  id: string,
): string[] {
  const self = findCollectionNode(tree, id);
  if (!self) return [];
  return [...findCollectionAncestors(tree, id).map((a) => a.slug), self.slug];
}

/**
 * Slugs root → self of the node at `index` inside an ordered chain
 * (ancestors first, e.g. a product's `primary_collection_path`). The node's
 * own `path` wins; otherwise the chain prefix is the path.
 */
export function collectionPathInChain(
  chain: { path?: string[] | null; slug: string }[],
  index: number,
): string[] {
  const node = chain[index];
  if (!node) return [];
  if (node.path?.length) return node.path;
  return chain.slice(0, index + 1).map((n) => n.slug);
}

/**
 * Resolve the `[...path]` segments of a collection URL against the public
 * tree (M6.7): segment 1 must be a root, each next one a child of the
 * previous, every node active. Returns the matched chain (root → leaf) or
 * `null` for a flat child URL, wrong order, missing/extra segment, more than
 * `COLLECTION_PATH_MAX_DEPTH` segments or an inactive node.
 */
export function resolveCollectionChain<
  T extends { slug: string; is_active?: boolean; children?: T[] },
>(tree: T[], segments: string[]): T[] | null {
  if (segments.length === 0 || segments.length > COLLECTION_PATH_MAX_DEPTH) return null;
  const chain: T[] = [];
  let level: T[] = tree;
  for (const segment of segments) {
    const node = level.find((n) => n.slug === segment);
    if (!node || node.is_active === false) return null;
    chain.push(node);
    level = node.children ?? [];
  }
  return chain;
}

/** First node with the given id anywhere in the tree, or `undefined`. */
export function findCollectionNode<T extends { id: string; children?: T[] }>(
  tree: T[],
  id: string,
): T | undefined {
  for (const node of tree) {
    if (node.id === id) return node;
    if (node.children?.length) {
      const found = findCollectionNode(node.children, id);
      if (found) return found;
    }
  }
  return undefined;
}

/** Localized collection name: requested locale → 'en' → first → slug. */
export function collectionDisplayName(node: CollectionPathNode, locale: string): string {
  return (
    node.translations?.find((tr) => tr.locale === locale)?.name ||
    node.translations?.find((tr) => tr.locale === 'en')?.name ||
    node.translations?.[0]?.name ||
    node.slug
  );
}

/**
 * Root → leaf path of a product's primary collection (M6 §2). The API sends
 * `primary_collection_path` (ancestors first, then the primary itself);
 * older payloads without it fall back to the first linked collection as a
 * single-node path. `[]` when the product is in no collection.
 */
export function resolvePrimaryCollectionPath(product: {
  primary_collection_path?: CollectionPathNode[] | null;
  creator_categories?: CollectionPathNode[] | null;
}): CollectionPathNode[] {
  if (product.primary_collection_path?.length) return product.primary_collection_path;
  const first = product.creator_categories?.[0];
  return first ? [first] : [];
}

/**
 * Ancestors of a node in a collection tree, root first (the node itself is
 * NOT included). `[]` for a root or an unknown id. Works for any depth, the
 * callers cap rendering at three levels (root / child / grandchild).
 */
export function findCollectionAncestors<T extends { id: string; children?: T[] }>(
  tree: T[],
  id: string,
): T[] {
  const walk = (nodes: T[], trail: T[]): T[] | null => {
    for (const node of nodes) {
      if (node.id === id) return trail;
      if (node.children?.length) {
        const found = walk(node.children, [...trail, node]);
        if (found) return found;
      }
    }
    return null;
  };
  return walk(tree, []) ?? [];
}
