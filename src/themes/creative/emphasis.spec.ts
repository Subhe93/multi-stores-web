import { describe, expect, it } from 'vitest';
import { emphasisValue, isArabicScript, parseEmphasis, stripEmphasis } from './emphasis';

describe('parseEmphasis', () => {
  it('splits a line at its balanced pair', () => {
    expect(parseEmphasis('More than *just a drink*')).toEqual([
      { text: 'More than ', em: false },
      { text: 'just a drink', em: true },
    ]);
    expect(parseEmphasis('*Culture*, reimagined.')).toEqual([
      { text: 'Culture', em: true },
      { text: ', reimagined.', em: false },
    ]);
    expect(parseEmphasis('A *b* c')).toEqual([
      { text: 'A ', em: false },
      { text: 'b', em: true },
      { text: ' c', em: false },
    ]);
  });

  it('a line without markers is one plain part', () => {
    expect(parseEmphasis('Plain heading')).toEqual([{ text: 'Plain heading', em: false }]);
    expect(parseEmphasis('')).toEqual([]);
  });

  it('unbalanced or empty markers stay text', () => {
    expect(parseEmphasis('5 * 3 is fifteen')).toEqual([{ text: '5 * 3 is fifteen', em: false }]);
    expect(parseEmphasis('Rated 5*')).toEqual([{ text: 'Rated 5*', em: false }]);
    expect(parseEmphasis('Empty ** pair')).toEqual([{ text: 'Empty ** pair', em: false }]);
    expect(parseEmphasis('Blank * * pair')).toEqual([{ text: 'Blank * * pair', em: false }]);
  });

  it('takes only the first pair of a line', () => {
    expect(parseEmphasis('*one* and *two*')).toEqual([
      { text: 'one', em: true },
      { text: ' and *two*', em: false },
    ]);
  });

  it('works on Arabic text', () => {
    expect(parseEmphasis('فرصة *للتعلّم*')).toEqual([
      { text: 'فرصة ', em: false },
      { text: 'للتعلّم', em: true },
    ]);
  });
});

describe('stripEmphasis', () => {
  it('removes the markers of parsed pairs, line by line', () => {
    expect(stripEmphasis('First line.\nThen the *second.*')).toBe('First line.\nThen the second.');
    expect(stripEmphasis('*a* x\n*b* y')).toBe('a x\nb y');
  });
  it('keeps unbalanced markers', () => {
    expect(stripEmphasis('Rated 5*\nplain')).toBe('Rated 5*\nplain');
  });
});

describe('emphasisValue', () => {
  it('falls back for unset and unknown values', () => {
    expect(emphasisValue(undefined, 'none')).toBe('none');
    expect(emphasisValue('bold', 'italic')).toBe('italic');
    expect(emphasisValue('none', 'italic')).toBe('none');
    expect(emphasisValue('color', 'none')).toBe('color');
  });
});

describe('isArabicScript', () => {
  it('detects Arabic, Persian and Kurdish (Sorani) letters and presentation forms', () => {
    expect(isArabicScript('ثقافة')).toBe(true);
    expect(isArabicScript('ATELIER نوروز')).toBe(true);
    expect(isArabicScript('پێشەنگ')).toBe(true);
    expect(isArabicScript('ﺍ')).toBe(true);
  });
  it('is false for Latin, digits and punctuation', () => {
    expect(isArabicScript('ATELIER 01 — é ü ş')).toBe(false);
    expect(isArabicScript('')).toBe(false);
  });
});
