// Section tree helpers (product-template layout containers).
//
// Pages store their sections as a flat list. A section may point at a parent
// through `parent_id`; only the layout container sections listed below can be
// parents. The renderer turns the flat list into a tree with these helpers.
// Pages without any `parent_id` produce a flat list of roots, in the same
// order the renderer used before nesting existed.

import type { SectionInstance } from './types';

/** Section keys that may hold child sections. */
export const CONTAINER_SECTION_KEYS: ReadonlySet<string> = new Set([
  'layout-row',
  'layout-column',
  'layout-grid',
]);

/**
 * Maximum nesting depth. Roots are depth 1; containers may sit at depth 1-2
 * and a leaf section may sit at depth 3.
 */
export const MAX_SECTION_DEPTH = 3;

export function isContainerKey(sectionKey: string): boolean {
  return CONTAINER_SECTION_KEYS.has(sectionKey);
}

/**
 * Class name that is unique per section and safe as a CSS identifier.
 * Section ids are uuids/cuids, so non-word chars are simply stripped.
 */
export function scopeClassFor(sectionId: string): string {
  return `s-${sectionId.replace(/[^a-zA-Z0-9_-]/g, '')}`;
}

/** True for a section that renders a horizontal divider line (a spacer with its line on). */
export function isDividerSection(sectionKey: string, settings: Record<string, unknown> | null | undefined): boolean {
  return sectionKey === 'spacer' && settings?.show_divider === true;
}

export interface SectionTreeNode {
  section: SectionInstance;
  /** 1 for root sections. */
  depth: number;
  children: SectionTreeNode[];
}

/**
 * Build the render tree from a flat section list.
 *
 * - Hidden sections are dropped together with their whole subtree.
 * - A section whose parent is missing, hidden, not a container, or too deep
 *   is dropped together with its subtree (it is unreachable from a root).
 * - Siblings are sorted by `sort_order` (stable, so equal values keep the
 *   input order, exactly like the previous flat renderer).
 * - Cycles cannot be reached from a root; a visited guard protects anyway.
 */
export function buildSectionTree(sections: SectionInstance[]): SectionTreeNode[] {
  const byParent = new Map<string | null, SectionInstance[]>();
  for (const s of sections) {
    if (s.is_hidden) continue;
    const parent = s.parent_id ?? null;
    const list = byParent.get(parent);
    if (list) list.push(s);
    else byParent.set(parent, [s]);
  }
  for (const list of byParent.values()) list.sort((a, b) => a.sort_order - b.sort_order);

  const visited = new Set<string>();
  const build = (parentId: string | null, depth: number): SectionTreeNode[] => {
    const list = byParent.get(parentId) ?? [];
    const out: SectionTreeNode[] = [];
    for (const section of list) {
      if (visited.has(section.id)) continue;
      visited.add(section.id);
      // Only containers above the deepest level can hold children.
      const canHold = isContainerKey(section.section_key) && depth < MAX_SECTION_DEPTH;
      out.push({ section, depth, children: canHold ? build(section.id, depth + 1) : [] });
    }
    return out;
  };
  return build(null, 1);
}

/** Minimal node shape shared by the raw tree and the renderer's pruned tree. */
export interface TreeLike<N> {
  section: SectionInstance;
  children: N[];
}

/** Depth-first, document-order walk over a tree. */
export function walkTree<N extends TreeLike<N>>(nodes: N[], visit: (node: N) => void): void {
  for (const node of nodes) {
    visit(node);
    walkTree(node.children, visit);
  }
}

/** Whether `id` is the node itself or one of its descendants. */
export function subtreeContains<N extends TreeLike<N>>(node: N, id: string | undefined): boolean {
  if (!id) return false;
  if (node.section.id === id) return true;
  return node.children.some((c) => subtreeContains(c, id));
}

// ── Child layout (settings._layout) ─────────────────────────────────────

export type LayoutBreakpoint = 'desktop' | 'tablet' | 'mobile';
export type AlignSelf = 'start' | 'center' | 'end' | 'stretch';

/** Layout settings a child stores for its parent container. */
export interface ChildLayout {
  span?: Partial<Record<LayoutBreakpoint, number>>;
  order?: Partial<Record<LayoutBreakpoint, number>>;
  align_self?: AlignSelf;
  sticky?: boolean;
}

const BREAKPOINTS: LayoutBreakpoint[] = ['desktop', 'tablet', 'mobile'];
const ALIGN_SELF = new Set<AlignSelf>(['start', 'center', 'end', 'stretch']);

function readPerBreakpoint(raw: unknown, min: number, max: number): Partial<Record<LayoutBreakpoint, number>> | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const out: Partial<Record<LayoutBreakpoint, number>> = {};
  let any = false;
  for (const bp of BREAKPOINTS) {
    const v = (raw as Record<string, unknown>)[bp];
    const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
    if (typeof n !== 'number' || !Number.isFinite(n)) continue;
    out[bp] = Math.min(max, Math.max(min, Math.round(n)));
    any = true;
  }
  return any ? out : undefined;
}

/** Read and sanitise a child's `settings._layout`. Unknown values are dropped. */
export function readChildLayout(settings: Record<string, unknown> | undefined | null): ChildLayout {
  const raw = settings?._layout;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const r = raw as Record<string, unknown>;
  const out: ChildLayout = {};
  const span = readPerBreakpoint(r.span, 1, 12);
  if (span) out.span = span;
  const order = readPerBreakpoint(r.order, -99, 99);
  if (order) out.order = order;
  if (typeof r.align_self === 'string' && ALIGN_SELF.has(r.align_self as AlignSelf)) {
    out.align_self = r.align_self as AlignSelf;
  }
  if (r.sticky === true) out.sticky = true;
  return out;
}
