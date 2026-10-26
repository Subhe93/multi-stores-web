// Collection hierarchy helpers shared by the product page, the collection
// page and the themed magic sections (M6 §2/§3). Pure functions only — this
// module is imported by client components, so it must never import `next/*`.

export interface CollectionPathNode {
  id: string;
  slug: string;
  translations?: { locale: string; name: string }[];
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
