import { describe, expect, it } from 'vitest';
import { headerLocaleControlBreakpoints, headerRendersLocaleControl, stripPickerHideClasses } from './regionHeader';
import type { SectionInstance } from '@/themes/types';

const s = (id: string, key: string, settings: Record<string, unknown> = {}, extra: Partial<SectionInstance> = {}): SectionInstance => ({
  id, section_key: key, settings, sort_order: 0, translations: [], ...extra,
});

describe('headerRendersLocaleControl', () => {
  it('true for a visible header-bar with the control on', () => {
    expect(headerRendersLocaleControl([s('a', 'announcement-bar'), s('b', 'header-bar')])).toBe(true);
    expect(headerRendersLocaleControl([s('b', 'header-bar', { show_locale: true })])).toBe(true);
  });

  it('false without one, with the control off, or when hidden', () => {
    expect(headerRendersLocaleControl(null)).toBe(false);
    expect(headerRendersLocaleControl([])).toBe(false);
    expect(headerRendersLocaleControl([s('a', 'announcement-bar')])).toBe(false);
    expect(headerRendersLocaleControl([s('b', 'header-bar', { show_locale: false })])).toBe(false);
    expect(headerRendersLocaleControl([s('b', 'header-bar', {}, { is_hidden: true })])).toBe(false);
  });

  it('finds a header-bar nested in a layout container', () => {
    expect(headerRendersLocaleControl([s('r', 'layout-row'), s('b', 'header-bar', {}, { parent_id: 'r' })])).toBe(true);
  });

  it('a header-bar hidden on a breakpoint (itself or via its container) leaves that breakpoint uncovered', () => {
    const mobileHidden = [s('b', 'header-bar', { _style: { hide_on: ['mobile'] } }), s('n', 'mobile-bottom-nav')];
    expect(headerRendersLocaleControl(mobileHidden)).toBe(false);
    expect([...headerLocaleControlBreakpoints(mobileHidden)].sort()).toEqual(['desktop', 'tablet']);
    const nested = [s('r', 'layout-row', { _style: { hide_on: ['desktop'] } }), s('b', 'header-bar', {}, { parent_id: 'r' })];
    expect([...headerLocaleControlBreakpoints(nested)].sort()).toEqual(['mobile', 'tablet']);
  });

  it('two header-bars covering different breakpoints together cover all', () => {
    expect(headerRendersLocaleControl([
      s('a', 'header-bar', { _style: { hide_on: ['mobile'] } }),
      s('b', 'header-bar', { _style: { hide_on: ['desktop', 'tablet'] } }),
    ])).toBe(true);
  });
});

describe('stripPickerHideClasses', () => {
  it('maps covered breakpoints to the hide_on widths', () => {
    expect(stripPickerHideClasses(new Set())).toBe('');
    expect(stripPickerHideClasses(new Set(['desktop', 'tablet']))).toBe('md:max-lg:hidden lg:hidden');
    expect(stripPickerHideClasses(new Set(['mobile']))).toBe('max-md:hidden');
  });
});
