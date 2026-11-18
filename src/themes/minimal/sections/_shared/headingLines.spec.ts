import { describe, expect, it } from 'vitest';
import { HEADING_MAX_LINES, headingLines, headingOneLine, multilineStyle } from './headingLines';

describe('headingLines', () => {
  it('a single line equals the trimmed text', () => {
    for (const raw of ['Made to last', '  Made to last  ', 'Every Purchase. A Chance to Learn.', 'عنوان واحد', 'a  b', '']) {
      expect(headingLines(raw)).toBe(raw.trim());
    }
    expect(headingLines('Made to last\n')).toBe('Made to last');
    expect(headingLines('\n\n  Made to last \n')).toBe('Made to last');
  });

  it('keeps the breaks the owner typed', () => {
    expect(headingLines('Every Purchase.\nA Chance to Learn.')).toBe('Every Purchase.\nA Chance to Learn.');
    expect(headingLines('كل عملية شراء.\nفرصة للتعلّم.')).toBe('كل عملية شراء.\nفرصة للتعلّم.');
  });

  it('reads every kind of line terminator as one break', () => {
    expect(headingLines('a\r\nb')).toBe('a\nb');
    expect(headingLines('a\rb')).toBe('a\nb');
    expect(headingLines('a\u2028b')).toBe('a\nb');
    expect(headingLines('a\u2029b')).toBe('a\nb');
    expect(headingLines('a\vb')).toBe('a\nb');
    expect(headingLines('a\fb')).toBe('a\nb');
    // A Windows paste: CRLF is one break, not two.
    expect(headingLines('one\r\ntwo\r\nthree')).toBe('one\ntwo\nthree');
  });

  it('trims each line and drops the empty ones', () => {
    expect(headingLines('  one  \n\n   \n\t two\t\n')).toBe('one\ntwo');
    expect(headingLines('\n \n')).toBe('');
  });

  it('keeps at most four lines; the text of further lines joins the last one', () => {
    expect(HEADING_MAX_LINES).toBe(4);
    expect(headingLines('1\n2\n3\n4')).toBe('1\n2\n3\n4');
    expect(headingLines('1\n2\n3\n4\n5\n6')).toBe('1\n2\n3\n4 5 6');
    // Empty lines do not count towards the limit.
    expect(headingLines('1\n\n2\n\n3\n\n4\n\n5')).toBe('1\n2\n3\n4 5');
    expect(headingLines('1\n2\n3\n4\n5\n6').split('\n')).toHaveLength(4);
  });

  it('a non-string reads as empty', () => {
    for (const raw of [undefined, null, 0, 12, true, {}, ['a\nb'], () => 'x']) {
      expect(headingLines(raw)).toBe('');
    }
  });

  it('is stable: normalizing twice changes nothing', () => {
    for (const raw of ['a', ' a \r\n b ', '1\n2\n3\n4\n5\n6', '']) {
      expect(headingLines(headingLines(raw))).toBe(headingLines(raw));
    }
  });
});

describe('headingOneLine / multilineStyle', () => {
  it('joins the lines with one space', () => {
    expect(headingOneLine('Every Purchase.\nA Chance to Learn.')).toBe('Every Purchase. A Chance to Learn.');
    expect(headingOneLine('One line')).toBe('One line');
    expect(headingOneLine('')).toBe('');
  });

  it('adds white-space: pre-line only when the text has a break', () => {
    expect(multilineStyle('a\nb')).toEqual({ whiteSpace: 'pre-line' });
    expect(multilineStyle('a b')).toEqual({});
    expect(multilineStyle('')).toEqual({});
    // Spread into a style object, a single line adds no key at all.
    expect(Object.keys({ color: 'red', ...multilineStyle('one line') })).toEqual(['color']);
  });
});
