import { describe, expect, it } from 'vitest';
import { readableTextOn, relativeLuminance } from './readableText';

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

  it('falls back to white for non-hex values', () => {
    expect(readableTextOn('var(--store-primary, #2563eb)')).toBe('#ffffff');
    expect(readableTextOn(undefined)).toBe('#ffffff');
    expect(relativeLuminance('red')).toBeNull();
  });
});
