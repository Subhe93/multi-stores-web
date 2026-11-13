import { Fragment, type CSSProperties, type ReactNode } from 'react';
import type {
  LayoutChildNode,
  ListingContext,
  ProductContext,
  SectionDefinition,
  SectionInstance,
  StoreContext,
  Theme,
} from './types';
import { animationClass, readSectionStyle, resolveSectionStyle, type SectionStyle } from './sectionStyle';
import { Reveal } from './_motion';
import { hasDynamicSource } from './minimal/sections/_shared/dynamicSourceKeys';
import {
  buildSectionTree,
  isContainerKey,
  readChildLayout,
  scopeClassFor,
  subtreeContains,
  walkTree,
  type SectionTreeNode,
} from './sectionTree';

// Sections that are usually the page's LCP element: never wrapped in a reveal.
const NO_REVEAL_KEYS = new Set(['aurora-hero', 'product-page', 'product-gallery', 'product-listing']);

/** Whether a page-content section gets the scroll-in reveal wrapper. */
export function shouldReveal(sectionKey: string, isFirst: boolean): boolean {
  if (isFirst) return false;
  if (sectionKey.startsWith('hero-') || sectionKey === 'hero') return false;
  return !NO_REVEAL_KEYS.has(sectionKey);
}

interface SectionRendererProps {
  theme: Theme;
  sections: SectionInstance[];
  locale: string;
  storeSlug: string;
  primaryLocale: string;
  // Forwarded to every section. Only magic sections read it; the rest ignore.
  product?: ProductContext;
  // Same idea for CATALOG_TEMPLATE / COLLECTION_TEMPLATE pages — only the
  // `product-listing` magic section reads it.
  listing?: ListingContext;
  currency?: string;
  // Forwarded only to sections flagged `needsStoreContext` (header, footer,
  // copyright, social icons) so they can render store data without re-fetching.
  storeContext?: StoreContext;
  // Server-preloaded data keyed by section id (M6.4, lib/preloadSections.ts).
  // Each section only receives its own entry.
  preloaded?: Record<string, unknown>;
  // Chrome mode (HEADER / FOOTER pages). Renders each section's wrappers as
  // `display: contents` so they don't generate a box. A boxed wrapper would
  // become the containing block of a `position: sticky` header and, being
  // only as tall as the header itself, would give it no room to stick — the
  // header would scroll away. Removing the box lets the sticky header's
  // containing block fall through to the tall page layout.
  chrome?: boolean;
  // Overrides the wrapper collapse that `chrome` implies. The FOOTER passes
  // false: it has no sticky element, and boxed wrappers let the per-section
  // style overrides (`_style`: padding, width, background) apply there as
  // they do in the builder preview.
  collapseWrappers?: boolean;
  // Builder preview only: empty layout containers stay on the canvas with a
  // dashed drop placeholder. On the live store an empty container renders
  // nothing at all.
  builderPreview?: boolean;
}

/** Render-wide values shared by every section of one renderer call. */
interface RenderContext {
  theme: Theme;
  locale: string;
  primaryLocale: string;
  storeSlug: string;
  product?: ProductContext;
  listing?: ListingContext;
  currency?: string;
  storeContext?: StoreContext;
  preloaded?: Record<string, unknown>;
  chrome?: boolean;
  builderPreview?: boolean;
  wrapperStyle: CSSProperties | undefined;
  /** First renderable leaf in document order (likely the LCP element). */
  firstId: string | undefined;
}

// Older product composites (category 'product' too) keep their behaviour.
const LEGACY_PRODUCT_COMPOSITES = new Set(['add-to-cart', 'product-details']);

/** A separate product block (category 'product', B1/B2), not a legacy composite. */
function isProductBlock(sectionKey: string, def: SectionDefinition): boolean {
  return def.schema?.category === 'product' && !LEGACY_PRODUCT_COMPOSITES.has(sectionKey);
}

/**
 * Whether a section never gets the scroll-in reveal on its own account: the
 * LCP-type keys, and every product block. The product blocks replace the
 * monolith 'product-page' (NO_REVEAL), which never animated: its gallery,
 * title, price and buy button paint at once, and its tabs do not fade in
 * either.
 */
function isNoRevealNode(node: RenderableNode): boolean {
  return NO_REVEAL_KEYS.has(node.section.section_key) || isProductBlock(node.section.section_key, node.def);
}

/** Whether the node or any descendant is a no-reveal section (see isNoRevealNode). */
function subtreeHasNoReveal(node: RenderableNode): boolean {
  return isNoRevealNode(node) || node.children.some(subtreeHasNoReveal);
}

