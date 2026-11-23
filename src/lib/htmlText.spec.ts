import { describe, expect, it } from 'vitest';
import { collapseWhitespace, stripHtmlToText } from './htmlText';

// M166 B: one tag strip for every SEO text (meta, JSON-LD).
describe('stripHtmlToText', () => {
  it('keeps block boundaries as spaces and decodes entities', () => {
    expect(stripHtmlToText('<p>NameZ är en webbutik</p><p>med presenter</p>')).toBe('NameZ är en webbutik med presenter');
    expect(stripHtmlToText('Kaffe &amp; te&nbsp;&#8211; &lt;3')).toBe('Kaffe & te – <3');
    expect(stripHtmlToText('<p>&nbsp;</p>')).toBe('');
    expect(stripHtmlToText(null)).toBe('');
  });
});

describe('collapseWhitespace', () => {
  it('collapses CR/LF and runs of spaces, never clips', () => {
    const long = 'a '.repeat(200).trim();
    expect(collapseWhitespace('Personligt\r\n3D  namnhalsband\n')).toBe('Personligt 3D namnhalsband');
    expect(collapseWhitespace(long)).toBe(long);
    expect(collapseWhitespace(undefined)).toBe('');
  });
});
