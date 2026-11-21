// Published HEADER check for the region picker strip (M155). Pure (no next/*).

import { buildSectionTree, type SectionTreeNode } from '@/themes/sectionTree';
import { readSectionStyle, type Breakpoint } from '@/themes/sectionStyle';
import type { SectionInstance } from '@/themes/types';

const ALL_BREAKPOINTS: readonly Breakpoint[] = ['desktop', 'tablet', 'mobile'];

function hiddenOn(node: SectionTreeNode): Breakpoint[] {
  return readSectionStyle(node.section.settings)?.hide_on ?? [];
}

/**
 * Breakpoints where a published HEADER renders its own country/language
 * control: a visible `header-bar` with `show_locale` not switched off, minus
 * the breakpoints its responsive visibility (`_style.hide_on`, on the section
 * or on any container above it) hides it on (M155).
 */
export function headerLocaleControlBreakpoints(sections: SectionInstance[] | null | undefined): Set<Breakpoint> {
  const out = new Set<Breakpoint>();
  if (!sections?.length) return out;
  const visit = (nodes: SectionTreeNode[], hidden: ReadonlySet<Breakpoint>) => {
    for (const node of nodes) {
      const here = new Set([...hidden, ...hiddenOn(node)]);
      if (node.section.section_key === 'header-bar' && node.section.settings?.show_locale !== false) {
        for (const bp of ALL_BREAKPOINTS) if (!here.has(bp)) out.add(bp);
      }
      visit(node.children, here);
    }
  };
  visit(buildSectionTree(sections), new Set());
  return out;
}

/** Whether the published HEADER renders the control on every breakpoint. */
export function headerRendersLocaleControl(sections: SectionInstance[] | null | undefined): boolean {
  return headerLocaleControlBreakpoints(sections).size === ALL_BREAKPOINTS.length;
}

/**
 * Tailwind classes that hide the strip picker where the header already shows
 * the control (mobile < md, tablet md..lg, desktop >= lg, the same widths as
 * `hide_on`). Empty when the header covers no breakpoint.
 */
export function stripPickerHideClasses(covered: ReadonlySet<Breakpoint>): string {
  const cls: string[] = [];
  if (covered.has('mobile')) cls.push('max-md:hidden');
  if (covered.has('tablet')) cls.push('md:max-lg:hidden');
  if (covered.has('desktop')) cls.push('lg:hidden');
  return cls.join(' ');
}
