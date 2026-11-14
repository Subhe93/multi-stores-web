// Which section keys load the grouped product-block chunk
// (./productBlocks.client): the B1/B2/B3 product blocks and the split magic
// sections placed beside them. The monolith `product-page` is not one of
// them (it has its own chunk). Definition-only imports, safe on the server.

import { MAX_SECTION_DEPTH, isContainerKey } from '../../../../sectionTree';
import { registryB1 } from './registryB1';
import { productBlocksB2 } from './registryB2';
import { productBlocksB3 } from './registryB3';

export const PRODUCT_BLOCK_KEYS: ReadonlySet<string> = new Set([
  ...Object.keys(registryB1),
  ...Object.keys(productBlocksB2),
  ...Object.keys(productBlocksB3),
]);

interface SectionLike {
  id?: string;
  section_key: string;
  is_hidden?: boolean;
  parent_id?: string | null;
}

/**
 * Keys of the sections the renderer actually reaches, with the same rule as
 * buildSectionTree: a section is dropped when it, or any ancestor, is hidden,
 * or when an ancestor is missing, not a container, or the chain is deeper
 * than MAX_SECTION_DEPTH (which also ends any parent_id cycle).
 */
function renderedKeys(sections: ReadonlyArray<SectionLike>): Set<string> {
  const byId = new Map<string, SectionLike>();
  for (const s of sections) if (s.id) byId.set(s.id, s);
  const reached = (s: SectionLike): boolean => {
    let node: SectionLike = s;
    for (let depth = 1; ; depth += 1) {
      if (node.is_hidden || depth > MAX_SECTION_DEPTH) return false;
      if (!node.parent_id) return true;
      const parent = byId.get(node.parent_id);
      if (!parent || !isContainerKey(parent.section_key)) return false;
      node = parent;
    }
  };
  const keys = new Set<string>();
  for (const s of sections) if (reached(s)) keys.add(s.section_key);
  return keys;
}

/** Whether a template renders at least one visible section from the block chunk. */
export function usesProductBlocks(sections: ReadonlyArray<SectionLike>): boolean {
  for (const key of renderedKeys(sections)) if (PRODUCT_BLOCK_KEYS.has(key)) return true;
  return false;
}

/** Whether a template renders a visible monolith `product-page` section. */
export function usesProductPageMagic(sections: ReadonlyArray<SectionLike>): boolean {
  return renderedKeys(sections).has('product-page');
}
