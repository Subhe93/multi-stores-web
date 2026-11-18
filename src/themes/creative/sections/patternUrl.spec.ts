import { describe, expect, it } from 'vitest';
import { PATTERN_URL_MAX, patternCssUrl, safePatternUrl } from './patternUrl';

const SVG = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciLz4=';

describe('safePatternUrl', () => {
  it('accepts root-relative, https and base64 image data URLs', () => {
    expect(safePatternUrl('/uploads/tiles/kilim.svg')).toBe('/uploads/tiles/kilim.svg');
    expect(safePatternUrl('  https://cdn.example.com/a/tile.png?v=2  ')).toBe('https://cdn.example.com/a/tile.png?v=2');
    expect(safePatternUrl(SVG)).toBe(SVG);
    expect(safePatternUrl('data:image/png;base64,iVBORw0KGgo=')).toBe('data:image/png;base64,iVBORw0KGgo=');
    expect(safePatternUrl('data:image/webp;base64,UklGRg==')).toBe('data:image/webp;base64,UklGRg==');
  });

  it('percent-encodes spaces and non-ASCII once and keeps existing escapes', () => {
    expect(safePatternUrl('/uploads/my tile.svg')).toBe('/uploads/my%20tile.svg');
    expect(safePatternUrl('/uploads/my%20tile.svg')).toBe('/uploads/my%20tile.svg');
    expect(safePatternUrl('/uploads/نقش.svg')).toBe('/uploads/%D9%86%D9%82%D8%B4.svg');
  });

  it('rejects empty and non-string values', () => {
    for (const v of [undefined, null, '', '   ', 12, {}, ['/a.svg']]) expect(safePatternUrl(v)).toBeNull();
  });

  it('rejects every other scheme and shape', () => {
    for (const v of [
      'http://cdn.example.com/tile.png',
      '//evil.example/tile.png',
      'javascript:alert(1)',
      'tile.svg',
      './tile.svg',
      'https://',
      'ftp://example.com/a.png',
      'blob:https://example.com/1',
      'data:text/html;base64,PGI+',
      'data:image/svg+xml;utf8,<svg/>',
      'data:image/svg+xml,%3Csvg%2F%3E',
      'data:image/gif;base64,R0lGOD',
      'data:image/png;base64,',
      'data:image/png;base64,abc def',
    ]) {
      expect(safePatternUrl(v), v).toBeNull();
    }
  });

  it('rejects anything that could leave the url("…") string', () => {
    for (const v of [
      '/a.svg"); background:url("https://evil.example/x',
      '/a.svg)',
      '/a\\.svg',
      '/a\n.svg',
      '/a\t.svg',
      'https://example.com/a.svg"',
      `${SVG}")`,
    ]) {
      expect(safePatternUrl(v), JSON.stringify(v)).toBeNull();
    }
  });

  it('rejects an oversized value', () => {
    expect(safePatternUrl(`/${'a'.repeat(PATTERN_URL_MAX)}`)).toBeNull();
  });

  it('writes the accepted URL as a quoted CSS url()', () => {
    expect(patternCssUrl('/uploads/my%20tile.svg')).toBe('url("/uploads/my%20tile.svg")');
  });
});