/** A tree node whose section definition exists in the active theme. */
interface RenderableNode {
  section: SectionInstance;
  def: SectionDefinition;
  children: RenderableNode[];
}

/**
 * Keep only nodes the active theme can render. Unknown keys (or broken
 * definitions) are skipped with their subtree; on the live store a container
 * left without renderable children is skipped as well.
 */
function pruneTree(nodes: SectionTreeNode[], theme: Theme, builderPreview: boolean): RenderableNode[] {
  const out: RenderableNode[] = [];
  for (const node of nodes) {
    const { section } = node;
    const def = theme.sections[section.section_key];
    // Skip sections whose key isn't registered in the active theme OR
    // whose definition is broken (missing Component). Either condition
    // means "this section can't render in this theme" rather than a
    // crash — switching themes or shipping a bad section shouldn't
    // blank out the whole page.
    // Use a loose truthy check — in RSC builds, client component refs
    // are objects (module references), not raw functions.
    if (!def || !def.Component) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn(
          `[SectionRenderer] No component for section_key="${section.section_key}" in theme "${theme.key}". Skipping.`,
        );
      }
      continue;
    }
    if (isContainerKey(section.section_key)) {
      const children = pruneTree(node.children, theme, builderPreview);
      if (children.length === 0 && !builderPreview) continue;
      out.push({ section, def, children });
    } else {
      out.push({ section, def, children: [] });
    }
  }
  return out;
}

/** Resolve content per locale with primary as fallback, then any row. */
function resolveContent(section: SectionInstance, locale: string, primaryLocale: string): Record<string, unknown> {
  // Tolerate both the array shape (API + snapshot) and the legacy
  // record-keyed shape some older snapshots used.
  const rawTranslations = section.translations as unknown;
  if (Array.isArray(rawTranslations)) {
    const t = rawTranslations as Array<{ locale: string; content: Record<string, unknown> }>;
    return (
      t.find((row) => row.locale === locale)?.content ||
      t.find((row) => row.locale === primaryLocale)?.content ||
      t[0]?.content ||
      {}
    );
  }
  if (rawTranslations && typeof rawTranslations === 'object') {
    const t = rawTranslations as Record<string, Record<string, unknown>>;
    return t[locale] || t[primaryLocale] || Object.values(t)[0] || {};
  }
  return {};
}

/**
 * A child inside a container cannot escape to the viewport edges: drop the
 * `full` width (at every breakpoint) and keep the rest of its style.
 */
function withoutFullWidth(style: SectionStyle | undefined): SectionStyle | undefined {
  if (!style || style.width === undefined) return style;
  const w = style.width;
  if (typeof w === 'string') return w === 'full' ? { ...style, width: undefined } : style;
  if (w && typeof w === 'object') {
    const next: Record<string, unknown> = {};
    for (const [bp, v] of Object.entries(w)) if (v !== 'full') next[bp] = v;
    return { ...style, width: next as SectionStyle['width'] };
  }
  return style;
}

/**
 * Render one section (and, for a container, its children) with the shared
 * wrapper: scoped <style>, wrapper div carrying data-section-id/key and the
 * scope class, inner `{scope}-i` div, and the optional Reveal.
 */
