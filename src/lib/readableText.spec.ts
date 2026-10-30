import { describe, expect, it } from 'vitest';
import { contrastRatio, isUnreadable, readableTextOn, relativeLuminance } from './readableText';

describe('readableTextOn', () => {
  it('uses dark text on light brand colours and white on dark ones', () => {
    expect(readableTextOn('#feee4a')).toBe('#111827'); // Namez yellow
    expect(readableTextOn('#fff')).toBe('#111827');
    expect(readableTextOn('#2563eb')).toBe('#ffffff');
    expect(readableTextOn('#000000')).toBe('#ffffff');
  });

  it('reads computed rgb() colours', () => {
    expect(readableTextOn('rgb(254, 238, 74)')).toBe('#111827');
    expect(readableTextOn('rgba(37, 99, 235, 1)')).toBe('#ffffff');
  });

  it('ignores the alpha channel of 4/8-digit hex', () => {
    expect(readableTextOn('#feee4aff')).toBe('#111827');
    expect(readableTextOn('#000f')).toBe('#ffffff');
  });

  it('falls back to white for non-hex values', () => {
    expect(readableTextOn('var(--store-primary, #2563eb)')).toBe('#ffffff');
    expect(readableTextOn(undefined)).toBe('#ffffff');
    expect(relativeLuminance('red')).toBeNull();
  });
});

describe('readableTextOn — medium brand colours keep white labels', () => {
  it('only clearly light colours get dark text', () => {
    for (const c of ['#3b82f6', '#ef4444', '#22c55e', '#16a34a', '#f97316', '#ec4899', '#0ea5e9']) {
      expect(readableTextOn(c)).toBe('#ffffff');
    }
    for (const c of ['#feee4a', '#facc15', '#ffd600', '#fde68a', '#ffffff']) {
      expect(readableTextOn(c)).toBe('#111827');
    }
  });

  it('flags unreadable pairs only', () => {
    expect(isUnreadable('#ffffff', '#feee4a')).toBe(true);
    expect(isUnreadable('#ffffff', '#2563eb')).toBe(false);
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 0);
  });
});
