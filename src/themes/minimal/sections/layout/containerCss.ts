// Scoped CSS for the layout container sections (layout-row, layout-column,
// layout-grid). Pure functions so the output can be unit tested.
//
// DOM the CSS targets (built by SectionRenderer + the container component):
//
//   .s-<container>            container wrapper (owned by its parent)
//     .s-<container>-i        container inner
//       .lc-<container>       flex / grid element rendered by the container
//         <style/>            child style (display:none, not a layout item)
//         .s-<child>          child wrapper   <- span / order / align_self
//           .s-<child>-i      child inner     <- sticky
//
// Breakpoints match sectionStyle.ts: desktop is the base, tablet is
// (max-width: 1023px) and mobile is (max-width: 767px). Sticky applies on
// desktop (min-width: 1024px), where the columns sit side by side; a column
// can opt in from tablet (min-width: 768px) for rows that stack on mobile only.

import { scopeClassFor, type ChildLayout, type LayoutBreakpoint } from '../../../sectionTree';

export const TABLET_DOWN_MQ = '(max-width: 1023px)';
export const MOBILE_DOWN_MQ = '(max-width: 767px)';
export const DESKTOP_ONLY_MQ = '(min-width: 1024px)';
export const TABLET_UP_MQ = '(min-width: 768px)';

const BPS: LayoutBreakpoint[] = ['desktop', 'tablet', 'mobile'];

/** Default distance from the top of the viewport for sticky elements (px). */
export const DEFAULT_STICKY_TOP_PX = 24;

export interface ContainerChild {
  id: string;
  layout: ChildLayout;
  /** A spacer drawing a divider line (sectionTree isDividerSection). */
  divider?: boolean;
}

/** Class of the flex / grid element a container renders. */
export function containerClassFor(sectionId: string): string {
  return `lc-${sectionId.replace(/[^a-zA-Z0-9_-]/g, '')}`;
}

// ── Setting readers ─────────────────────────────────────────────────────

