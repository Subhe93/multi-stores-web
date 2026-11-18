import { describe, expect, it } from 'vitest';
import type { ThemeCustomizations } from '../types';
import { creativeAttrs, readCreative } from './creativeAttrs';

const c = (creative: unknown, extra: Record<string, unknown> = {}) =>
  ({ motion: { ...extra, creative } }) as unknown as ThemeCustomizations;

describe('creative store switch', () => {
  it.each([
    undefined,
    null,
    {},
    { motion: undefined },
    { motion: {} },
    { motion: { reveal: 'calm' } },
    { motion: 'on' },
    { motion: [] },
  ])('unset (%j) is off', (value) => {
    expect(readCreative(value as ThemeCustomizations)).toBeNull();
    expect(creativeAttrs(value as ThemeCustomizations)).toEqual({});
  });

  it.each([true, 'on', [], { enabled: false }, { enabled: 'true' }, { enabled: 1 }, { smooth: 'off' }])(
    'junk (%j) is off',
    (creative) => {
      expect(readCreative(c(creative))).toBeNull();
      expect(creativeAttrs(c(creative))).toEqual({});
    },
  );

  it('enabled alone: smooth and magnetic on, no curtain, one attribute', () => {
    expect(readCreative(c({ enabled: true }))).toEqual({ smooth: true, magnetic: true, curtain: false });
    expect(creativeAttrs(c({ enabled: true }))).toEqual({ 'data-creative': '' });
  });

  it('each stored option becomes its attribute', () => {
    expect(creativeAttrs(c({ enabled: true, smooth: 'off' }))).toEqual({
      'data-creative': '',
      'data-creative-smooth': 'off',
    });
    expect(creativeAttrs(c({ enabled: true, magnetic: 'off' }))).toEqual({
      'data-creative': '',
      'data-creative-magnetic': 'off',
    });
    expect(creativeAttrs(c({ enabled: true, transition: 'curtain' }))).toEqual({
      'data-creative': '',
      'data-creative-transition': 'curtain',
    });
    expect(readCreative(c({ enabled: true, smooth: 'off', magnetic: 'off', transition: 'curtain' }))).toEqual({
      smooth: false,
      magnetic: false,
      curtain: true,
    });
  });

  it('unknown option values keep the defaults', () => {
    expect(readCreative(c({ enabled: true, smooth: 'no', magnetic: false, transition: 'fade' }))).toEqual({
      smooth: true,
      magnetic: true,
      curtain: false,
    });
  });

  it('lives beside the motion profile without touching it', () => {
    expect(creativeAttrs(c({ enabled: true }, { reveal: 'calm', zoom: 'off' }))).toEqual({ 'data-creative': '' });
  });
});
