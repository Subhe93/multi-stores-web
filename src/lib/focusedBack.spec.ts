import { describe, expect, it } from 'vitest';
import { MAX_BACK_PATH_LENGTH, focusedBackUrl, parseBackPath, readBackParam } from './focusedBack';

const SITE = 'https://mollstrands.example/';

describe('parseBackPath', () => {
  it.each([
    ['/'],
    ['/product/testlektion-60-min/'],
    ['/ok/path/?a=b#c'],
    ['/kurser/b-körkort'],
    ['/a?next=%2Fb'],
    ['/@evil.com'],
    ['/a:b'],
    [`/${'a'.repeat(MAX_BACK_PATH_LENGTH - 1)}`],
  ])('accepts %s', (value) => {
    expect(parseBackPath(value)).toBe(value);
  });

  it.each([
    ['empty', ''],
    ['no leading slash', 'product/x'],
    ['protocol-relative', '//evil.com'],
    ['protocol-relative with path', '//evil.com/a'],
    ['slash + backslash', '/\\evil'],
    ['backslash inside', '/a\\b'],
    ['backslash first', '\\evil.com'],
    ['absolute URL', 'https://x'],
    ['absolute URL, other scheme', 'javascript:alert(1)'],
    ['scheme in the path', '/https://x'],
    ['double slash inside', '/a//b'],
    ['double slash in the query', '/a?u=//evil.com'],
    ['encoded slash after the first', '/%2Fevil.com'],
    ['encoded slash, upper/lower case', '/%2f%2Fevil.com'],
    ['encoded backslash', '/%5Cevil.com'],
    ['encoded backslash inside', '/a%5cb'],
    ['encoded protocol-relative (not decoded twice)', '%2F%2Fevil.com'],
    ['encoded newline', '/a%0Ab'],
    ['encoded carriage return', '/a%0db'],
    ['encoded NUL', '/a%00'],
    ['encoded DEL', '/a%7F'],
    ['raw tab', '/a\tb'],
    ['raw newline', '/a\nb'],
    ['raw space', '/a b'],
    ['raw NUL', '/a\u0000b'],
    ['line separator', '/a\u2028b'],
    ['too long', `/${'a'.repeat(MAX_BACK_PATH_LENGTH)}`],
  ])('rejects %s', (_name, value) => {
    expect(parseBackPath(value)).toBeNull();
  });

  it.each([[null], [undefined], [42], [['/a']], [{ path: '/a' }]])('rejects a non-string (%j)', (value) => {
    expect(parseBackPath(value)).toBeNull();
  });
});

describe('focusedBackUrl', () => {
  it('joins the site origin and the path', () => {
    expect(focusedBackUrl(SITE, '/product/testlektion-60-min/')).toBe('https://mollstrands.example/product/testlektion-60-min/');
    expect(focusedBackUrl(SITE, '/ok/path/?a=b#c')).toBe('https://mollstrands.example/ok/path/?a=b#c');
    expect(focusedBackUrl(SITE, '/')).toBe(SITE);
  });

  it('uses only the origin of the stored site (its own path and query are dropped)', () => {
    expect(focusedBackUrl('https://mollstrands.example/start?x=1', '/kurs')).toBe('https://mollstrands.example/kurs');
  });

  it('keeps the result on the site host whatever the path holds', () => {
    for (const path of ['/@evil.com', '/a:b@evil.com', '/..;/evil.com', '/../../x', '/.evil.com']) {
      const url = focusedBackUrl(SITE, path);
      expect(url).not.toBeNull();
      expect(new URL(url!).origin).toBe('https://mollstrands.example');
    }
  });

  it.each([['//evil.com'], ['/\\evil'], ['https://x'], ['/%2F%2Fevil.com'], ['/%5Cevil.com'], [''], [null]])(
    'is null for a refused path (%j)',
    (path) => {
      expect(focusedBackUrl(SITE, path)).toBeNull();
    },
  );

  it.each([[null], [''], ['http://mollstrands.example/'], ['https://user@mollstrands.example/'], ['https://127.0.0.1/'], ['javascript:alert(1)']])(
    'is null without a valid external site (%j)',
    (site) => {
      expect(focusedBackUrl(site, '/kurs')).toBeNull();
    },
  );
});

describe('readBackParam', () => {
  it('reads and validates the parameter (decoded once)', () => {
    expect(readBackParam('?qty=1&back=%2Fproduct%2Ftestlektion-60-min%2F')).toBe('/product/testlektion-60-min/');
    expect(readBackParam('?back=/kurs%3Fa%3Db')).toBe('/kurs?a=b');
  });

  it('ignores a missing or refused value', () => {
    expect(readBackParam('')).toBeNull();
    expect(readBackParam(null)).toBeNull();
    expect(readBackParam('?qty=2')).toBeNull();
    expect(readBackParam('?back=%2F%2Fevil.com')).toBeNull();
    expect(readBackParam('?back=https%3A%2F%2Fevil.com')).toBeNull();
    expect(readBackParam('?back=%2F%5Cevil.com')).toBeNull();
    // Double-encoded: decoded once it is `/%2F%2Fevil.com`, still refused.
    expect(readBackParam('?back=%2F%252F%252Fevil.com')).toBeNull();
  });

  it('uses the first value when the parameter is repeated', () => {
    expect(readBackParam('?back=/a&back=/b')).toBe('/a');
  });
});