function renderSection(node: RenderableNode, ctx: RenderContext, nested: boolean): ReactNode {
  const { section, def } = node;
  const content = resolveContent(section, ctx.locale, ctx.primaryLocale);
  const Component = def.Component;
  // Per-section style overrides come back as a single scoped CSS
  // string we inject alongside the wrapper. The wrapper carries the
  // scope class so the rules in that <style> block can target it;
  // the inner div carries `{scope}-i` so width/colour rules can
  // target inner separately (e.g. inner.max-width for 'container').
  const rawStyle = readSectionStyle(section.settings);
  const sectionStyle = nested ? withoutFullWidth(rawStyle) : rawStyle;
  const wrapperScope = scopeClassFor(section.id);
  const innerScope = `${wrapperScope}-i`;
  const { css: styleCss } = resolveSectionStyle(sectionStyle, wrapperScope);
  // A root product block that rendered nothing (e.g. tabs of a product
  // without description, specifications or FAQs) takes no room, so its
  // padding does not add space the monolith never had. Inside a column the
  // column's own rule does the same.
  const isProductLeaf = !nested && isProductBlock(section.section_key, def);
  const css =
    styleCss + (isProductLeaf ? `.${wrapperScope}:has(>.${innerScope}:empty){display:none}` : '');
  const animClass = animationClass(sectionStyle?.animate);
  const wrapperClass = [wrapperScope, animClass].filter(Boolean).join(' ');
  const isContainer = isContainerKey(section.section_key);
  // Containers get three extra props; every other section keeps exactly the
  // props it had before nesting existed.
  const containerProps = isContainer
    ? {
        sectionId: section.id,
        builderPreview: ctx.builderPreview || undefined,
        layoutChildren: node.children.map(
          (child): LayoutChildNode => ({
            id: child.section.id,
            sectionKey: child.section.section_key,
            layout: readChildLayout(child.section.settings),
            node: renderSection(child, ctx, true),
          }),
        ),
      }
    : null;
  // Product blocks (category 'product') also get an explicit builderPreview
  // flag so their "no data" placeholder shows only in the builder preview.
  // Same explicit flag for a section with a dynamic product source
  // (content_source / image_source) and for sections that opt in
  // (needsBuilderPreview). Static sections keep exactly their old props.
  const productBlockProps =
    !isContainer &&
    (def.schema?.category === 'product' || def.needsBuilderPreview || hasDynamicSource(section.settings))
      ? { builderPreview: !!ctx.builderPreview }
      : null;
  const inner = (
    <div className={innerScope} style={ctx.wrapperStyle}>
      <Component
        settings={section.settings}
        content={content}
        locale={ctx.locale}
        primaryLocale={ctx.primaryLocale}
        storeSlug={ctx.storeSlug}
        product={ctx.product}
        listing={ctx.listing}
        currency={ctx.currency}
        storeContext={def.needsStoreContext ? ctx.storeContext : undefined}
        chrome={ctx.chrome || undefined}
        preloaded={ctx.preloaded?.[section.id]}
        {...containerProps}
        {...productBlockProps}
      />
    </div>
  );
  // Reveal rules: never in chrome, never inside a container (no nested
  // reveal), never on the container that holds the first leaf (LCP) or a
  // no-reveal section (the product gallery and blocks), and for root leaves
  // the usual first/LCP-type check plus the product blocks.
  const plain =
    ctx.chrome ||
    nested ||
    (isContainer
      ? subtreeContains(node, ctx.firstId) || subtreeHasNoReveal(node) || !shouldReveal(section.section_key, false)
      : isNoRevealNode(node) || !shouldReveal(section.section_key, section.id === ctx.firstId));
  return (
    <Fragment key={section.id}>
      {css && <style dangerouslySetInnerHTML={{ __html: css }} />}
      {plain ? (
        // Chrome (header/footer) and the first / LCP-type section keep a
        // plain wrapper: a sticky header must not start offset, and the
        // LCP section must paint straight from the server HTML.
        <div
          data-section-id={section.id}
          data-section-key={section.section_key}
          className={wrapperClass}
          style={ctx.wrapperStyle}
        >
          {inner}
        </div>
      ) : (
        // Below-the-fold sections fade/slide in as they scroll into view
        // (CSS + IntersectionObserver; visible without JS).
        <Reveal
          data-section-id={section.id}
          data-section-key={section.section_key}
          className={wrapperClass}
          style={ctx.wrapperStyle}
        >
          {inner}
        </Reveal>
      )}
    </Fragment>
  );
}

/**
 * Renders an ordered list of section instances using the components declared
 * by the active theme. Sections whose key is unknown for the current theme are
 * skipped (so swapping themes doesn't blow up the page if a section has no
 * equivalent in the new theme).
 *
 * The list is flat; sections with a `parent_id` are rendered inside their
 * layout container (see themes/sectionTree.ts). Pages without nesting render
 * exactly as before.
 */
export function SectionRenderer({
  theme,
  sections,
  locale,
  storeSlug,
  primaryLocale,
  product,
  listing,
  currency,
  storeContext,
  preloaded,
  chrome,
  collapseWrappers,
  builderPreview,
}: SectionRendererProps) {
  // In chrome mode the wrapper boxes are collapsed so a sticky header can
  // anchor to the page layout rather than its own tight wrapper.
  const wrapperStyle = (collapseWrappers ?? chrome) ? ({ display: 'contents' } as const) : undefined;
  const roots = pruneTree(buildSectionTree(sections), theme, !!builderPreview);
  // First leaf that will actually render (top of the page, likely LCP).
  let firstId: string | undefined;
  walkTree(roots, (n) => {
    if (firstId === undefined && !isContainerKey(n.section.section_key)) firstId = n.section.id;
  });
  const ctx: RenderContext = {
    theme,
    locale,
    primaryLocale,
    storeSlug,
    product,
    listing,
    currency,
    storeContext,
    preloaded,
    chrome,
    builderPreview,
    wrapperStyle,
    firstId,
  };
  return <>{roots.map((node) => renderSection(node, ctx, false))}</>;
}