export function intSetting(value: unknown, fallback: number, min: number, max: number): number {
  const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  if (typeof n !== 'number' || !Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

/** Like intSetting, but an empty / missing value stays null ("inherit"). */
export function optionalIntSetting(value: unknown, min: number, max: number): number | null {
  if (value === undefined || value === null || value === '') return null;
  const n = intSetting(value, Number.NaN, min, max);
  return Number.isNaN(n) ? null : n;
}

function pickOption<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

const ALIGN_VALUES = ['stretch', 'start', 'center', 'end'] as const;
type AlignValue = (typeof ALIGN_VALUES)[number];
const JUSTIFY_VALUES = ['start', 'center', 'end', 'between'] as const;
type JustifyValue = (typeof JUSTIFY_VALUES)[number];

const JUSTIFY_CSS: Record<JustifyValue, string> = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  between: 'space-between',
};

// ── Helpers ─────────────────────────────────────────────────────────────

function mediaFor(bp: LayoutBreakpoint): string | null {
  return bp === 'desktop' ? null : bp === 'tablet' ? TABLET_DOWN_MQ : MOBILE_DOWN_MQ;
}

/** Collects rules per breakpoint and joins them in cascade order. */
class CssBuilder {
  private readonly blocks: Record<LayoutBreakpoint, string[]> = { desktop: [], tablet: [], mobile: [] };
  private readonly tail: string[] = [];

  rule(bp: LayoutBreakpoint, selector: string, decls: string[]) {
    if (decls.length) this.blocks[bp].push(`${selector}{${decls.join(';')}}`);
  }

  /** A rule wrapped in its own media query, emitted after the cascade. */
  media(mq: string, selector: string, decls: string[]) {
    if (decls.length) this.tail.push(`@media ${mq}{${selector}{${decls.join(';')}}}`);
  }

  toString(): string {
    let css = '';
    for (const bp of BPS) {
      const body = this.blocks[bp].join('');
      if (!body) continue;
      const mq = mediaFor(bp);
      css += mq ? `@media ${mq}{${body}}` : body;
    }
    return css + this.tail.join('');
  }
}

/** order + align_self + sticky shared by every container kind. */
function appendCommonChildRules(out: CssBuilder, containerSel: string, child: ContainerChild) {
  const childSel = `${containerSel}>.${scopeClassFor(child.id)}`;
  for (const bp of BPS) {
    const order = child.layout.order?.[bp];
    if (order !== undefined) out.rule(bp, childSel, [`order:${order}`]);
  }
  if (child.layout.align_self) out.rule('desktop', childSel, [`align-self:${child.layout.align_self}`]);
  if (child.layout.sticky) {
    // The inner div sticks inside the (stretched) child wrapper.
    out.media(DESKTOP_ONLY_MQ, `${childSel}>.${scopeClassFor(child.id)}-i`, [
      'position:sticky',
      `top:var(--sd-sticky-top,${DEFAULT_STICKY_TOP_PX}px)`,
    ]);
  }
}

// ── Row ─────────────────────────────────────────────────────────────────

export type StackOn = 'tablet' | 'mobile' | 'never';

export interface RowSettings {
  gap: number;
  /** Gap below 1024px; null = same as desktop. */
  gapTablet: number | null;
  /** Gap below 768px; null = same as tablet. */
  gapMobile: number | null;
  align: AlignValue;
  justify: JustifyValue;
  wrap: boolean;
  childWidth: 'fill' | 'auto';
  stackOn: StackOn;
  reverseOnMobile: boolean;
}

export function readRowSettings(settings: Record<string, unknown>): RowSettings {
  return {
    gap: intSetting(settings.gap_px, 32, 0, 200),
    gapTablet: optionalIntSetting(settings.gap_tablet_px, 0, 200),
    gapMobile: optionalIntSetting(settings.gap_mobile_px, 0, 200),
    align: pickOption(settings.align, ALIGN_VALUES, 'stretch'),
    justify: pickOption(settings.justify, JUSTIFY_VALUES, 'start'),
    wrap: settings.wrap === true,
    childWidth: pickOption(settings.child_width, ['fill', 'auto'] as const, 'fill'),
    stackOn: pickOption(settings.stack_on, ['tablet', 'mobile', 'never'] as const, 'tablet'),
    reverseOnMobile: settings.reverse_on_mobile === true,
  };
}

/** Min item width when wrapping is on, so filled items can break lines. */
export const ROW_WRAP_MIN_PX = 240;

function isStackedAt(stackOn: StackOn, bp: LayoutBreakpoint): boolean {
  if (stackOn === 'never' || bp === 'desktop') return false;
  if (stackOn === 'tablet') return true;
  return bp === 'mobile';
}

export function buildRowCss(sectionId: string, settings: Record<string, unknown>, children: ContainerChild[]): string {
  const s = readRowSettings(settings);
  const sel = `.${containerClassFor(sectionId)}`;
  const anyChild = `${sel}>[data-section-id]`;
  const out = new CssBuilder();

  out.rule('desktop', sel, [
    'display:flex',
    'flex-direction:row',
    `flex-wrap:${s.wrap ? 'wrap' : 'nowrap'}`,
    `gap:${s.gap}px`,
    `align-items:${s.align}`,
    `justify-content:${JUSTIFY_CSS[s.justify]}`,
  ]);
  out.rule(
    'desktop',
    anyChild,
    s.childWidth === 'fill'
      ? ['flex:1 1 0%', s.wrap ? `min-width:min(100%,${ROW_WRAP_MIN_PX}px)` : 'min-width:0']
      : ['flex:0 1 auto', 'min-width:0'],
  );

  // Optional smaller-screen gaps (cascade: mobile inherits tablet, tablet
  // inherits desktop). The gap is the column gap while side by side and the
  // vertical gap once stacked.
  const tabletGap = s.gapTablet ?? s.gap;
  if (tabletGap !== s.gap) out.rule('tablet', sel, [`gap:${tabletGap}px`]);
  if (s.gapMobile !== null && s.gapMobile !== tabletGap) out.rule('mobile', sel, [`gap:${s.gapMobile}px`]);

  // Stacking: the row turns into a column and every child takes the full width.
  for (const bp of ['tablet', 'mobile'] as const) {
    const stacked = isStackedAt(s.stackOn, bp);
    const firstStacked = stacked && (bp === 'tablet' || !isStackedAt(s.stackOn, 'tablet'));
    const reverse = bp === 'mobile' && s.reverseOnMobile;
    if (firstStacked || reverse) {
      const dir = stacked ? (reverse ? 'column-reverse' : 'column') : 'row-reverse';
      out.rule(bp, sel, [`flex-direction:${dir}`, ...(firstStacked ? ['flex-wrap:nowrap'] : [])]);
    }
    if (firstStacked) out.rule(bp, anyChild, ['flex:0 0 auto', 'width:100%']);
  }

  for (const child of children) {
    const childSel = `${sel}>.${scopeClassFor(child.id)}`;
    // Span = flex-grow weight (column width ratio), only while side by side.
    if (s.childWidth === 'fill') {
      for (const bp of BPS) {
        const span = child.layout.span?.[bp];
        if (span === undefined || isStackedAt(s.stackOn, bp)) continue;
        out.rule(bp, childSel, [`flex-grow:${span}`]);
      }
    }
    appendCommonChildRules(out, sel, child);
  }
  return out.toString();
}

// ── Column ──────────────────────────────────────────────────────────────

/** Smallest screen a sticky column sticks on: desktop (>= 1024px) or tablet (>= 768px). */
export type StickyFrom = 'desktop' | 'tablet';

export interface ColumnSettings {
  gap: number;
  align: AlignValue;
  stickyDesktop: boolean;
  stickyTop: number;
  stickyFrom: StickyFrom;
}

export function readColumnSettings(settings: Record<string, unknown>): ColumnSettings {
  return {
    gap: intSetting(settings.gap_px, 16, 0, 200),
    align: pickOption(settings.align, ALIGN_VALUES, 'stretch'),
    stickyDesktop: settings.sticky_desktop === true,
    stickyTop: intSetting(settings.sticky_top_px, DEFAULT_STICKY_TOP_PX, 0, 400),
    stickyFrom: pickOption(settings.sticky_from, ['desktop', 'tablet'] as const, 'desktop'),
  };
}

export function buildColumnCss(sectionId: string, settings: Record<string, unknown>, children: ContainerChild[]): string {
  const s = readColumnSettings(settings);
  const sel = `.${containerClassFor(sectionId)}`;
  const out = new CssBuilder();
  out.rule('desktop', sel, ['display:flex', 'flex-direction:column', `gap:${s.gap}px`, `align-items:${s.align}`]);
  out.rule('desktop', `${sel}>[data-section-id]`, ['min-width:0']);
  // A child that rendered nothing (e.g. a product block with no data for this
  // product) takes no gap, like the monolith's conditional blocks.
  out.rule('desktop', `${sel}>[data-section-id]:has(>div:only-child:empty)`, ['display:none']);
  appendDoubleDividerRules(out, sel, children);
  for (const child of children) appendCommonChildRules(out, sel, child);
  if (s.stickyDesktop) {
    // The column's own inner div sticks inside its wrapper, which a parent
    // row / grid stretches to the full row height. "From tablet" suits a row
    // that only stacks on mobile (side by side from 768px).
    const mq = s.stickyFrom === 'tablet' ? TABLET_UP_MQ : DESKTOP_ONLY_MQ;
    out.media(mq, `.${scopeClassFor(sectionId)}-i`, ['position:sticky', `top:${s.stickyTop}px`]);
  }
  return out.toString();
}

/**
 * Two divider lines with nothing visible between them read as one double
 * line (e.g. a product without bundles, variants or personalization: every
 * block between the two dividers renders nothing). For each pair of
 * consecutive dividers in the column, the second one is hidden while every
 * child between them is empty; as soon as one of them renders content the
 * rule no longer matches. Same emptiness test as the collapse rule above;
 * one flat :has() per child since :has() cannot be nested. Children are taken
 * in sibling (DOM) order, as rendered. A per-breakpoint `order` on any child
 * can move content visually between two dividers that are adjacent in the
 * DOM, so no rule is emitted at all when a child carries one (a visible
 * double line beats a hidden divider next to content).
 */
function appendDoubleDividerRules(out: CssBuilder, sel: string, children: ContainerChild[]) {
  const reordered = children.some((c) => BPS.some((bp) => c.layout.order?.[bp] !== undefined));
  if (reordered) return;
  let prevDivider = -1;
  children.forEach((child, i) => {
    if (!child.divider) return;
    if (prevDivider >= 0) {
      const between = children.slice(prevDivider + 1, i);
      const allEmpty = between
        .map((c) => `:has(>.${scopeClassFor(c.id)}>div:only-child:empty)`)
        .join('');
      out.rule('desktop', `${sel}${allEmpty}>.${scopeClassFor(child.id)}`, ['display:none']);
    }
    prevDivider = i;
  });
}

// ── Grid ────────────────────────────────────────────────────────────────

export interface GridSettings {
  columns: Record<LayoutBreakpoint, number>;
  gap: number;
  rowGap: number;
  align: AlignValue;
}

export function readGridSettings(settings: Record<string, unknown>): GridSettings {
  const desktop = intSetting(settings.columns_desktop, 2, 1, 12);
  const tablet = intSetting(settings.columns_tablet, Math.min(desktop, 2), 1, 12);
  const mobile = intSetting(settings.columns_mobile, 1, 1, 12);
  const gap = intSetting(settings.gap_px, 24, 0, 200);
  return {
    columns: { desktop, tablet, mobile },
    gap,
    rowGap: intSetting(settings.row_gap_px, gap, 0, 200),
    align: pickOption(settings.align, ALIGN_VALUES, 'stretch'),
  };
}

export function buildGridCss(sectionId: string, settings: Record<string, unknown>, children: ContainerChild[]): string {
  const s = readGridSettings(settings);
  const sel = `.${containerClassFor(sectionId)}`;
  const out = new CssBuilder();
  out.rule('desktop', sel, [
    'display:grid',
    `grid-template-columns:repeat(${s.columns.desktop},minmax(0,1fr))`,
    `column-gap:${s.gap}px`,
    `row-gap:${s.rowGap}px`,
    `align-items:${s.align}`,
  ]);
  out.rule('desktop', `${sel}>[data-section-id]`, ['min-width:0']);
  for (const bp of ['tablet', 'mobile'] as const) {
    if (s.columns[bp] !== s.columns[bp === 'tablet' ? 'desktop' : 'tablet']) {
      out.rule(bp, sel, [`grid-template-columns:repeat(${s.columns[bp]},minmax(0,1fr))`]);
    }
  }
  for (const child of children) {
    const childSel = `${sel}>.${scopeClassFor(child.id)}`;
    // Span cascades desktop -> tablet -> mobile and is clamped to the column
    // count of each breakpoint, so a wide child never adds implicit columns.
    let inherited: number | undefined;
    let emitted: number | undefined;
    for (const bp of BPS) {
      const own = child.layout.span?.[bp];
      if (own !== undefined) inherited = own;
      if (inherited === undefined) continue;
      const span = Math.min(inherited, s.columns[bp]);
      if (span !== emitted) {
        out.rule(bp, childSel, [`grid-column:span ${span}/span ${span}`]);
        emitted = span;
      }
    }
    appendCommonChildRules(out, sel, child);
  }
  return out.toString();
}
